package booking

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/rahmatez/high-traffic-booking/backend/internal/config"
	"github.com/rahmatez/high-traffic-booking/backend/internal/db"
	"github.com/rahmatez/high-traffic-booking/backend/internal/promo"
	redisutil "github.com/rahmatez/high-traffic-booking/backend/internal/platform/redis"
)

var (
	ErrNotFound            = errors.New("booking not found")
	ErrInventoryExhausted  = errors.New("inventory exhausted")
	ErrHoldLimitReached    = errors.New("hold limit reached")
	ErrInvalidStatus       = errors.New("invalid booking status")
	ErrIdempotencyConflict = errors.New("duplicate request")
)

type HoldItem struct {
	TicketTypeID uuid.UUID `json:"ticket_type_id"`
	Quantity     int32     `json:"quantity"`
}

type HoldInput struct {
	EventID    uuid.UUID  `json:"event_id"`
	Items      []HoldItem `json:"items"`
	PromoCode  string     `json:"promo_code"`
	QueueToken string     `json:"queue_token"`
}

type Service struct {
	pool      *pgxpool.Pool
	queries   *db.Queries
	cfg       *config.Config
	holdStore *redisutil.HoldStore
	cache     *redisutil.Cache
	promo     *promo.Service
	queueGate QueueGate
}

func NewService(pool *pgxpool.Pool, queries *db.Queries, cfg *config.Config, holdStore *redisutil.HoldStore, cache *redisutil.Cache) *Service {
	return &Service{
		pool: pool, queries: queries, cfg: cfg, holdStore: holdStore, cache: cache,
		promo: promo.NewService(queries),
	}
}

func (s *Service) SetQueueGate(gate QueueGate) {
	s.queueGate = gate
}

func (s *Service) Hold(ctx context.Context, userID uuid.UUID, idempotencyKey string, in HoldInput) (*db.Booking, []db.ListBookingItemsRow, error) {
	if idempotencyKey == "" {
		return nil, nil, fmt.Errorf("idempotency key required")
	}
	if len(in.Items) == 0 {
		return nil, nil, fmt.Errorf("at least one item required")
	}

	existing, err := s.queries.GetBookingByIdempotencyKeyForUser(ctx, idempotencyKey, userID)
	if err == nil {
		if existing.EventID != in.EventID {
			return nil, nil, ErrIdempotencyConflict
		}
		items, _ := s.queries.ListBookingItems(ctx, existing.ID)
		return &existing, items, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, nil, err
	}

	aggregated, err := aggregateHoldItems(in.Items)
	if err != nil {
		return nil, nil, err
	}

	activeHolds, err := s.queries.CountActiveHoldsByUser(ctx, userID)
	if err != nil {
		return nil, nil, err
	}
	if activeHolds >= int64(s.cfg.BookingMaxActiveHolds) {
		return nil, nil, ErrHoldLimitReached
	}

	eventHolds, err := s.queries.CountActiveHoldsByUserForEvent(ctx, db.CountActiveHoldsByUserForEventParams{
		UserID:  userID,
		EventID: in.EventID,
	})
	if err != nil {
		return nil, nil, err
	}
	if eventHolds >= 1 {
		return nil, nil, ErrHoldLimitReached
	}

	if s.queueGate != nil {
		requires, err := s.queueGate.RequiresQueue(ctx, in.EventID)
		if err != nil {
			return nil, nil, err
		}
		if requires && (in.QueueToken == "" || !s.queueGate.IsAdmitted(ctx, in.EventID, in.QueueToken)) {
			return nil, nil, ErrQueueRequired
		}
	}

	ticketTypeIDs := dedupeTicketTypeIDs(aggregated)

	var booking *db.Booking
	var items []db.ListBookingItemsRow

	holdFn := func() error {
		b, its, holdErr := s.holdInDB(ctx, userID, idempotencyKey, in)
		if holdErr != nil {
			return holdErr
		}
		booking = b
		items = its
		return nil
	}

	if s.holdStore != nil {
		err = s.holdStore.WithTicketLocks(ctx, ticketTypeIDs, 8*time.Second, holdFn)
	} else {
		err = holdFn()
	}
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			existing, fetchErr := s.queries.GetBookingByIdempotencyKeyForUser(ctx, idempotencyKey, userID)
			if fetchErr == nil {
				items, _ := s.queries.ListBookingItems(ctx, existing.ID)
				return &existing, items, nil
			}
		}
		return nil, nil, err
	}

	if s.holdStore != nil {
		if err := s.holdStore.RegisterHold(ctx, booking.ID, in.EventID, s.cfg.BookingHoldTTL); err != nil {
			// Non-fatal: DB is source of truth.
			_ = err
		}
	}
	s.invalidateEventCache(ctx, in.EventID)

	return booking, items, nil
}

