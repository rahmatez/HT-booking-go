-- name: CreateBooking :one
INSERT INTO bookings (user_id, event_id, status, hold_expires_at, total_amount, idempotency_key)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetBookingByID :one
SELECT * FROM bookings WHERE id = $1;

-- name: GetBookingByIDForUser :one
SELECT * FROM bookings WHERE id = $1 AND user_id = $2;

-- name: GetBookingByIdempotencyKey :one
SELECT * FROM bookings WHERE idempotency_key = $1;

-- name: GetBookingByIdempotencyKeyForUser :one
SELECT * FROM bookings WHERE idempotency_key = $1 AND user_id = $2;

-- name: ListBookingsByUser :many
SELECT b.*, e.title AS event_title, e.slug AS event_slug, e.starts_at AS event_starts_at
FROM bookings b
JOIN events e ON b.event_id = e.id
WHERE b.user_id = $1
ORDER BY b.created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountActiveHoldsByUser :one
SELECT COUNT(*) FROM bookings
WHERE user_id = $1 AND status IN ('held', 'pending_payment');

-- name: CountActiveHoldsByUserForEvent :one
SELECT COUNT(*) FROM bookings
WHERE user_id = $1 AND event_id = $2 AND status IN ('held', 'pending_payment');

-- name: UpdateBookingStatus :one
UPDATE bookings SET status = $2, confirmed_at = $3
WHERE id = $1
RETURNING *;

-- name: StartPaymentBooking :one
UPDATE bookings
SET status = 'pending_payment', hold_expires_at = $2
WHERE id = $1 AND status = 'held' AND hold_expires_at > NOW()
RETURNING *;

-- name: ConfirmBookingPayment :one
UPDATE bookings SET status = 'confirmed', confirmed_at = $2
WHERE id = $1 AND status IN ('held', 'pending_payment', 'expired')
RETURNING *;

-- name: CancelBookingIfActive :one
UPDATE bookings SET status = 'cancelled'
WHERE id = $1 AND status IN ('held', 'pending_payment')
RETURNING *;

-- name: ExpireBookingIfActive :one
UPDATE bookings SET status = 'expired'
WHERE id = $1 AND status IN ('held', 'pending_payment')
RETURNING *;

-- name: ListExpiredHeldBookings :many
SELECT * FROM bookings
WHERE status = 'held' AND hold_expires_at < NOW()
LIMIT $1;

-- name: ListExpiredPendingPaymentBookings :many
SELECT * FROM bookings
WHERE status = 'pending_payment' AND hold_expires_at < NOW()
LIMIT $1;

-- name: CreateBookingItem :one
INSERT INTO booking_items (booking_id, ticket_type_id, quantity, unit_price)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetBookingByIDAdmin :one
SELECT b.*,
       u.email AS user_email,
       u.full_name AS user_name,
       e.title AS event_title,
       e.slug AS event_slug
FROM bookings b
JOIN users u ON b.user_id = u.id
JOIN events e ON b.event_id = e.id
WHERE b.id = $1;

-- name: ListBookingItems :many
SELECT bi.*, tt.name AS ticket_type_name
FROM booking_items bi
JOIN ticket_types tt ON bi.ticket_type_id = tt.id
WHERE bi.booking_id = $1;
