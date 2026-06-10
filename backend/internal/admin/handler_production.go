package admin

import (
	"encoding/csv"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/rahmatez/high-traffic-booking/backend/internal/db"
	"github.com/rahmatez/high-traffic-booking/backend/internal/platform/authctx"
	"github.com/rahmatez/high-traffic-booking/backend/internal/platform/response"
)

func (h *Handler) ListPayments(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	perPage, _ := strconv.Atoi(r.URL.Query().Get("per_page"))
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage

	user, _ := authctx.GetUser(r.Context())
	var payments []db.AdminPaymentRow
	var total int64
	var err error
	if user.Role == "organizer" {
		payments, err = h.svc.Queries().AdminListPaymentsForOrganizer(r.Context(), user.ID, status, int32(perPage), int32(offset))
		if err != nil {
			response.Internal(w, "failed to list payments")
			return
		}
		total, _ = h.svc.Queries().CountAdminPaymentsForOrganizer(r.Context(), user.ID, status)
	} else {
		payments, err = h.svc.Queries().AdminListPayments(r.Context(), status, int32(perPage), int32(offset))
		if err != nil {
			response.Internal(w, "failed to list payments")
			return
		}
		total, _ = h.svc.Queries().CountAdminPayments(r.Context(), status)
	}

	items := make([]map[string]interface{}, 0, len(payments))
	for _, p := range payments {
		m := map[string]interface{}{
			"id":             p.ID,
			"booking_id":     p.BookingID,
			"gateway":        p.Gateway,
			"amount":         p.Amount,
			"status":         p.Status,
			"created_at":     p.CreatedAt,
			"user_email":     p.UserEmail,
			"event_title":    p.EventTitle,
			"booking_status": p.BookingStatus,
		}
		if p.GatewayRef.Valid {
			m["gateway_ref"] = p.GatewayRef.String
		}
		if p.PaidAt.Valid {
			m["paid_at"] = p.PaidAt.Time
		}
		items = append(items, m)
	}
	response.OKWithMeta(w, items, response.Meta{Page: page, PerPage: perPage, Total: total})
}

func (h *Handler) ListUsers(w http.ResponseWriter, r *http.Request) {
	search := r.URL.Query().Get("q")
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	perPage, _ := strconv.Atoi(r.URL.Query().Get("per_page"))
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage

	users, err := h.svc.Queries().AdminListUsers(r.Context(), search, int32(perPage), int32(offset))
	if err != nil {
		response.Internal(w, "failed to list users")
		return
	}
	total, _ := h.svc.Queries().CountAdminUsers(r.Context(), search)

	items := make([]map[string]interface{}, 0, len(users))
	for _, u := range users {
		items = append(items, map[string]interface{}{
			"id":                u.ID,
			"email":             u.Email,
			"full_name":         u.FullName,
			"role":              u.Role,
			"email_verified_at": u.EmailVerifiedAt,
			"created_at":        u.CreatedAt,
		})
	}
	response.OKWithMeta(w, items, response.Meta{Page: page, PerPage: perPage, Total: total})
}

func (h *Handler) GetSettings(w http.ResponseWriter, r *http.Request) {
	keys := []string{"general", "integrations", "email_templates"}
	out := map[string]json.RawMessage{}
	for _, k := range keys {
		v, err := h.svc.Queries().GetAppSetting(r.Context(), k)
		if err == nil {
			out[k] = v
		}
	}
	response.OK(w, out)
}

func (h *Handler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	key := chi.URLParam(r, "key")
	if key == "" {
		response.BadRequest(w, "key required")
		return
	}
	var body json.RawMessage
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.BadRequest(w, "invalid body")
		return
	}
	if err := h.svc.Queries().UpsertAppSetting(r.Context(), key, body); err != nil {
		response.Internal(w, "failed to update settings")
		return
	}
	user, _ := authctx.GetUser(r.Context())
	var actorID *uuid.UUID
	if user.ID != uuid.Nil {
		actorID = &user.ID
	}
	h.svc.Audit().Log(r.Context(), actorID, "settings.update", "app_settings", uuid.Nil, map[string]interface{}{"key": key})
	response.OK(w, map[string]string{"message": "updated"})
}

func (h *Handler) ListAuditLogs(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	perPage, _ := strconv.Atoi(r.URL.Query().Get("per_page"))
	logs, total, err := h.svc.Audit().List(r.Context(), page, perPage)
	if err != nil {
		response.Internal(w, "failed to list audit logs")
		return
	}
	items := make([]map[string]interface{}, 0, len(logs))
	for _, l := range logs {
		items = append(items, map[string]interface{}{
			"id":          l.ID,
			"actor_id":    l.ActorID,
			"action":      l.Action,
			"entity_type": l.EntityType,
			"entity_id":   l.EntityID,
			"metadata":    json.RawMessage(l.Metadata),
			"created_at":  l.CreatedAt,
		})
	}
	if perPage <= 0 {
		perPage = 20
	}
	if page <= 0 {
		page = 1
	}
	response.OKWithMeta(w, items, response.Meta{Page: page, PerPage: perPage, Total: total})
}

