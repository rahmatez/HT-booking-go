package db

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func (q *Queries) SetEventCategory(ctx context.Context, eventID uuid.UUID, categoryID *uuid.UUID) error {
	if categoryID == nil {
		_, err := q.db.Exec(ctx, `UPDATE events SET category_id = NULL, updated_at = NOW() WHERE id = $1`, eventID)
		return err
	}
	_, err := q.db.Exec(ctx, `UPDATE events SET category_id = $2, updated_at = NOW() WHERE id = $1`, eventID, *categoryID)
	return err
}

func (q *Queries) GetEventCategoryID(ctx context.Context, eventID uuid.UUID) (pgtype.UUID, error) {
	var cat pgtype.UUID
	err := q.db.QueryRow(ctx, `SELECT category_id FROM events WHERE id = $1`, eventID).Scan(&cat)
	return cat, err
}

func (q *Queries) UpdateCategory(ctx context.Context, id uuid.UUID, slug, name string, sortOrder int32) error {
	_, err := q.db.Exec(ctx, `
		UPDATE event_categories SET slug = $2, name = $3, sort_order = $4 WHERE id = $1
	`, id, slug, name, sortOrder)
	return err
}

func (q *Queries) DeleteCategory(ctx context.Context, id uuid.UUID) error {
	_, err := q.db.Exec(ctx, `DELETE FROM event_categories WHERE id = $1`, id)
	return err
}

func (q *Queries) UpdateBanner(ctx context.Context, b Banner) error {
	_, err := q.db.Exec(ctx, `
		UPDATE banners SET title = $2, subtitle = $3, image_url = $4, link_url = $5, sort_order = $6, active = $7
		WHERE id = $1
	`, b.ID, b.Title, b.Subtitle, b.ImageURL, b.LinkURL, b.SortOrder, b.Active)
	return err
}

func (q *Queries) DeleteBanner(ctx context.Context, id uuid.UUID) error {
	_, err := q.db.Exec(ctx, `DELETE FROM banners WHERE id = $1`, id)
	return err
}

type DailyTrendRow struct {
	Day     time.Time
	Revenue int64
	Bookings int64
	Tickets  int64
}

func (q *Queries) DashboardDailyTrend(ctx context.Context, days int32) ([]DailyTrendRow, error) {
	rows, err := q.db.Query(ctx, `
		SELECT d.day::date,
		       COALESCE(SUM(b.total_amount) FILTER (WHERE b.status = 'confirmed'), 0)::bigint,
		       COUNT(b.id) FILTER (WHERE b.status = 'confirmed')::bigint,
		       COALESCE(SUM(bi.quantity) FILTER (WHERE b.status = 'confirmed'), 0)::bigint
		FROM generate_series(CURRENT_DATE - ($1::int - 1), CURRENT_DATE, '1 day') AS d(day)
		LEFT JOIN bookings b ON b.confirmed_at::date = d.day::date
		LEFT JOIN booking_items bi ON bi.booking_id = b.id
		GROUP BY d.day
		ORDER BY d.day ASC
	`, days)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []DailyTrendRow
	for rows.Next() {
		var r DailyTrendRow
		if err := rows.Scan(&r.Day, &r.Revenue, &r.Bookings, &r.Tickets); err != nil {
			return nil, err
		}
		items = append(items, r)
	}
	return items, rows.Err()
}

type AttendeeRow struct {
	TicketCode  string
	TicketStatus string
	CheckedInAt pgtype.Timestamptz
	UserName    string
	UserEmail   string
	TicketType  string
	BookingID   uuid.UUID
}

