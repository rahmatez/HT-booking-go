package db

import (
	"context"

	"github.com/google/uuid"
)

func (q *Queries) ListAllEventsForOrganizer(ctx context.Context, organizerID uuid.UUID, status, search string, limit, offset int32) ([]ListAllEventsRow, error) {
	rows, err := q.db.Query(ctx, `
		SELECT e.id, e.slug, e.title, e.description, e.venue_id, e.cover_image_url, e.status,
		       e.starts_at, e.ends_at, e.metadata, e.created_at, e.updated_at, v.name AS venue_name, v.city AS venue_city
		FROM events e
		LEFT JOIN venues v ON e.venue_id = v.id
		WHERE e.organizer_id = $1
		  AND ($2::text IS NULL OR $2 = '' OR e.status::text = $2)
		  AND ($3::text IS NULL OR $3 = '' OR e.title ILIKE '%' || $3 || '%')
		ORDER BY e.created_at DESC
		LIMIT $4 OFFSET $5
	`, organizerID, status, search, limit, offset)
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

func (q *Queries) CountAllEventsForOrganizer(ctx context.Context, organizerID uuid.UUID, status, search string) (int64, error) {
	var n int64
	err := q.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM events e
		WHERE e.organizer_id = $1
		  AND ($2::text IS NULL OR $2 = '' OR e.status::text = $2)
		  AND ($3::text IS NULL OR $3 = '' OR e.title ILIKE '%' || $3 || '%')
	`, organizerID, status, search).Scan(&n)
	return n, err
}

func (q *Queries) AdminListBookingsForOrganizer(ctx context.Context, organizerID uuid.UUID, status, eventID string, limit, offset int32) ([]AdminListBookingsRow, error) {
	rows, err := q.db.Query(ctx, `
		SELECT b.id, b.user_id, b.event_id, b.status, b.hold_expires_at, b.total_amount, b.idempotency_key,
		       b.created_at, b.confirmed_at, u.email AS user_email, u.full_name AS user_name,
		       e.title AS event_title, e.slug AS event_slug
		FROM bookings b
		JOIN users u ON b.user_id = u.id
		JOIN events e ON b.event_id = e.id
		WHERE e.organizer_id = $1
		  AND ($2::text IS NULL OR $2 = '' OR b.status::text = $2)
		  AND ($3::text IS NULL OR $3 = '' OR b.event_id = $3::uuid)
		ORDER BY b.created_at DESC
		LIMIT $4 OFFSET $5
	`, organizerID, status, eventID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []AdminListBookingsRow
	for rows.Next() {
		var r AdminListBookingsRow
		if err := rows.Scan(
			&r.ID, &r.UserID, &r.EventID, &r.Status, &r.HoldExpiresAt, &r.TotalAmount, &r.IdempotencyKey,
			&r.CreatedAt, &r.ConfirmedAt, &r.UserEmail, &r.UserName, &r.EventTitle, &r.EventSlug,
		); err != nil {
			return nil, err
		}
		items = append(items, r)
	}
	return items, rows.Err()
}

func (q *Queries) CountAdminBookingsForOrganizer(ctx context.Context, organizerID uuid.UUID, status, eventID string) (int64, error) {
	var n int64
	err := q.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM bookings b
		JOIN events e ON b.event_id = e.id
		WHERE e.organizer_id = $1
		  AND ($2::text IS NULL OR $2 = '' OR b.status::text = $2)
		  AND ($3::text IS NULL OR $3 = '' OR b.event_id = $3::uuid)
	`, organizerID, status, eventID).Scan(&n)
	return n, err
}

func (q *Queries) SetEventOrganizer(ctx context.Context, eventID, organizerID uuid.UUID) error {
	_, err := q.db.Exec(ctx, `UPDATE events SET organizer_id = $2, updated_at = NOW() WHERE id = $1`, eventID, organizerID)
	return err
}

func (q *Queries) AdminListPaymentsForOrganizer(ctx context.Context, organizerID uuid.UUID, status string, limit, offset int32) ([]AdminPaymentRow, error) {
	rows, err := q.db.Query(ctx, `
		SELECT p.id, p.booking_id, p.gateway, p.gateway_ref, p.amount, p.status,
		       p.paid_at, p.created_at, u.email, e.title, b.status
		FROM payments p
		JOIN bookings b ON p.booking_id = b.id
		JOIN users u ON b.user_id = u.id
		JOIN events e ON b.event_id = e.id
		WHERE e.organizer_id = $1
		  AND ($2::text IS NULL OR $2 = '' OR p.status::text = $2)
		ORDER BY p.created_at DESC
		LIMIT $3 OFFSET $4
	`, organizerID, status, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []AdminPaymentRow
	for rows.Next() {
		var r AdminPaymentRow
		if err := rows.Scan(&r.ID, &r.BookingID, &r.Gateway, &r.GatewayRef, &r.Amount, &r.Status,
			&r.PaidAt, &r.CreatedAt, &r.UserEmail, &r.EventTitle, &r.BookingStatus); err != nil {
			return nil, err
		}
		items = append(items, r)
	}
	return items, rows.Err()
}

func (q *Queries) CountAdminPaymentsForOrganizer(ctx context.Context, organizerID uuid.UUID, status string) (int64, error) {
	var n int64
	err := q.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM payments p
		JOIN bookings b ON p.booking_id = b.id
		JOIN events e ON b.event_id = e.id
		WHERE e.organizer_id = $1
		  AND ($2::text IS NULL OR $2 = '' OR p.status::text = $2)
	`, organizerID, status).Scan(&n)
	return n, err
}

func (q *Queries) EventBelongsToOrganizer(ctx context.Context, eventID, organizerID uuid.UUID) (bool, error) {
	var ok bool
	err := q.db.QueryRow(ctx, `
		SELECT organizer_id = $2 FROM events WHERE id = $1
	`, eventID, organizerID).Scan(&ok)
	return ok, err
}
