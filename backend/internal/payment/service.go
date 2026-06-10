package payment

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/rahmatez/high-traffic-booking/backend/internal/booking"
	"github.com/rahmatez/high-traffic-booking/backend/internal/config"
	"github.com/rahmatez/high-traffic-booking/backend/internal/db"
	"github.com/rahmatez/high-traffic-booking/backend/internal/payment/midtrans"
)

var (
	ErrNotConfigured = errors.New("payment gateway not configured")
	ErrNotFound      = errors.New("payment not found")
	ErrAmountMismatch = errors.New("payment amount mismatch")
)

type CheckoutResult struct {
	SnapToken    string `json:"snap_token"`
	ClientKey    string `json:"client_key"`
	OrderID      string `json:"order_id"`
	BookingID    string `json:"booking_id"`
	TotalAmount  int64  `json:"total_amount"`
	Gateway      string `json:"gateway"`
	IsProduction bool   `json:"is_production"`
}

type OnPaymentConfirmed func(ctx context.Context, bookingID uuid.UUID)

type Service struct {
	pool        *pgxpool.Pool
	queries     *db.Queries
	booking     *booking.Service
	midtrans    *midtrans.Client
	cfg         *config.Config
	frontendURL string
	onConfirmed OnPaymentConfirmed
}

func NewService(pool *pgxpool.Pool, queries *db.Queries, bookingSvc *booking.Service, mt *midtrans.Client, cfg *config.Config) *Service {
	frontendURL := cfg.FrontendURL
	if frontendURL == "" && len(cfg.CORSAllowedOrigins) > 0 {
		frontendURL = cfg.CORSAllowedOrigins[0]
	}
	return &Service{
		pool:        pool,
		queries:     queries,
		booking:     bookingSvc,
		midtrans:    mt,
		cfg:         cfg,
		frontendURL: frontendURL,
	}
}

func (s *Service) SetOnConfirmed(fn OnPaymentConfirmed) {
	s.onConfirmed = fn
}

func (s *Service) ReconcilePayment(ctx context.Context, bookingID uuid.UUID) error {
	if !s.midtrans.IsConfigured() {
		return ErrNotConfigured
	}
	status, err := s.midtrans.GetTransactionStatus(ctx, bookingID.String())
	if err != nil {
		return err
	}
	return s.applyTransactionStatus(ctx, bookingID, *status)
}

func (s *Service) Checkout(ctx context.Context, userID, bookingID uuid.UUID) (*CheckoutResult, error) {
	if !s.midtrans.IsConfigured() {
		return nil, ErrNotConfigured
	}

	b, items, err := s.booking.GetByID(ctx, userID, bookingID)
	if err != nil {
		return nil, err
	}

	if b.Status == string(db.BookingStatusHeld) {
		if time.Now().After(b.HoldExpiresAt) {
			return nil, fmt.Errorf("hold expired")
		}
		if _, err := s.booking.StartPayment(ctx, userID, bookingID); err != nil {
			return nil, err
		}
	} else if b.Status != string(db.BookingStatusPendingPayment) {
		return nil, booking.ErrInvalidStatus
	}

	user, err := s.queries.GetUserByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	orderID := bookingID.String()
	itemDetails := make([]midtrans.ItemDetail, 0, len(items))
	for _, it := range items {
		itemDetails = append(itemDetails, midtrans.ItemDetail{
			ID:       it.TicketTypeID.String(),
			Name:     it.TicketTypeName,
			Price:    it.UnitPrice,
			Quantity: it.Quantity,
		})
	}

	phone := ""
	if user.Phone.Valid {
		phone = user.Phone.String
	}

	snapReq := midtrans.SnapRequest{
		TransactionDetails: midtrans.TransactionDetails{
			OrderID:     orderID,
			GrossAmount: b.TotalAmount,
		},
		CustomerDetails: midtrans.CustomerDetails{
			FirstName: user.FullName,
			Email:     user.Email,
			Phone:     phone,
		},
		ItemDetails: itemDetails,
		Callbacks: &midtrans.Callbacks{
			Finish: fmt.Sprintf("%s/bookings/%s?payment=finish", s.frontendURL, bookingID),
		},
	}

	snap, err := s.midtrans.CreateSnapTransaction(ctx, snapReq)
	if err != nil {
		return nil, fmt.Errorf("create snap: %w", err)
	}

	payment, err := s.queries.GetPendingPaymentByBookingID(ctx, bookingID)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}

	if errors.Is(err, pgx.ErrNoRows) {
		_, err = s.queries.CreatePayment(ctx, db.CreatePaymentParams{
			BookingID:      bookingID,
			Gateway:        "midtrans",
			GatewayRef:     pgtype.Text{String: snap.Token, Valid: true},
			Amount:         b.TotalAmount,
			Status:         string(db.PaymentStatusPending),
			IdempotencyKey: pgtype.Text{String: "midtrans-" + orderID, Valid: true},
		})
		if err != nil {
			return nil, err
		}
	} else {
		_, err = s.queries.UpdatePaymentStatus(ctx, db.UpdatePaymentStatusParams{
			ID:         payment.ID,
			Status:     string(db.PaymentStatusPending),
			PaidAt:     pgtype.Timestamptz{},
			GatewayRef: pgtype.Text{String: snap.Token, Valid: true},
		})
		if err != nil {
			return nil, err
		}
	}

	return &CheckoutResult{
		SnapToken:    snap.Token,
		ClientKey:    s.midtrans.ClientKey(),
		OrderID:      orderID,
		BookingID:    bookingID.String(),
		TotalAmount:  b.TotalAmount,
		Gateway:      "midtrans",
		IsProduction: s.cfg.MidtransIsProduction,
	}, nil
}

