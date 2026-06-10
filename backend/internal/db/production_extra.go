package db

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

type PasswordResetToken struct {
	ID        uuid.UUID
	UserID    uuid.UUID
	TokenHash string
	ExpiresAt time.Time
	UsedAt    pgtype.Timestamptz
	CreatedAt time.Time
}

type EmailVerificationToken struct {
	ID        uuid.UUID
	UserID    uuid.UUID
	TokenHash string
	ExpiresAt time.Time
	UsedAt    pgtype.Timestamptz
	CreatedAt time.Time
}

type PromoCode struct {
	ID            uuid.UUID
	Code          string
	DiscountType  string
	DiscountValue int64
	MaxUses       pgtype.Int4
	UsedCount     int32
	EventID       pgtype.UUID
	ValidFrom     time.Time
	ValidUntil    time.Time
	Active        bool
	CreatedAt     time.Time
}

type EventCategory struct {
	ID        uuid.UUID
	Slug      string
	Name      string
	SortOrder int32
	CreatedAt time.Time
}

type Banner struct {
	ID        uuid.UUID
	Title     string
	Subtitle  string
	ImageURL  pgtype.Text
	LinkURL   pgtype.Text
	SortOrder int32
	Active    bool
	CreatedAt time.Time
}

type AdminPaymentRow struct {
	ID          uuid.UUID
	BookingID   uuid.UUID
	Gateway     string
	GatewayRef  pgtype.Text
	Amount      int64
	Status      PaymentStatus
	PaidAt      pgtype.Timestamptz
	CreatedAt   time.Time
	UserEmail   string
	EventTitle  string
	BookingStatus BookingStatus
}

type AdminUserRow struct {
	ID              uuid.UUID
	Email           string
	FullName        string
	Role            UserRole
	EmailVerifiedAt pgtype.Timestamptz
	CreatedAt       time.Time
}

type SalesReportRow struct {
	EventID      uuid.UUID
	EventTitle   string
	TicketsSold  int64
	Revenue      int64
	BookingCount int64
}

func (q *Queries) CreatePasswordResetToken(ctx context.Context, userID uuid.UUID, tokenHash string, expiresAt time.Time) error {
	_, err := q.db.Exec(ctx, `
		INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
		VALUES ($1, $2, $3)
	`, userID, tokenHash, expiresAt)
	return err
}

func (q *Queries) GetPasswordResetToken(ctx context.Context, tokenHash string) (PasswordResetToken, error) {
	var t PasswordResetToken
	err := q.db.QueryRow(ctx, `
		SELECT id, user_id, token_hash, expires_at, used_at, created_at
		FROM password_reset_tokens WHERE token_hash = $1
	`, tokenHash).Scan(&t.ID, &t.UserID, &t.TokenHash, &t.ExpiresAt, &t.UsedAt, &t.CreatedAt)
	return t, err
}

func (q *Queries) MarkPasswordResetUsed(ctx context.Context, tokenHash string) error {
	_, err := q.db.Exec(ctx, `
		UPDATE password_reset_tokens SET used_at = NOW() WHERE token_hash = $1
	`, tokenHash)
	return err
}

func (q *Queries) UpdateUserPassword(ctx context.Context, userID uuid.UUID, passwordHash string) error {
	_, err := q.db.Exec(ctx, `
		UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1
	`, userID, passwordHash)
	return err
}

func (q *Queries) CreateEmailVerificationToken(ctx context.Context, userID uuid.UUID, tokenHash string, expiresAt time.Time) error {
	_, err := q.db.Exec(ctx, `
		INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
		VALUES ($1, $2, $3)
	`, userID, tokenHash, expiresAt)
	return err
}

func (q *Queries) GetEmailVerificationToken(ctx context.Context, tokenHash string) (EmailVerificationToken, error) {
	var t EmailVerificationToken
	err := q.db.QueryRow(ctx, `
		SELECT id, user_id, token_hash, expires_at, used_at, created_at
		FROM email_verification_tokens WHERE token_hash = $1
	`, tokenHash).Scan(&t.ID, &t.UserID, &t.TokenHash, &t.ExpiresAt, &t.UsedAt, &t.CreatedAt)
	return t, err
}

