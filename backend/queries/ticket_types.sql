-- name: CreateTicketType :one
INSERT INTO ticket_types (
    event_id, name, price, total_quota, max_per_order, sales_start_at, sales_end_at
) VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: ListTicketTypesByEvent :many
SELECT * FROM ticket_types WHERE event_id = $1 ORDER BY price ASC;

-- name: GetTicketTypeByID :one
SELECT * FROM ticket_types WHERE id = $1;

-- name: GetTicketTypeForUpdate :one
SELECT * FROM ticket_types WHERE id = $1 FOR UPDATE;

-- name: IncrementHeldCount :one
UPDATE ticket_types
SET held_count = held_count + $2,
    version = version + 1,
    updated_at = NOW()
WHERE id = $1
  AND (total_quota - sold_count - held_count) >= $2
RETURNING *;

-- name: DecrementHeldCount :one
UPDATE ticket_types
SET held_count = held_count - $2,
    version = version + 1,
    updated_at = NOW()
WHERE id = $1 AND held_count >= $2
RETURNING *;

-- name: ConfirmSoldTickets :one
UPDATE ticket_types
SET sold_count = sold_count + $2,
    held_count = held_count - $2,
    version = version + 1,
    updated_at = NOW()
WHERE id = $1 AND held_count >= $2
RETURNING *;