func (h *Handler) SalesReport(w http.ResponseWriter, r *http.Request) {
	user, _ := authctx.GetUser(r.Context())
	var rows []db.SalesReportRow
	var err error
	if user.Role == "organizer" {
		rows, err = h.svc.Queries().SalesReportForOrganizer(r.Context(), user.ID)
	} else {
		rows, err = h.svc.Queries().SalesReportByEvent(r.Context())
	}
	if err != nil {
		response.Internal(w, "failed to load sales report")
		return
	}
	items := make([]map[string]interface{}, 0, len(rows))
	for _, row := range rows {
		items = append(items, map[string]interface{}{
			"event_id":      row.EventID,
			"event_title":   row.EventTitle,
			"tickets_sold":  row.TicketsSold,
			"revenue":       row.Revenue,
			"booking_count": row.BookingCount,
		})
	}
	response.OK(w, items)
}

func (h *Handler) ExportBookings(w http.ResponseWriter, r *http.Request) {
	rows, err := h.svc.Queries().ListBookingsForExport(r.Context())
	if err != nil {
		response.Internal(w, "export failed")
		return
	}
	defer rows.Close()

	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", `attachment; filename="bookings-export.csv"`)
	cw := csv.NewWriter(w)
	_ = cw.Write([]string{"id", "email", "name", "event", "status", "amount", "created_at", "confirmed_at"})
	for rows.Next() {
		var id uuid.UUID
		var email, name, eventTitle, status string
		var amount int64
		var createdAt time.Time
		var confirmedAt pgtype.Timestamptz
		if err := rows.Scan(&id, &email, &name, &eventTitle, &status, &amount, &createdAt, &confirmedAt); err != nil {
			continue
		}
		confirmed := ""
		if confirmedAt.Valid {
			confirmed = confirmedAt.Time.Format(time.RFC3339)
		}
		_ = cw.Write([]string{
			id.String(), email, name, eventTitle, status,
			strconv.FormatInt(amount, 10), createdAt.Format(time.RFC3339), confirmed,
		})
	}
	cw.Flush()
}

func (h *Handler) RefundBooking(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid booking id")
		return
	}
	if h.paymentSvc == nil {
		response.Internal(w, "refund service unavailable")
		return
	}
	if err := h.paymentSvc.RefundBooking(r.Context(), id); err != nil {
		response.BadRequest(w, err.Error())
		return
	}
	user, _ := authctx.GetUser(r.Context())
	var actorID *uuid.UUID
	if user.ID != uuid.Nil {
		actorID = &user.ID
	}
	h.svc.Audit().Log(r.Context(), actorID, "booking.refund", "booking", id, nil)
	response.OK(w, map[string]string{"message": "refund processed"})
}

func (h *Handler) ListPromos(w http.ResponseWriter, r *http.Request) {
	promos, err := h.svc.Queries().ListPromoCodes(r.Context())
	if err != nil {
		response.Internal(w, "failed to list promos")
		return
	}
	items := make([]map[string]interface{}, 0, len(promos))
	for _, p := range promos {
		items = append(items, map[string]interface{}{
			"id":             p.ID,
			"code":           p.Code,
			"discount_type":  p.DiscountType,
			"discount_value": p.DiscountValue,
			"max_uses":       p.MaxUses,
			"used_count":     p.UsedCount,
			"event_id":       p.EventID,
			"valid_from":     p.ValidFrom,
			"valid_until":    p.ValidUntil,
			"active":         p.Active,
		})
	}
	response.OK(w, items)
}

func (h *Handler) CreatePromo(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Code          string `json:"code"`
		DiscountType  string `json:"discount_type"`
		DiscountValue int64  `json:"discount_value"`
		MaxUses       *int32 `json:"max_uses"`
		EventID       string `json:"event_id"`
		ValidFrom     string `json:"valid_from"`
		ValidUntil    string `json:"valid_until"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.BadRequest(w, "invalid body")
		return
	}
	validFrom, _ := time.Parse(time.RFC3339, body.ValidFrom)
	validUntil, _ := time.Parse(time.RFC3339, body.ValidUntil)
	p := db.PromoCode{
		Code:          body.Code,
		DiscountType:  body.DiscountType,
		DiscountValue: body.DiscountValue,
		ValidFrom:     validFrom,
		ValidUntil:    validUntil,
		Active:        true,
	}
	if body.MaxUses != nil {
		p.MaxUses = pgtype.Int4{Int32: *body.MaxUses, Valid: true}
	}
	if body.EventID != "" {
		if eid, err := uuid.Parse(body.EventID); err == nil {
			p.EventID = pgtype.UUID{Bytes: eid, Valid: true}
		}
	}
	created, err := h.svc.Queries().CreatePromoCode(r.Context(), p)
	if err != nil {
		response.Internal(w, "failed to create promo")
		return
	}
	response.Created(w, map[string]interface{}{
		"id":   created.ID,
		"code": created.Code,
	})
}
