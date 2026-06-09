-- name: ListAllEvents :many
SELECT e.*, v.name AS venue_name, v.city AS venue_city
FROM events e
LEFT JOIN venues v ON e.venue_id = v.id
WHERE ($1::text IS NULL OR $1 = '' OR e.status::text = $1)
  AND ($2::text IS NULL OR $2 = '' OR e.title ILIKE '%' || $2 || '%')
ORDER BY e.created_at DESC
LIMIT $3 OFFSET $4;

-- name: CountAllEvents :one
SELECT COUNT(*) FROM events e
WHERE ($1::text IS NULL OR $1 = '' OR e.status::text = $1)
  AND ($2::text IS NULL OR $2 = '' OR e.title ILIKE '%' || $2 || '%');

-- name: AdminListBookings :many
SELECT b.*,
       u.email AS user_email,
       u.full_name AS user_name,
       e.title AS event_title,
       e.slug AS event_slug
FROM bookings b
JOIN users u ON b.user_id = u.id
JOIN events e ON b.event_id = e.id
WHERE ($1::text IS NULL OR $1 = '' OR b.status::text = $1)
  AND ($2::text IS NULL OR $2 = '' OR b.event_id = $2::uuid)
ORDER BY b.created_at DESC
LIMIT $3 OFFSET $4;

-- name: CountAdminBookings :one
SELECT COUNT(*) FROM bookings b
WHERE ($1::text IS NULL OR $1 = '' OR b.status::text = $1)
  AND ($2::text IS NULL OR $2 = '' OR b.event_id = $2::uuid);

-- name: AdminDashboardStats :one
SELECT
    (SELECT COUNT(*) FROM events) AS total_events,
    (SELECT COUNT(*) FROM events WHERE status = 'published') AS published_events,
    (SELECT COUNT(*) FROM bookings) AS total_bookings,
    (SELECT COUNT(*) FROM bookings WHERE status = 'confirmed') AS confirmed_bookings,
    (SELECT COALESCE(SUM(total_amount), 0) FROM bookings WHERE status = 'confirmed') AS total_revenue,
    (SELECT COALESCE(SUM(sold_count), 0) FROM ticket_types) AS tickets_sold;