func (s *Service) HandleMidtransNotification(ctx context.Context, notif midtrans.TransactionStatus) error {
	if !s.midtrans.IsConfigured() {
		return ErrNotConfigured
	}

	if !midtrans.VerifyNotificationSignature(
		notif.OrderID,
		notif.StatusCode,
		notif.GrossAmount,
		s.cfg.MidtransServerKey,
		notif.SignatureKey,
	) {
		return fmt.Errorf("invalid signature")
	}

	status, err := s.midtrans.GetTransactionStatus(ctx, notif.OrderID)
	if err != nil {
		return err
	}

	bookingID, err := uuid.Parse(notif.OrderID)
	if err != nil {
		return fmt.Errorf("invalid order id")
	}

	return s.applyTransactionStatus(ctx, bookingID, *status)
}

func (s *Service) SyncBookingPayment(ctx context.Context, userID, bookingID uuid.UUID) (string, error) {
	if !s.midtrans.IsConfigured() {
		return "", ErrNotConfigured
	}

	if _, _, err := s.booking.GetByID(ctx, userID, bookingID); err != nil {
		return "", err
	}

	status, err := s.midtrans.GetTransactionStatus(ctx, bookingID.String())
	if err != nil {
		return "", err
	}

	if err := s.applyTransactionStatus(ctx, bookingID, *status); err != nil {
		return "", err
	}

	b, _, err := s.booking.GetByID(ctx, userID, bookingID)
	if err != nil {
		return "", err
	}
	return b.Status, nil
}

func (s *Service) applyTransactionStatus(ctx context.Context, bookingID uuid.UUID, status midtrans.TransactionStatus) error {
	paymentRow, err := s.queries.GetPaymentByOrderID(ctx, bookingID.String())
	hasPayment := err == nil

	switch {
	case midtrans.IsPaymentSuccess(status.TransactionStatus, status.FraudStatus):
		amount, err := parseMidtransAmount(status.GrossAmount)
		if err != nil {
			return err
		}

		tx, err := s.pool.Begin(ctx)
		if err != nil {
			return err
		}
		defer tx.Rollback(ctx)

		qtx := s.queries.WithTx(tx)
		bookingRow, err := qtx.GetBookingByID(ctx, bookingID)
		if err != nil {
			return err
		}
		if amount != bookingRow.TotalAmount {
			return ErrAmountMismatch
		}

		if err := s.booking.ConfirmPaymentInTx(ctx, qtx, bookingID); err != nil {
			return err
		}

		if hasPayment {
			now := time.Now()
			if _, err = qtx.UpdatePaymentStatus(ctx, db.UpdatePaymentStatusParams{
				ID:         paymentRow.ID,
				Status:     string(db.PaymentStatusSuccess),
				PaidAt:     pgtype.Timestamptz{Time: now, Valid: true},
				GatewayRef: pgtype.Text{String: status.TransactionID, Valid: status.TransactionID != ""},
			}); err != nil {
				return err
			}
		}

		if err := tx.Commit(ctx); err != nil {
			return err
		}
		s.booking.AfterConfirm(ctx, bookingID, bookingRow.EventID)
		if s.onConfirmed != nil {
			s.onConfirmed(ctx, bookingID)
		}
		return nil

	case midtrans.IsPaymentFailed(status.TransactionStatus):
		if hasPayment {
			if _, err = s.queries.UpdatePaymentStatus(ctx, db.UpdatePaymentStatusParams{
				ID:         paymentRow.ID,
				Status:     string(db.PaymentStatusFailed),
				PaidAt:     pgtype.Timestamptz{},
				GatewayRef: pgtype.Text{String: status.TransactionID, Valid: status.TransactionID != ""},
			}); err != nil {
				return err
			}
		}
		return s.booking.ReleaseOnPaymentFailure(ctx, bookingID)
	}

	return nil
}