func (s *Service) holdInDB(ctx context.Context, userID uuid.UUID, idempotencyKey string, in HoldInput) (*db.Booking, []db.ListBookingItemsRow, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, nil, err
	}
	defer tx.Rollback(ctx)

	qtx := s.queries.WithTx(tx)

	aggregated, err := aggregateHoldItems(in.Items)
	if err != nil {
		return nil, nil, err
	}

	event, err := qtx.GetEventByID(ctx, in.EventID)
	if err != nil {
		return nil, nil, err
	}
	if event.Status != string(db.EventStatusPublished) {
		return nil, nil, fmt.Errorf("event is not available for booking")
	}

	confirmedQty, err := qtx.CountUserConfirmedTicketsForEvent(ctx, userID, in.EventID)
	if err != nil {
		return nil, nil, err
	}
	var newQty int32
	for _, item := range aggregated {
		newQty += item.Quantity
	}
	if confirmedQty+int64(newQty) > int64(s.cfg.BookingMaxTicketsPerOrder)*2 {
		return nil, nil, fmt.Errorf("batas pembelian tiket untuk event ini tercapai")
	}

	typePrices := make(map[uuid.UUID]db.TicketType, len(aggregated))
	var total int64
	for _, item := range aggregated {
		if item.Quantity > int32(s.cfg.BookingMaxTicketsPerOrder) {
			return nil, nil, fmt.Errorf("exceeds max tickets per order")
		}

		tt, err := qtx.GetTicketTypeForUpdate(ctx, item.TicketTypeID)
		if err != nil {
			return nil, nil, err
		}
		if tt.EventID != in.EventID {
			return nil, nil, fmt.Errorf("ticket type does not belong to event")
		}
		if item.Quantity > tt.MaxPerOrder {
			return nil, nil, fmt.Errorf("exceeds max tickets per order for %s", tt.Name)
		}

		now := time.Now()
		if now.Before(tt.SalesStartAt) || now.After(tt.SalesEndAt) {
			return nil, nil, fmt.Errorf("ticket sales not open")
		}

		if _, err := qtx.IncrementHeldCount(ctx, db.IncrementHeldCountParams{
			ID:        item.TicketTypeID,
			HeldCount: item.Quantity,
		}); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, nil, ErrInventoryExhausted
			}
			return nil, nil, err
		}
		typePrices[item.TicketTypeID] = tt
		total += int64(tt.Price) * int64(item.Quantity)
	}

	promoResult, err := s.promo.ValidateAndApply(ctx, in.PromoCode, in.EventID, total)
	if err != nil {
		return nil, nil, err
	}

	holdExpires := time.Now().Add(s.cfg.BookingHoldTTL)
	booking, err := qtx.CreateBookingWithPromo(ctx, db.CreateBookingWithPromoParams{
		UserID:         userID,
		EventID:        in.EventID,
		Status:         string(db.BookingStatusHeld),
		HoldExpiresAt:  holdExpires,
		SubtotalAmount: promoResult.Subtotal,
		DiscountAmount: promoResult.DiscountAmount,
		TotalAmount:    promoResult.FinalTotal,
		PromoCode:      promoResult.Code,
		IdempotencyKey: idempotencyKey,
	})
	if err != nil {
		return nil, nil, err
	}

	for _, item := range aggregated {
		tt := typePrices[item.TicketTypeID]
		_, err = qtx.CreateBookingItem(ctx, db.CreateBookingItemParams{
			BookingID:    booking.ID,
			TicketTypeID: item.TicketTypeID,
			Quantity:     item.Quantity,
			UnitPrice:    tt.Price,
		})
		if err != nil {
			return nil, nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, nil, err
	}

	items, err := s.queries.ListBookingItems(ctx, booking.ID)
	return &booking, items, err
}

