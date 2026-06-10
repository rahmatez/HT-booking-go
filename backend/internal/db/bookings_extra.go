package db

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func scanBooking(row interface {
	Scan(dest ...any) error
}) (Booking, error) {
	var i Booking
	err := row.Scan(
		&i.ID,
		&i.UserID,
		&i.EventID,
		&i.Status,
		&i.HoldExpiresAt,
		&i.TotalAmount,
		&i.IdempotencyKey,
		&i.CreatedAt,
		&i.ConfirmedAt,
	)
	return i, err
}

const getBookingByIdempotencyKeyForUser = `
SELECT id, user_id, event_id, status, hold_expires_at, total_amount, idempotency_key, created_at, confirmed_at
FROM bookings WHERE idempotency_key = $1 AND user_id = $2`

func (q *Queries) GetBookingByIdempotencyKeyForUser(ctx context.Context, idempotencyKey string, userID uuid.UUID) (Booking, error) {
	row := q.db.QueryRow(ctx, getBookingByIdempotencyKeyForUser, idempotencyKey, userID)
	return scanBooking(row)
}

const startPaymentBooking = `
UPDATE bookings
SET status = 'pending_payment', hold_expires_at = $2
WHERE id = $1 AND status = 'held' AND hold_expires_at > NOW()
RETURNING id, user_id, event_id, status, hold_expires_at, total_amount, idempotency_key, created_at, confirmed_at`

func (q *Queries) StartPaymentBooking(ctx context.Context, id uuid.UUID, holdExpiresAt time.Time) (Booking, error) {
	row := q.db.QueryRow(ctx, startPaymentBooking, id, holdExpiresAt)
	return scanBooking(row)
}

const confirmBookingPayment = `
UPDATE bookings SET status = 'confirmed', confirmed_at = $2
WHERE id = $1 AND status IN ('held', 'pending_payment', 'expired')
RETURNING id, user_id, event_id, status, hold_expires_at, total_amount, idempotency_key, created_at, confirmed_at`

func (q *Queries) ConfirmBookingPayment(ctx context.Context, id uuid.UUID, confirmedAt pgtype.Timestamptz) (Booking, error) {
	row := q.db.QueryRow(ctx, confirmBookingPayment, id, confirmedAt)
	return scanBooking(row)
}

const cancelBookingIfActive = `
UPDATE bookings SET status = 'cancelled'
WHERE id = $1 AND status IN ('held', 'pending_payment')
RETURNING id, user_id, event_id, status, hold_expires_at, total_amount, idempotency_key, created_at, confirmed_at`

func (q *Queries) CancelBookingIfActive(ctx context.Context, id uuid.UUID) (Booking, error) {
	row := q.db.QueryRow(ctx, cancelBookingIfActive, id)
	return scanBooking(row)
}

const expireBookingIfActive = `
UPDATE bookings SET status = 'expired'
WHERE id = $1 AND status IN ('held', 'pending_payment')
RETURNING id, user_id, event_id, status, hold_expires_at, total_amount, idempotency_key, created_at, confirmed_at`

func (q *Queries) ExpireBookingIfActive(ctx context.Context, id uuid.UUID) (Booking, error) {
	row := q.db.QueryRow(ctx, expireBookingIfActive, id)
	return scanBooking(row)
}

const getBookingByIDForUpdate = `
SELECT id, user_id, event_id, status, hold_expires_at, total_amount, idempotency_key, created_at, confirmed_at
FROM bookings WHERE id = $1 FOR UPDATE`

func (q *Queries) GetBookingByIDForUpdate(ctx context.Context, id uuid.UUID) (Booking, error) {
	row := q.db.QueryRow(ctx, getBookingByIDForUpdate, id)
	return scanBooking(row)
}

type BookingExtras struct {
	PromoCode      pgtype.Text
	DiscountAmount int64
	SubtotalAmount int64
}

func (q *Queries) GetBookingExtras(ctx context.Context, bookingID uuid.UUID) (BookingExtras, error) {
	var e BookingExtras
	err := q.db.QueryRow(ctx, `
		SELECT promo_code, discount_amount, subtotal_amount FROM bookings WHERE id = $1
	`, bookingID).Scan(&e.PromoCode, &e.DiscountAmount, &e.SubtotalAmount)
	return e, err
}

type CreateBookingWithPromoParams struct {
	UserID         uuid.UUID
	EventID        uuid.UUID
	Status         string
	HoldExpiresAt  time.Time
	SubtotalAmount int64
	DiscountAmount int64
	TotalAmount    int64
	PromoCode      string
	IdempotencyKey string
}

func (q *Queries) CreateBookingWithPromo(ctx context.Context, arg CreateBookingWithPromoParams) (Booking, error) {
	var promo pgtype.Text
	if arg.PromoCode != "" {
		promo = pgtype.Text{String: arg.PromoCode, Valid: true}
	}
	row := q.db.QueryRow(ctx, `
		INSERT INTO bookings (user_id, event_id, status, hold_expires_at, subtotal_amount, discount_amount, total_amount, promo_code, idempotency_key)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, user_id, event_id, status, hold_expires_at, total_amount, idempotency_key, created_at, confirmed_at
	`, arg.UserID, arg.EventID, arg.Status, arg.HoldExpiresAt, arg.SubtotalAmount, arg.DiscountAmount, arg.TotalAmount, promo, arg.IdempotencyKey)
	return scanBooking(row)
}

func (q *Queries) CountUserConfirmedTicketsForEvent(ctx context.Context, userID, eventID uuid.UUID) (int64, error) {
	var n int64
	err := q.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(bi.quantity), 0)::bigint
		FROM bookings b
		JOIN booking_items bi ON bi.booking_id = b.id
		WHERE b.user_id = $1 AND b.event_id = $2 AND b.status = 'confirmed'
	`, userID, eventID).Scan(&n)
	return n, err
}
