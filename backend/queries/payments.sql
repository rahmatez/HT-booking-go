-- name: CreatePayment :one
INSERT INTO payments (booking_id, gateway, gateway_ref, amount, status, idempotency_key)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetPaymentByID :one
SELECT * FROM payments WHERE id = $1;

-- name: GetPaymentByBookingID :one
SELECT * FROM payments WHERE booking_id = $1 ORDER BY created_at DESC LIMIT 1;

-- name: UpdatePaymentStatus :one
UPDATE payments SET status = $2, paid_at = $3, gateway_ref = $4, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: GetPendingPaymentByBookingID :one
SELECT * FROM payments
WHERE booking_id = $1 AND status = 'pending'
ORDER BY created_at DESC
LIMIT 1;

-- name: GetPaymentByOrderID :one
SELECT p.* FROM payments p
JOIN bookings b ON b.id = p.booking_id
WHERE b.id::text = $1
ORDER BY p.created_at DESC
LIMIT 1;