func (s *Service) InvalidateEventCache(ctx context.Context, eventID uuid.UUID) {
	s.invalidateEventCache(ctx, eventID)
}

func (s *Service) AfterConfirm(ctx context.Context, bookingID, eventID uuid.UUID) {
	if s.holdStore != nil {
		_ = s.holdStore.ReleaseHold(ctx, bookingID)
	}
	s.invalidateEventCache(ctx, eventID)
}

func (s *Service) invalidateEventCache(ctx context.Context, eventID uuid.UUID) {
	if s.cache == nil {
		return
	}
	event, err := s.queries.GetEventByID(ctx, eventID)
	if err != nil {
		return
	}
	_ = s.cache.Delete(ctx,
		redisutil.CacheKey("avail", event.Slug),
		redisutil.CacheKey("event", event.Slug),
	)
	_ = s.cache.DeleteByPrefix(ctx, redisutil.CacheKey("events", "list"))
}

func (s *Service) GetBookingExtras(ctx context.Context, bookingID uuid.UUID) (db.BookingExtras, error) {
	return s.queries.GetBookingExtras(ctx, bookingID)
}

func (s *Service) ValidatePromo(ctx context.Context, code string, eventID uuid.UUID, subtotal int64) (*promo.ApplyResult, error) {
	return s.promo.ValidateAndApply(ctx, code, eventID, subtotal)
}

func (s *Service) GetByID(ctx context.Context, userID, bookingID uuid.UUID) (*db.Booking, []db.ListBookingItemsRow, error) {
	booking, err := s.queries.GetBookingByIDForUser(ctx, db.GetBookingByIDForUserParams{
		ID:     bookingID,
		UserID: userID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil, ErrNotFound
		}
		return nil, nil, err
	}
	items, err := s.queries.ListBookingItems(ctx, bookingID)
	return &booking, items, err
}

func (s *Service) ListByUser(ctx context.Context, userID uuid.UUID, page, perPage int) ([]db.ListBookingsByUserRow, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage
	return s.queries.ListBookingsByUser(ctx, db.ListBookingsByUserParams{
		UserID: userID,
		Limit:  int32(perPage),
		Offset: int32(offset),
	})
}

func (s *Service) Cancel(ctx context.Context, userID, bookingID uuid.UUID) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	qtx := s.queries.WithTx(tx)
	booking, err := qtx.GetBookingByIDForUser(ctx, db.GetBookingByIDForUserParams{
		ID:     bookingID,
		UserID: userID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}

	if booking.Status != string(db.BookingStatusHeld) && booking.Status != string(db.BookingStatusPendingPayment) {
		return ErrInvalidStatus
	}

	items, err := qtx.ListBookingItems(ctx, bookingID)
	if err != nil {
		return err
	}

	for _, item := range items {
		if _, err := qtx.DecrementHeldCount(ctx, db.DecrementHeldCountParams{
			ID:        item.TicketTypeID,
			HeldCount: item.Quantity,
		}); err != nil {
			return err
		}
	}

	_, err = qtx.CancelBookingIfActive(ctx, bookingID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrInvalidStatus
		}
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}

	if s.holdStore != nil {
		_ = s.holdStore.ReleaseHold(ctx, bookingID)
	}
	s.invalidateEventCache(ctx, booking.EventID)
	return nil
}

