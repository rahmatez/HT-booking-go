-- name: CreateEvent :one
INSERT INTO events (slug, title, description, venue_id, cover_image_url, status, starts_at, ends_at, metadata)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- name: UpdateEvent :one
UPDATE events
SET title = $2, description = $3, venue_id = $4, cover_image_url = $5,
    status = $6, starts_at = $7, ends_at = $8, metadata = $9, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: GetEventByID :one
SELECT * FROM events WHERE id = $1;

-- name: GetEventBySlug :one
SELECT * FROM events WHERE slug = $1;

-- name: ListPublishedEvents :many
SELECT e.*, v.name AS venue_name, v.city AS venue_city
FROM events e
LEFT JOIN venues v ON e.venue_id = v.id
WHERE e.status = 'published'
  AND ($1::text IS NULL OR $1 = '' OR e.title ILIKE '%' || $1 || '%' OR v.city ILIKE '%' || $1 || '%')
ORDER BY e.starts_at ASC
LIMIT $2 OFFSET $3;

-- name: CountPublishedEvents :one
SELECT COUNT(*) FROM events e
LEFT JOIN venues v ON e.venue_id = v.id
WHERE e.status = 'published'
  AND ($1::text IS NULL OR $1 = '' OR e.title ILIKE '%' || $1 || '%' OR v.city ILIKE '%' || $1 || '%');

-- name: DeleteEvent :exec
DELETE FROM events WHERE id = $1;