func (q *Queries) MarkEmailVerificationUsed(ctx context.Context, tokenHash string) error {
	_, err := q.db.Exec(ctx, `
		UPDATE email_verification_tokens SET used_at = NOW() WHERE token_hash = $1
	`, tokenHash)
	return err
}

func (q *Queries) InsertAuditLog(ctx context.Context, actorID *uuid.UUID, action, entityType string, entityID uuid.UUID, metadata json.RawMessage) error {
	if metadata == nil {
		metadata = json.RawMessage("{}")
	}
	_, err := q.db.Exec(ctx, `
		INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
		VALUES ($1, $2, $3, $4, $5)
	`, actorID, action, entityType, entityID, metadata)
	return err
}

func (q *Queries) ListAuditLogs(ctx context.Context, limit, offset int32) ([]AuditLog, error) {
	rows, err := q.db.Query(ctx, `
		SELECT id, actor_id, action, entity_type, entity_id, metadata, created_at
		FROM audit_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2
	`, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var logs []AuditLog
	for rows.Next() {
		var l AuditLog
		if err := rows.Scan(&l.ID, &l.ActorID, &l.Action, &l.EntityType, &l.EntityID, &l.Metadata, &l.CreatedAt); err != nil {
			return nil, err
		}
		logs = append(logs, l)
	}
	return logs, rows.Err()
}

func (q *Queries) CountAuditLogs(ctx context.Context) (int64, error) {
	var n int64
	err := q.db.QueryRow(ctx, `SELECT COUNT(*) FROM audit_logs`).Scan(&n)
	return n, err
}

func (q *Queries) AdminListPayments(ctx context.Context, status string, limit, offset int32) ([]AdminPaymentRow, error) {
	rows, err := q.db.Query(ctx, `
		SELECT p.id, p.booking_id, p.gateway, p.gateway_ref, p.amount, p.status,
		       p.paid_at, p.created_at, u.email, e.title, b.status
		FROM payments p
		JOIN bookings b ON p.booking_id = b.id
		JOIN users u ON b.user_id = u.id
		JOIN events e ON b.event_id = e.id
		WHERE ($1::text IS NULL OR $1 = '' OR p.status::text = $1)
		ORDER BY p.created_at DESC
		LIMIT $2 OFFSET $3
	`, status, limit, offset)
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

func (q *Queries) CountAdminPayments(ctx context.Context, status string) (int64, error) {
	var n int64
	err := q.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM payments p
		WHERE ($1::text IS NULL OR $1 = '' OR p.status::text = $1)
	`, status).Scan(&n)
	return n, err
}

func (q *Queries) ListPendingPaymentsForReconcile(ctx context.Context, limit int32) ([]Payment, error) {
	rows, err := q.db.Query(ctx, `
		SELECT id, booking_id, gateway, gateway_ref, amount, status, idempotency_key, paid_at, created_at, updated_at
		FROM payments
		WHERE status = 'pending' AND gateway_ref IS NOT NULL
		  AND created_at < NOW() - interval '2 minutes'
		ORDER BY created_at ASC
		LIMIT $1
	`, limit)
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

func (q *Queries) AdminListUsers(ctx context.Context, search string, limit, offset int32) ([]AdminUserRow, error) {
	rows, err := q.db.Query(ctx, `
		SELECT id, email, full_name, role, email_verified_at, created_at
		FROM users
		WHERE ($1::text IS NULL OR $1 = '' OR email ILIKE '%' || $1 || '%' OR full_name ILIKE '%' || $1 || '%')
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`, search, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []AdminUserRow
	for rows.Next() {
		var u AdminUserRow
		if err := rows.Scan(&u.ID, &u.Email, &u.FullName, &u.Role, &u.EmailVerifiedAt, &u.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, u)
	}
	return items, rows.Err()
}

func (q *Queries) CountAdminUsers(ctx context.Context, search string) (int64, error) {
	var n int64
	err := q.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM users
		WHERE ($1::text IS NULL OR $1 = '' OR email ILIKE '%' || $1 || '%' OR full_name ILIKE '%' || $1 || '%')
	`, search).Scan(&n)
	return n, err
}

func (q *Queries) GetAppSetting(ctx context.Context, key string) (json.RawMessage, error) {
	var v json.RawMessage
	err := q.db.QueryRow(ctx, `SELECT value FROM app_settings WHERE key = $1`, key).Scan(&v)
	return v, err
}

func (q *Queries) UpsertAppSetting(ctx context.Context, key string, value json.RawMessage) error {
	_, err := q.db.Exec(ctx, `
		INSERT INTO app_settings (key, value) VALUES ($1, $2)
		ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()
	`, key, value)
	return err
}

func (q *Queries) CheckInTicket(ctx context.Context, ticketCode string) (Ticket, error) {
	var t Ticket
	err := q.db.QueryRow(ctx, `
		UPDATE tickets SET status = 'used', checked_in_at = NOW()
		WHERE ticket_code = $1 AND status = 'active' AND checked_in_at IS NULL
		RETURNING id, booking_id, ticket_type_id, ticket_code, status, checked_in_at, created_at
	`, ticketCode).Scan(&t.ID, &t.BookingID, &t.TicketTypeID, &t.TicketCode, &t.Status, &t.CheckedInAt, &t.CreatedAt)
	return t, err
}

func (q *Queries) GetTicketForCheckIn(ctx context.Context, ticketCode string) (Ticket, uuid.UUID, string, string, error) {
	var t Ticket
	var eventID uuid.UUID
	var eventTitle, userName string
	err := q.db.QueryRow(ctx, `
		SELECT t.id, t.booking_id, t.ticket_type_id, t.ticket_code, t.status, t.checked_in_at, t.created_at,
		       b.event_id, e.title, u.full_name
		FROM tickets t
		JOIN bookings b ON t.booking_id = b.id
		JOIN events e ON b.event_id = e.id
		JOIN users u ON b.user_id = u.id
		WHERE t.ticket_code = $1
	`, ticketCode).Scan(&t.ID, &t.BookingID, &t.TicketTypeID, &t.TicketCode, &t.Status, &t.CheckedInAt, &t.CreatedAt,
		&eventID, &eventTitle, &userName)
	return t, eventID, eventTitle, userName, err
}

func (q *Queries) CountCheckedInByEvent(ctx context.Context, eventID uuid.UUID) (int64, int64, error) {
	var checkedIn, total int64
	err := q.db.QueryRow(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE t.checked_in_at IS NOT NULL),
			COUNT(*)
		FROM tickets t
		JOIN bookings b ON t.booking_id = b.id
		WHERE b.event_id = $1 AND b.status = 'confirmed'
	`, eventID).Scan(&checkedIn, &total)
	return checkedIn, total, err
}

func (q *Queries) SalesReportByEvent(ctx context.Context) ([]SalesReportRow, error) {
	rows, err := q.db.Query(ctx, `
		SELECT e.id, e.title,
		       COALESCE(SUM(bi.quantity), 0)::bigint,
		       COALESCE(SUM(bi.quantity * bi.unit_price), 0)::bigint,
		       COUNT(DISTINCT b.id)::bigint
		FROM events e
		LEFT JOIN bookings b ON b.event_id = e.id AND b.status = 'confirmed'
		LEFT JOIN booking_items bi ON bi.booking_id = b.id
		GROUP BY e.id, e.title
		ORDER BY COALESCE(SUM(bi.quantity * bi.unit_price), 0) DESC
	`)
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

func (q *Queries) RefundPayment(ctx context.Context, bookingID uuid.UUID) error {
	_, err := q.db.Exec(ctx, `
		UPDATE payments SET status = 'refunded', updated_at = NOW()
		WHERE booking_id = $1 AND status = 'success'
	`, bookingID)
	if err != nil {
		return err
	}
	_, err = q.db.Exec(ctx, `
		UPDATE bookings SET status = 'cancelled' WHERE id = $1 AND status = 'confirmed'
	`, bookingID)
	if err != nil {
		return err
	}
	_, err = q.db.Exec(ctx, `
		UPDATE tickets SET status = 'cancelled' WHERE booking_id = $1
	`, bookingID)
	return err
}

func (q *Queries) GetPromoByCode(ctx context.Context, code string) (PromoCode, error) {
	var p PromoCode
	err := q.db.QueryRow(ctx, `
		SELECT id, code, discount_type, discount_value, max_uses, used_count, event_id,
		       valid_from, valid_until, active, created_at
		FROM promo_codes WHERE UPPER(code) = UPPER($1) AND active = true
	`, code).Scan(&p.ID, &p.Code, &p.DiscountType, &p.DiscountValue, &p.MaxUses, &p.UsedCount,
		&p.EventID, &p.ValidFrom, &p.ValidUntil, &p.Active, &p.CreatedAt)
	return p, err
}

func (q *Queries) IncrementPromoUsage(ctx context.Context, id uuid.UUID) error {
	_, err := q.db.Exec(ctx, `UPDATE promo_codes SET used_count = used_count + 1 WHERE id = $1`, id)
	return err
}

func (q *Queries) ListPromoCodes(ctx context.Context) ([]PromoCode, error) {
	rows, err := q.db.Query(ctx, `
		SELECT id, code, discount_type, discount_value, max_uses, used_count, event_id,
		       valid_from, valid_until, active, created_at
		FROM promo_codes ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []PromoCode
	for rows.Next() {
		var p PromoCode
		if err := rows.Scan(&p.ID, &p.Code, &p.DiscountType, &p.DiscountValue, &p.MaxUses, &p.UsedCount,
			&p.EventID, &p.ValidFrom, &p.ValidUntil, &p.Active, &p.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, p)
	}
	return items, rows.Err()
}

func (q *Queries) CreatePromoCode(ctx context.Context, p PromoCode) (PromoCode, error) {
	err := q.db.QueryRow(ctx, `
		INSERT INTO promo_codes (code, discount_type, discount_value, max_uses, event_id, valid_from, valid_until, active)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, code, discount_type, discount_value, max_uses, used_count, event_id, valid_from, valid_until, active, created_at
	`, p.Code, p.DiscountType, p.DiscountValue, p.MaxUses, p.EventID, p.ValidFrom, p.ValidUntil, p.Active).Scan(
		&p.ID, &p.Code, &p.DiscountType, &p.DiscountValue, &p.MaxUses, &p.UsedCount,
		&p.EventID, &p.ValidFrom, &p.ValidUntil, &p.Active, &p.CreatedAt)
	return p, err
}

func (q *Queries) GetBookingEmailContext(ctx context.Context, bookingID uuid.UUID) (userEmail, userName, eventTitle string, tickets []string, err error) {
	err = q.db.QueryRow(ctx, `
		SELECT u.email, u.full_name, e.title
		FROM bookings b
		JOIN users u ON b.user_id = u.id
		JOIN events e ON b.event_id = e.id
		WHERE b.id = $1
	`, bookingID).Scan(&userEmail, &userName, &eventTitle)
	if err != nil {
		return
	}
	rows, err := q.db.Query(ctx, `SELECT ticket_code FROM tickets WHERE booking_id = $1`, bookingID)
	if err != nil {
		return
	}
	defer rows.Close()
	for rows.Next() {
		var code string
		if err = rows.Scan(&code); err != nil {
			return
		}
		tickets = append(tickets, code)
	}
	err = rows.Err()
	return
}

func (q *Queries) ListBookingsForExport(ctx context.Context) (pgx.Rows, error) {
	return q.db.Query(ctx, `
		SELECT b.id, u.email, u.full_name, e.title, b.status, b.total_amount, b.created_at, b.confirmed_at
		FROM bookings b
		JOIN users u ON b.user_id = u.id
		JOIN events e ON b.event_id = e.id
		ORDER BY b.created_at DESC
	`)
}