func (s *Service) ConfirmPayment(ctx context.Context, bookingID uuid.UUID) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	qtx := s.queries.WithTx(tx)
	eventID, err := s.confirmPaymentInTx(ctx, qtx, bookingID)
	if err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}

	if s.holdStore != nil {
		_ = s.holdStore.ReleaseHold(ctx, bookingID)
	}
	if eventID != uuid.Nil {
		s.invalidateEventCache(ctx, eventID)
	}
	return nil
}

// ConfirmPaymentInTx confirms a booking inside an existing transaction (used by payment service).
func (s *Service) ConfirmPaymentInTx(ctx context.Context, qtx *db.Queries, bookingID uuid.UUID) error {
	_, err := s.confirmPaymentInTx(ctx, qtx, bookingID)
	return err
}

func (s *Service) confirmPaymentInTx(ctx context.Context, qtx *db.Queries, bookingID uuid.UUID) (uuid.UUID, error) {
	booking, err := qtx.GetBookingByIDForUpdate(ctx, bookingID)
	if err != nil {
		return uuid.Nil, err
	}

	if booking.Status == string(db.BookingStatusConfirmed) {
		return uuid.Nil, nil
	}

	if booking.Status != string(db.BookingStatusHeld) &&
		booking.Status != string(db.BookingStatusPendingPayment) &&
		booking.Status != string(db.BookingStatusExpired) {
		return uuid.Nil, ErrInvalidStatus
	}

	wasExpired := booking.Status == string(db.BookingStatusExpired)

	items, err := qtx.ListBookingItems(ctx, bookingID)
	if err != nil {
		return uuid.Nil, err
	}

	for _, item := range items {
		if wasExpired {
			if _, err := qtx.SellTicketsDirect(ctx, item.TicketTypeID, item.Quantity); err != nil {
				if errors.Is(err, pgx.ErrNoRows) {
					return uuid.Nil, ErrInventoryExhausted
				}
				return uuid.Nil, err
			}
		} else if _, err := qtx.ConfirmSoldTickets(ctx, db.ConfirmSoldTicketsParams{
			ID:        item.TicketTypeID,
			SoldCount: item.Quantity,
		}); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return uuid.Nil, ErrInventoryExhausted
			}
			return uuid.Nil, err
		}
	}

	now := time.Now()
	confirmedAt := pgtype.Timestamptz{Time: now, Valid: true}
	_, err = qtx.ConfirmBookingPayment(ctx, bookingID, confirmedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return uuid.Nil, ErrInvalidStatus
		}
		return uuid.Nil, err
	}

	for _, item := range items {
		for i := int32(0); i < item.Quantity; i++ {
			code, err := s.generateTicketCode(bookingID, item.TicketTypeID)
			if err != nil {
				return uuid.Nil, err
			}
			_, err = qtx.CreateTicket(ctx, db.CreateTicketParams{
				BookingID:    bookingID,
				TicketTypeID: item.TicketTypeID,
				TicketCode:   code,
				Status:       string(db.TicketStatusActive),
			})
			if err != nil {
				return uuid.Nil, err
			}
		}
	}

	extras, _ := qtx.GetBookingExtras(ctx, bookingID)
	if extras.PromoCode.Valid && extras.PromoCode.String != "" {
		_ = s.promo.IncrementOnConfirm(ctx, extras.PromoCode.String)
	}

	return booking.EventID, nil
}

func (s *Service) StartPayment(ctx context.Context, userID, bookingID uuid.UUID) (*db.Booking, error) {
	booking, err := s.queries.GetBookingByIDForUser(ctx, db.GetBookingByIDForUserParams{
		ID:     bookingID,
		UserID: userID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	if booking.Status != string(db.BookingStatusHeld) {
		return nil, ErrInvalidStatus
	}

	if time.Now().After(booking.HoldExpiresAt) {
		return nil, fmt.Errorf("hold expired")
	}

	graceExpiry := time.Now().Add(s.cfg.BookingPaymentGrace)
	updated, err := s.queries.StartPaymentBooking(ctx, bookingID, graceExpiry)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInvalidStatus
		}
		return nil, err
	}
	return &updated, nil
}

