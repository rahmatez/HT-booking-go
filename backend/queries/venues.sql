-- name: CreateVenue :one
INSERT INTO venues (name, address, city, capacity, latitude, longitude)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetVenueByID :one
SELECT * FROM venues WHERE id = $1;

-- name: ListVenues :many
SELECT * FROM venues ORDER BY name ASC;