func (q *Queries) ListAttendeesByEvent(ctx context.Context, eventID uuid.UUID) ([]AttendeeRow, error) {
	rows, err := q.db.Query(ctx, `
		SELECT t.ticket_code, t.status, t.checked_in_at, u.full_name, u.email, tt.name, t.booking_id
		FROM tickets t
		JOIN bookings b ON t.booking_id = b.id
		JOIN users u ON b.user_id = u.id
		JOIN ticket_types tt ON t.ticket_type_id = tt.id
		WHERE b.event_id = $1 AND b.status = 'confirmed'
		ORDER BY u.full_name, t.ticket_code
	`, eventID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []AttendeeRow
	for rows.Next() {
		var r AttendeeRow
		if err := rows.Scan(&r.TicketCode, &r.TicketStatus, &r.CheckedInAt, &r.UserName, &r.UserEmail, &r.TicketType, &r.BookingID); err != nil {
			return nil, err
		}
		items = append(items, r)
	}
	return items, rows.Err()
}

func (q *Queries) ListPaymentsByBooking(ctx context.Context, bookingID uuid.UUID) ([]Payment, error) {
	rows, err := q.db.Query(ctx, `
		SELECT id, booking_id, gateway, gateway_ref, amount, status, idempotency_key, paid_at, created_at, updated_at
		FROM payments WHERE booking_id = $1 ORDER BY created_at ASC
	`, bookingID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []Payment
	for rows.Next() {
		var p Payment
		if err := rows.Scan(&p.ID, &p.BookingID, &p.Gateway, &p.GatewayRef, &p.Amount, &p.Status,
			&p.IdempotencyKey, &p.PaidAt, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		items = append(items, p)
	}
	return items, rows.Err()
}

func (q *Queries) ListConfirmedBookingIDsForEvent(ctx context.Context, eventID uuid.UUID) ([]uuid.UUID, error) {
	rows, err := q.db.Query(ctx, `
		SELECT id FROM bookings WHERE event_id = $1 AND status = 'confirmed'
	`, eventID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

type OrganizerUser struct {
	ID              uuid.UUID
	Email           string
	FullName        string
	EventCount      int64
	CreatedAt       time.Time
	EmailVerifiedAt pgtype.Timestamptz
}

func (q *Queries) ListOrganizers(ctx context.Context) ([]OrganizerUser, error) {
	rows, err := q.db.Query(ctx, `
		SELECT u.id, u.email, u.full_name, COUNT(e.id)::bigint, u.created_at, u.email_verified_at
		FROM users u
		LEFT JOIN events e ON e.organizer_id = u.id
		WHERE u.role = 'organizer'
		GROUP BY u.id
		ORDER BY u.created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []OrganizerUser
	for rows.Next() {
		var r OrganizerUser
		if err := rows.Scan(&r.ID, &r.Email, &r.FullName, &r.EventCount, &r.CreatedAt, &r.EmailVerifiedAt); err != nil {
			return nil, err
		}
		items = append(items, r)
	}
	return items, rows.Err()
}

func (q *Queries) CreateOrganizerUser(ctx context.Context, email, fullName, passwordHash string) (uuid.UUID, error) {
	var id uuid.UUID
	err := q.db.QueryRow(ctx, `
		INSERT INTO users (email, password_hash, full_name, role)
		VALUES ($1, $2, $3, 'organizer')
		RETURNING id
	`, email, passwordHash, fullName).Scan(&id)
	return id, err
}

type EventStaffRow struct {
	ID        uuid.UUID
	EventID   uuid.UUID
	UserID    uuid.UUID
	UserEmail string
	UserName  string
	EventTitle string
	CreatedAt time.Time
}

func (q *Queries) ListEventStaff(ctx context.Context, eventID *uuid.UUID) ([]EventStaffRow, error) {
	var rows pgx.Rows
	var err error
	if eventID != nil {
		rows, err = q.db.Query(ctx, `
			SELECT es.id, es.event_id, es.user_id, u.email, u.full_name, e.title, es.created_at
			FROM event_staff es
			JOIN users u ON es.user_id = u.id
			JOIN events e ON es.event_id = e.id
			WHERE es.event_id = $1
			ORDER BY es.created_at DESC
		`, *eventID)
	} else {
		rows, err = q.db.Query(ctx, `
			SELECT es.id, es.event_id, es.user_id, u.email, u.full_name, e.title, es.created_at
			FROM event_staff es
			JOIN users u ON es.user_id = u.id
			JOIN events e ON es.event_id = e.id
			ORDER BY es.created_at DESC
		`)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []EventStaffRow
	for rows.Next() {
		var r EventStaffRow
		if err := rows.Scan(&r.ID, &r.EventID, &r.UserID, &r.UserEmail, &r.UserName, &r.EventTitle, &r.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, r)
	}
	return items, rows.Err()
}

func (q *Queries) AssignEventStaff(ctx context.Context, eventID, userID uuid.UUID) error {
	_, err := q.db.Exec(ctx, `
		INSERT INTO event_staff (event_id, user_id) VALUES ($1, $2)
		ON CONFLICT (event_id, user_id) DO NOTHING
	`, eventID, userID)
	return err
}

func (q *Queries) RemoveEventStaff(ctx context.Context, id uuid.UUID) error {
	_, err := q.db.Exec(ctx, `DELETE FROM event_staff WHERE id = $1`, id)
	return err
}

func (q *Queries) UserIsEventStaff(ctx context.Context, userID, eventID uuid.UUID) (bool, error) {
	var ok bool
	err := q.db.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM event_staff WHERE user_id = $1 AND event_id = $2)
	`, userID, eventID).Scan(&ok)
	return ok, err
}

func (q *Queries) ListGateStaffUsers(ctx context.Context) ([]OrganizerUser, error) {
	rows, err := q.db.Query(ctx, `
		SELECT u.id, u.email, u.full_name, 0::bigint, u.created_at, u.email_verified_at
		FROM users u WHERE u.role = 'gate_staff' ORDER BY u.created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []OrganizerUser
	for rows.Next() {
		var r OrganizerUser
		if err := rows.Scan(&r.ID, &r.Email, &r.FullName, &r.EventCount, &r.CreatedAt, &r.EmailVerifiedAt); err != nil {
			return nil, err
		}
		items = append(items, r)
	}
	return items, rows.Err()
}

func (q *Queries) CreateGateStaffUser(ctx context.Context, email, fullName, passwordHash string) (uuid.UUID, error) {
	var id uuid.UUID
	err := q.db.QueryRow(ctx, `
		INSERT INTO users (email, password_hash, full_name, role)
		VALUES ($1, $2, $3, 'gate_staff')
		RETURNING id
	`, email, passwordHash, fullName).Scan(&id)
	return id, err
}

type SettlementRow struct {
	ID           uuid.UUID
	OrganizerID  uuid.UUID
	OrganizerName string
	PeriodStart  time.Time
	PeriodEnd    time.Time
	GrossRevenue int64
	PlatformFee  int64
	NetPayout    int64
	Status       string
	PaidAt       pgtype.Timestamptz
	CreatedAt    time.Time
}

func (q *Queries) ListSettlements(ctx context.Context) ([]SettlementRow, error) {
	rows, err := q.db.Query(ctx, `
		SELECT s.id, s.organizer_id, u.full_name, s.period_start, s.period_end,
		       s.gross_revenue, s.platform_fee, s.net_payout, s.status, s.paid_at, s.created_at
		FROM settlements s
		JOIN users u ON s.organizer_id = u.id
		ORDER BY s.created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []SettlementRow
	for rows.Next() {
		var r SettlementRow
		if err := rows.Scan(&r.ID, &r.OrganizerID, &r.OrganizerName, &r.PeriodStart, &r.PeriodEnd,
			&r.GrossRevenue, &r.PlatformFee, &r.NetPayout, &r.Status, &r.PaidAt, &r.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, r)
	}
	return items, rows.Err()
}

func (q *Queries) CreateSettlement(ctx context.Context, organizerID uuid.UUID, periodStart, periodEnd time.Time, feePercent int) (SettlementRow, error) {
	var gross int64
	err := q.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(bi.quantity * bi.unit_price), 0)::bigint
		FROM bookings b
		JOIN booking_items bi ON bi.booking_id = b.id
		JOIN events e ON b.event_id = e.id
		WHERE e.organizer_id = $1 AND b.status = 'confirmed'
		  AND b.confirmed_at::date >= $2 AND b.confirmed_at::date <= $3
	`, organizerID, periodStart, periodEnd).Scan(&gross)
	if err != nil {
		return SettlementRow{}, err
	}
	fee := gross * int64(feePercent) / 100
	net := gross - fee
	var r SettlementRow
	err = q.db.QueryRow(ctx, `
		INSERT INTO settlements (organizer_id, period_start, period_end, gross_revenue, platform_fee, net_payout)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, organizer_id, period_start, period_end, gross_revenue, platform_fee, net_payout, status, paid_at, created_at
	`, organizerID, periodStart, periodEnd, gross, fee, net).Scan(
		&r.ID, &r.OrganizerID, &r.PeriodStart, &r.PeriodEnd, &r.GrossRevenue, &r.PlatformFee, &r.NetPayout, &r.Status, &r.PaidAt, &r.CreatedAt)
	return r, err
}

func (q *Queries) MarkSettlementPaid(ctx context.Context, id uuid.UUID) error {
	_, err := q.db.Exec(ctx, `
		UPDATE settlements SET status = 'paid', paid_at = NOW() WHERE id = $1
	`, id)
	return err
}

type PayoutAccount struct {
	UserID        uuid.UUID
	BankName      string
	AccountNumber string
	AccountHolder string
	UpdatedAt     time.Time
}

func (q *Queries) GetOrganizerPayoutAccount(ctx context.Context, userID uuid.UUID) (PayoutAccount, error) {
	var a PayoutAccount
	err := q.db.QueryRow(ctx, `
		SELECT user_id, bank_name, account_number, account_holder, updated_at
		FROM organizer_payout_accounts WHERE user_id = $1
	`, userID).Scan(&a.UserID, &a.BankName, &a.AccountNumber, &a.AccountHolder, &a.UpdatedAt)
	return a, err
}

func (q *Queries) UpsertOrganizerPayoutAccount(ctx context.Context, userID uuid.UUID, bankName, accountNumber, accountHolder string) error {
	_, err := q.db.Exec(ctx, `
		INSERT INTO organizer_payout_accounts (user_id, bank_name, account_number, account_holder, updated_at)
		VALUES ($1, $2, $3, $4, NOW())
		ON CONFLICT (user_id) DO UPDATE SET
			bank_name = EXCLUDED.bank_name,
			account_number = EXCLUDED.account_number,
			account_holder = EXCLUDED.account_holder,
			updated_at = NOW()
	`, userID, bankName, accountNumber, accountHolder)
	return err
}

type EventWaitingRoom struct {
	ID                   uuid.UUID
	WaitingRoomEnabled   bool
	WaitingRoomCapacity  pgtype.Int4
}

func (q *Queries) GetEventWaitingRoom(ctx context.Context, eventID uuid.UUID) (EventWaitingRoom, error) {
	var r EventWaitingRoom
	err := q.db.QueryRow(ctx, `
		SELECT id, waiting_room_enabled, waiting_room_capacity FROM events WHERE id = $1
	`, eventID).Scan(&r.ID, &r.WaitingRoomEnabled, &r.WaitingRoomCapacity)
	return r, err
}

func (q *Queries) GetEventWaitingRoomBySlug(ctx context.Context, slug string) (EventWaitingRoom, error) {
	var r EventWaitingRoom
	err := q.db.QueryRow(ctx, `
		SELECT id, waiting_room_enabled, waiting_room_capacity FROM events WHERE slug = $1
	`, slug).Scan(&r.ID, &r.WaitingRoomEnabled, &r.WaitingRoomCapacity)
	return r, err
}

func (q *Queries) UpdateEventWaitingRoom(ctx context.Context, eventID uuid.UUID, enabled bool, capacity int32) error {
	_, err := q.db.Exec(ctx, `
		UPDATE events SET waiting_room_enabled = $2, waiting_room_capacity = $3, updated_at = NOW() WHERE id = $1
	`, eventID, enabled, capacity)
	return err
}