func (s *Service) ReleaseOnPaymentFailure(ctx context.Context, bookingID uuid.UUID) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	qtx := s.queries.WithTx(tx)
	booking, err := qtx.GetBookingByID(ctx, bookingID)
	if err != nil {
		return err
	}

	if booking.Status != string(db.BookingStatusHeld) && booking.Status != string(db.BookingStatusPendingPayment) {
		return nil
	}

	items, err := qtx.ListBookingItems(ctx, bookingID)
	if err != nil {
		return err
	}

	for _, item := range items {
		if _, err := qtx.DecrementHeldCount(ctx, db.DecrementHeldCountParams{
			ID:        item.TicketTypeID,
			HeldCount: item.Quantity,
		}); err != nil {
			return err
		}
	}

	_, err = qtx.CancelBookingIfActive(ctx, bookingID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}

	if s.holdStore != nil {
		_ = s.holdStore.ReleaseHold(ctx, bookingID)
	}
	s.invalidateEventCache(ctx, booking.EventID)
	return nil
}

func (s *Service) ExpireHeldBooking(ctx context.Context, bookingID uuid.UUID) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	qtx := s.queries.WithTx(tx)
	booking, err := qtx.GetBookingByIDForUpdate(ctx, bookingID)
	if err != nil {
		return err
	}

	if booking.Status != string(db.BookingStatusHeld) && booking.Status != string(db.BookingStatusPendingPayment) {
		return nil
	}

	items, err := qtx.ListBookingItems(ctx, bookingID)
	if err != nil {
		return err
	}

	for _, item := range items {
		if _, err := qtx.DecrementHeldCount(ctx, db.DecrementHeldCountParams{
			ID:        item.TicketTypeID,
			HeldCount: item.Quantity,
		}); err != nil {
			return err
		}
	}

	_, err = qtx.ExpireBookingIfActive(ctx, bookingID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}

	if s.holdStore != nil {
		_ = s.holdStore.ReleaseHold(ctx, bookingID)
	}
	s.invalidateEventCache(ctx, booking.EventID)
	return nil
}

func (s *Service) generateTicketCode(bookingID, ticketTypeID uuid.UUID) (string, error) {
	raw := uuid.New().String()
	mac := hmac.New(sha256.New, []byte(s.cfg.TicketSigningKey))
	mac.Write([]byte(bookingID.String()))
	mac.Write([]byte(ticketTypeID.String()))
	mac.Write([]byte(raw))
	sig := hex.EncodeToString(mac.Sum(nil))[:16]
	return fmt.Sprintf("TKT-%s-%s", raw[:8], sig), nil
}

func BookingToMap(b db.Booking, items []db.ListBookingItemsRow) map[string]interface{} {
	return BookingToMapWithExtras(b, items, db.BookingExtras{})
}

func BookingToMapWithExtras(b db.Booking, items []db.ListBookingItemsRow, extras db.BookingExtras) map[string]interface{} {
	m := map[string]interface{}{
		"id":              b.ID,
		"user_id":         b.UserID,
		"event_id":        b.EventID,
		"status":          b.Status,
		"hold_expires_at": b.HoldExpiresAt,
		"total_amount":    b.TotalAmount,
		"created_at":      b.CreatedAt,
	}
	if extras.SubtotalAmount > 0 {
		m["subtotal_amount"] = extras.SubtotalAmount
	}
	if extras.DiscountAmount > 0 {
		m["discount_amount"] = extras.DiscountAmount
	}
	if extras.PromoCode.Valid {
		m["promo_code"] = extras.PromoCode.String
	}
	if b.ConfirmedAt.Valid {
		m["confirmed_at"] = b.ConfirmedAt.Time
	}

	itemMaps := make([]map[string]interface{}, 0, len(items))
	for _, it := range items {
		itemMaps = append(itemMaps, map[string]interface{}{
			"id":               it.ID,
			"ticket_type_id":   it.TicketTypeID,
			"ticket_type_name": it.TicketTypeName,
			"quantity":         it.Quantity,
			"unit_price":       it.UnitPrice,
		})
	}
	m["items"] = itemMaps
	return m
}
