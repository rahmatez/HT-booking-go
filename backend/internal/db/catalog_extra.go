package db

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

type PublishedEventRow struct {
	ID            uuid.UUID
	Slug          string
	Title         string
	Description   string
	VenueID       pgtype.UUID
	CoverImageUrl pgtype.Text
	Status        string
	StartsAt      time.Time
	EndsAt        time.Time
	CategoryID    pgtype.UUID
	CategoryName  pgtype.Text
	CategorySlug  pgtype.Text
	VenueName     pgtype.Text
	VenueCity     pgtype.Text
	CreatedAt     time.Time
}

func (q *Queries) ListCategories(ctx context.Context) ([]EventCategory, error) {
	rows, err := q.db.Query(ctx, `
		SELECT id, slug, name, sort_order, created_at FROM event_categories ORDER BY sort_order, name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []EventCategory
	for rows.Next() {
		var c EventCategory
		if err := rows.Scan(&c.ID, &c.Slug, &c.Name, &c.SortOrder, &c.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, c)
	}
	return items, rows.Err()
}

func (q *Queries) CreateCategory(ctx context.Context, slug, name string, sortOrder int32) (EventCategory, error) {
	var c EventCategory
	err := q.db.QueryRow(ctx, `
		INSERT INTO event_categories (slug, name, sort_order) VALUES ($1, $2, $3)
		RETURNING id, slug, name, sort_order, created_at
	`, slug, name, sortOrder).Scan(&c.ID, &c.Slug, &c.Name, &c.SortOrder, &c.CreatedAt)
	return c, err
}

func (q *Queries) ListActiveBanners(ctx context.Context) ([]Banner, error) {
	rows, err := q.db.Query(ctx, `
		SELECT id, title, subtitle, image_url, link_url, sort_order, active, created_at
		FROM banners WHERE active = true ORDER BY sort_order, created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []Banner
	for rows.Next() {
		var b Banner
		if err := rows.Scan(&b.ID, &b.Title, &b.Subtitle, &b.ImageURL, &b.LinkURL, &b.SortOrder, &b.Active, &b.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, b)
	}
	return items, rows.Err()
}

func (q *Queries) ListAllBanners(ctx context.Context) ([]Banner, error) {
	rows, err := q.db.Query(ctx, `
		SELECT id, title, subtitle, image_url, link_url, sort_order, active, created_at
		FROM banners ORDER BY sort_order, created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []Banner
	for rows.Next() {
		var b Banner
		if err := rows.Scan(&b.ID, &b.Title, &b.Subtitle, &b.ImageURL, &b.LinkURL, &b.SortOrder, &b.Active, &b.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, b)
	}
	return items, rows.Err()
}

func (q *Queries) CreateBanner(ctx context.Context, b Banner) (Banner, error) {
	err := q.db.QueryRow(ctx, `
		INSERT INTO banners (title, subtitle, image_url, link_url, sort_order, active)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, title, subtitle, image_url, link_url, sort_order, active, created_at
	`, b.Title, b.Subtitle, b.ImageURL, b.LinkURL, b.SortOrder, b.Active).Scan(
		&b.ID, &b.Title, &b.Subtitle, &b.ImageURL, &b.LinkURL, &b.SortOrder, &b.Active, &b.CreatedAt)
	return b, err
}

func (q *Queries) ListPublishedEventsFiltered(ctx context.Context, search, categorySlug, city, dateFrom, dateTo string, priceMin, priceMax int64, limit, offset int32) ([]PublishedEventRow, error) {
	rows, err := q.db.Query(ctx, `
		SELECT e.id, e.slug, e.title, e.description, e.venue_id, e.cover_image_url, e.status,
		       e.starts_at, e.ends_at, e.category_id, c.name, c.slug, v.name, v.city, e.created_at
		FROM events e
		LEFT JOIN venues v ON e.venue_id = v.id
		LEFT JOIN event_categories c ON e.category_id = c.id
		WHERE e.status = 'published'
		  AND ($1::text IS NULL OR $1 = '' OR e.title ILIKE '%' || $1 || '%' OR v.city ILIKE '%' || $1 || '%')
		  AND ($2::text IS NULL OR $2 = '' OR c.slug = $2)
		  AND ($3::text IS NULL OR $3 = '' OR v.city ILIKE '%' || $3 || '%')
		  AND ($4::text IS NULL OR $4 = '' OR e.starts_at::date >= $4::date)
		  AND ($5::text IS NULL OR $5 = '' OR e.starts_at::date <= $5::date)
		  AND ($6::bigint IS NULL OR $6 = 0 OR EXISTS (
		        SELECT 1 FROM ticket_types tt WHERE tt.event_id = e.id AND tt.price >= $6))
		  AND ($7::bigint IS NULL OR $7 = 0 OR EXISTS (
		        SELECT 1 FROM ticket_types tt WHERE tt.event_id = e.id AND tt.price <= $7))
		ORDER BY e.starts_at ASC
		LIMIT $8 OFFSET $9
	`, search, categorySlug, city, dateFrom, dateTo, priceMin, priceMax, limit, offset)
	if err != nil {
		return nil, err
	}
	return scanPublishedEventRows(rows)
}

func (q *Queries) CountPublishedEventsFiltered(ctx context.Context, search, categorySlug, city, dateFrom, dateTo string, priceMin, priceMax int64) (int64, error) {
	var n int64
	err := q.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM events e
		LEFT JOIN venues v ON e.venue_id = v.id
		LEFT JOIN event_categories c ON e.category_id = c.id
		WHERE e.status = 'published'
		  AND ($1::text IS NULL OR $1 = '' OR e.title ILIKE '%' || $1 || '%' OR v.city ILIKE '%' || $1 || '%')
		  AND ($2::text IS NULL OR $2 = '' OR c.slug = $2)
		  AND ($3::text IS NULL OR $3 = '' OR v.city ILIKE '%' || $3 || '%')
		  AND ($4::text IS NULL OR $4 = '' OR e.starts_at::date >= $4::date)
		  AND ($5::text IS NULL OR $5 = '' OR e.starts_at::date <= $5::date)
		  AND ($6::bigint IS NULL OR $6 = 0 OR EXISTS (
		        SELECT 1 FROM ticket_types tt WHERE tt.event_id = e.id AND tt.price >= $6))
		  AND ($7::bigint IS NULL OR $7 = 0 OR EXISTS (
		        SELECT 1 FROM ticket_types tt WHERE tt.event_id = e.id AND tt.price <= $7))
	`, search, categorySlug, city, dateFrom, dateTo, priceMin, priceMax).Scan(&n)
	return n, err
}

func scanPublishedEventRows(rows pgx.Rows) ([]PublishedEventRow, error) {
	defer rows.Close()
	var items []PublishedEventRow
	for rows.Next() {
		var r PublishedEventRow
		if err := rows.Scan(
			&r.ID, &r.Slug, &r.Title, &r.Description, &r.VenueID, &r.CoverImageUrl, &r.Status,
			&r.StartsAt, &r.EndsAt, &r.CategoryID, &r.CategoryName, &r.CategorySlug, &r.VenueName, &r.VenueCity, &r.CreatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, r)
	}
	return items, rows.Err()
}

func (q *Queries) ListDraftEventsForModeration(ctx context.Context, limit, offset int32) ([]ListAllEventsRow, error) {
	rows, err := q.db.Query(ctx, `
		SELECT e.id, e.slug, e.title, e.description, e.venue_id, e.cover_image_url, e.status,
		       e.starts_at, e.ends_at, e.metadata, e.created_at, e.updated_at, v.name, v.city
		FROM events e
		LEFT JOIN venues v ON e.venue_id = v.id
		WHERE e.status = 'draft' AND e.organizer_id IS NOT NULL
		ORDER BY e.created_at ASC
		LIMIT $1 OFFSET $2
	`, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []ListAllEventsRow
	for rows.Next() {
		var r ListAllEventsRow
		if err := rows.Scan(
			&r.ID, &r.Slug, &r.Title, &r.Description, &r.VenueID, &r.CoverImageUrl, &r.Status,
			&r.StartsAt, &r.EndsAt, &r.Metadata, &r.CreatedAt, &r.UpdatedAt, &r.VenueName, &r.VenueCity,
		); err != nil {
			return nil, err
		}
		items = append(items, r)
	}
	return items, rows.Err()
}

func (q *Queries) CountDraftEventsForModeration(ctx context.Context) (int64, error) {
	var n int64
	err := q.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM events WHERE status = 'draft' AND organizer_id IS NOT NULL
	`).Scan(&n)
	return n, err
}

func (q *Queries) ModerateEventStatus(ctx context.Context, eventID uuid.UUID, status string) error {
	_, err := q.db.Exec(ctx, `UPDATE events SET status = $2, updated_at = NOW() WHERE id = $1`, eventID, status)
	return err
}

func (q *Queries) SalesReportForOrganizer(ctx context.Context, organizerID uuid.UUID) ([]SalesReportRow, error) {
	rows, err := q.db.Query(ctx, `
		SELECT e.id, e.title,
		       COALESCE(SUM(bi.quantity), 0)::bigint,
		       COALESCE(SUM(bi.quantity * bi.unit_price), 0)::bigint,
		       COUNT(DISTINCT b.id)::bigint
		FROM events e
		LEFT JOIN bookings b ON b.event_id = e.id AND b.status = 'confirmed'
		LEFT JOIN booking_items bi ON bi.booking_id = b.id
		WHERE e.organizer_id = $1
		GROUP BY e.id, e.title
		ORDER BY COALESCE(SUM(bi.quantity * bi.unit_price), 0) DESC
	`, organizerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []SalesReportRow
	for rows.Next() {
		var r SalesReportRow
		if err := rows.Scan(&r.EventID, &r.EventTitle, &r.TicketsSold, &r.Revenue, &r.BookingCount); err != nil {
			return nil, err
		}
		items = append(items, r)
	}
	return items, rows.Err()
}

