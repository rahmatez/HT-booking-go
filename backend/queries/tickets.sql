-- name: CreateTicket :one
INSERT INTO tickets (booking_id, ticket_type_id, ticket_code, status)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: ListTicketsByBooking :many
SELECT t.*, tt.name AS ticket_type_name
FROM tickets t
JOIN ticket_types tt ON t.ticket_type_id = tt.id
WHERE t.booking_id = $1;

-- name: GetTicketByCode :one
SELECT * FROM tickets WHERE ticket_code = $1;
