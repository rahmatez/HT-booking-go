package db

import (
	"context"
)

const getPublishedEventBySlug = `
SELECT id, slug, title, description, venue_id, cover_image_url, status, starts_at, ends_at, metadata, created_at, updated_at
FROM events WHERE slug = $1 AND status = 'published'`

func (q *Queries) GetPublishedEventBySlug(ctx context.Context, slug string) (Event, error) {
	row := q.db.QueryRow(ctx, getPublishedEventBySlug, slug)
	var i Event
	err := row.Scan(
		&i.ID,
		&i.Slug,
		&i.Title,
		&i.Description,
		&i.VenueID,
		&i.CoverImageUrl,
		&i.Status,
		&i.StartsAt,
		&i.EndsAt,
		&i.Metadata,
		&i.CreatedAt,
		&i.UpdatedAt,
	)
	return i, err
}
