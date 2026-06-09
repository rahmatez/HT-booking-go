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
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/rahmatez/high-traffic-booking/backend/internal/config"
	"github.com/rahmatez/high-traffic-booking/backend/internal/db"
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
	EventID uuid.UUID  `json:"event_id"`
	Items   []HoldItem `json:"items"`
}

type Service struct {
	pool    *pgxpool.Pool
	queries *db.Queries
	cfg     *config.Config
}

func NewService(pool *pgxpool.Pool, queries *db.Queries, cfg *config.Config) *Service {
	return &Service{pool: pool, queries: queries, cfg: cfg}
}

func (s *Service) Hold(ctx context.Context, userID uuid.UUID, idempotencyKey string, in HoldInput) (*db.Booking, []db.ListBookingItemsRow, error) {
	if idempotencyKey == "" {
		return nil, nil, fmt.Errorf("idempotency key required")
	}
	if len(in.Items) == 0 {
		return nil, nil, fmt.Errorf("at least one item required")
	}

	existing, err := s.queries.GetBookingByIdempotencyKey(ctx, idempotencyKey)
	if err == nil {
		items, _ := s.queries.ListBookingItems(ctx, existing.ID)
		return &existing, items, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
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

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, nil, err
	}
	defer tx.Rollback(ctx)

	qtx := s.queries.WithTx(tx)

	var total int64
	for _, item := range in.Items {
		if item.Quantity <= 0 {
			return nil, nil, fmt.Errorf("invalid quantity")
		}
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

		now := time.Now()
		if now.Before(tt.SalesStartAt) || now.After(tt.SalesEndAt) {
			return nil, nil, fmt.Errorf("ticket sales not open")
		}

		updated, err := qtx.IncrementHeldCount(ctx, db.IncrementHeldCountParams{
			ID:  item.TicketTypeID,
			HeldCount: item.Quantity,
		})
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, nil, ErrInventoryExhausted
			}
			return nil, nil, err
		}
		_ = updated
		total += int64(tt.Price) * int64(item.Quantity)
	}

	holdExpires := time.Now().Add(s.cfg.BookingHoldTTL)
	booking, err := qtx.CreateBooking(ctx, db.CreateBookingParams{
		UserID:         userID,
		EventID:        in.EventID,
		Status:         string(db.BookingStatusHeld),
		HoldExpiresAt:  holdExpires,
		TotalAmount:    total,
		IdempotencyKey: idempotencyKey,
	})
	if err != nil {
		return nil, nil, err
	}

	for _, item := range in.Items {
		tt, _ := qtx.GetTicketTypeByID(ctx, item.TicketTypeID)
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

	var confirmedAt pgtype.Timestamptz
	_, err = qtx.UpdateBookingStatus(ctx, db.UpdateBookingStatusParams{
		ID:          bookingID,
		Status:      string(db.BookingStatusCancelled),
		ConfirmedAt: confirmedAt,
	})
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (s *Service) ConfirmPayment(ctx context.Context, bookingID uuid.UUID) error {
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

	if booking.Status == string(db.BookingStatusConfirmed) {
		return tx.Commit(ctx)
	}

	if booking.Status != string(db.BookingStatusHeld) &&
		booking.Status != string(db.BookingStatusPendingPayment) &&
		booking.Status != string(db.BookingStatusExpired) {
		return ErrInvalidStatus
	}

	items, err := qtx.ListBookingItems(ctx, bookingID)
	if err != nil {
		return err
	}

	for _, item := range items {
		if _, err := qtx.ConfirmSoldTickets(ctx, db.ConfirmSoldTicketsParams{
			ID:        item.TicketTypeID,
			SoldCount: item.Quantity,
		}); err != nil {
			return err
		}
	}

	now := time.Now()
	var confirmedAt pgtype.Timestamptz
	confirmedAt = pgtype.Timestamptz{Time: now, Valid: true}
	_, err = qtx.UpdateBookingStatus(ctx, db.UpdateBookingStatusParams{
		ID:          bookingID,
		Status:      string(db.BookingStatusConfirmed),
		ConfirmedAt: confirmedAt,
	})
	if err != nil {
		return err
	}

	for _, item := range items {
		for i := int32(0); i < item.Quantity; i++ {
			code, err := s.generateTicketCode(bookingID, item.TicketTypeID)
			if err != nil {
				return err
			}
			_, err = qtx.CreateTicket(ctx, db.CreateTicketParams{
				BookingID:    bookingID,
				TicketTypeID: item.TicketTypeID,
				TicketCode:   code,
				Status:       string(db.TicketStatusActive),
			})
			if err != nil {
				return err
			}
		}
	}

	return tx.Commit(ctx)
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

	var confirmedAt pgtype.Timestamptz
	updated, err := s.queries.UpdateBookingStatus(ctx, db.UpdateBookingStatusParams{
		ID:          bookingID,
		Status:      string(db.BookingStatusPendingPayment),
		ConfirmedAt: confirmedAt,
	})
	if err != nil {
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

	var confirmedAt pgtype.Timestamptz
	_, err = qtx.UpdateBookingStatus(ctx, db.UpdateBookingStatusParams{
		ID:          bookingID,
		Status:      string(db.BookingStatusCancelled),
		ConfirmedAt: confirmedAt,
	})
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (s *Service) ExpireHeldBooking(ctx context.Context, bookingID uuid.UUID) error {
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

	var confirmedAt pgtype.Timestamptz
	_, err = qtx.UpdateBookingStatus(ctx, db.UpdateBookingStatusParams{
		ID:          bookingID,
		Status:      string(db.BookingStatusExpired),
		ConfirmedAt: confirmedAt,
	})
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
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
	m := map[string]interface{}{
		"id":              b.ID,
		"user_id":         b.UserID,
		"event_id":        b.EventID,
		"status":          b.Status,
		"hold_expires_at": b.HoldExpiresAt,
		"total_amount":    b.TotalAmount,
		"created_at":      b.CreatedAt,
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
