package admin

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"golang.org/x/crypto/bcrypt"

	"github.com/rahmatez/high-traffic-booking/backend/internal/db"
	"github.com/rahmatez/high-traffic-booking/backend/internal/platform/authctx"
	"github.com/rahmatez/high-traffic-booking/backend/internal/platform/response"
	"github.com/rahmatez/high-traffic-booking/backend/internal/queue"
)

func (h *Handler) DashboardTrend(w http.ResponseWriter, r *http.Request) {
	days, _ := strconv.Atoi(r.URL.Query().Get("days"))
	if days < 1 || days > 90 {
		days = 14
	}
	rows, err := h.svc.Queries().DashboardDailyTrend(r.Context(), int32(days))
	if err != nil {
		response.Internal(w, "failed to load trend")
		return
	}
	items := make([]map[string]interface{}, 0, len(rows))
	for _, row := range rows {
		items = append(items, map[string]interface{}{
			"day": row.Day.Format("2006-01-02"), "revenue": row.Revenue,
			"bookings": row.Bookings, "tickets": row.Tickets,
		})
	}
	response.OK(w, items)
}

func (h *Handler) ListAttendees(w http.ResponseWriter, r *http.Request) {
	eventID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid event id")
		return
	}
	rows, err := h.svc.Queries().ListAttendeesByEvent(r.Context(), eventID)
	if err != nil {
		response.Internal(w, "failed to list attendees")
		return
	}
	items := make([]map[string]interface{}, 0, len(rows))
	for _, a := range rows {
		m := map[string]interface{}{
			"ticket_code": a.TicketCode, "status": a.TicketStatus,
			"user_name": a.UserName, "user_email": a.UserEmail,
			"ticket_type": a.TicketType, "booking_id": a.BookingID,
		}
		if a.CheckedInAt.Valid {
			m["checked_in_at"] = a.CheckedInAt.Time
		}
		items = append(items, m)
	}
	response.OK(w, items)
}

func (h *Handler) ExportAttendees(w http.ResponseWriter, r *http.Request) {
	eventID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid event id")
		return
	}
	rows, err := h.svc.Queries().ListAttendeesByEvent(r.Context(), eventID)
	if err != nil {
		response.Internal(w, "export failed")
		return
	}
	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", `attachment; filename="attendees-`+eventID.String()+`.csv"`)
	cw := csv.NewWriter(w)
	_ = cw.Write([]string{"ticket_code", "name", "email", "ticket_type", "status", "checked_in_at"})
	for _, a := range rows {
		checked := ""
		if a.CheckedInAt.Valid {
			checked = a.CheckedInAt.Time.Format(time.RFC3339)
		}
		_ = cw.Write([]string{a.TicketCode, a.UserName, a.UserEmail, a.TicketType, a.TicketStatus, checked})
	}
	cw.Flush()
}

func (h *Handler) UpdateCategory(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid id")
		return
	}
	var body struct {
		Slug      string `json:"slug"`
		Name      string `json:"name"`
		SortOrder int32  `json:"sort_order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.BadRequest(w, "invalid body")
		return
	}
	if err := h.svc.Queries().UpdateCategory(r.Context(), id, body.Slug, body.Name, body.SortOrder); err != nil {
		response.Internal(w, "update failed")
		return
	}
	response.OK(w, map[string]string{"message": "updated"})
}

func (h *Handler) DeleteCategory(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid id")
		return
	}
	if err := h.svc.Queries().DeleteCategory(r.Context(), id); err != nil {
		response.Internal(w, "delete failed")
		return
	}
	response.OK(w, map[string]string{"message": "deleted"})
}

func (h *Handler) UpdateBanner(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid id")
		return
	}
	var body struct {
		Title     string `json:"title"`
		Subtitle  string `json:"subtitle"`
		ImageURL  string `json:"image_url"`
		LinkURL   string `json:"link_url"`
		SortOrder int32  `json:"sort_order"`
		Active    bool   `json:"active"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.BadRequest(w, "invalid body")
		return
	}
	b := db.Banner{ID: id, Title: body.Title, Subtitle: body.Subtitle, SortOrder: body.SortOrder, Active: body.Active}
	if body.ImageURL != "" {
		b.ImageURL = pgtype.Text{String: body.ImageURL, Valid: true}
	}
	if body.LinkURL != "" {
		b.LinkURL = pgtype.Text{String: body.LinkURL, Valid: true}
	}
	if err := h.svc.Queries().UpdateBanner(r.Context(), b); err != nil {
		response.Internal(w, "update failed")
		return
	}
	response.OK(w, map[string]string{"message": "updated"})
}

func (h *Handler) DeleteBanner(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid id")
		return
	}
	if err := h.svc.Queries().DeleteBanner(r.Context(), id); err != nil {
		response.Internal(w, "delete failed")
		return
	}
	response.OK(w, map[string]string{"message": "deleted"})
}

func (h *Handler) ListOrganizers(w http.ResponseWriter, r *http.Request) {
	orgs, err := h.svc.Queries().ListOrganizers(r.Context())
	if err != nil {
		response.Internal(w, "failed to list organizers")
		return
	}
	items := make([]map[string]interface{}, 0, len(orgs))
	for _, o := range orgs {
		items = append(items, map[string]interface{}{
			"id": o.ID, "email": o.Email, "full_name": o.FullName,
			"event_count": o.EventCount, "created_at": o.CreatedAt,
		})
	}
	response.OK(w, items)
}

func (h *Handler) CreateOrganizer(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email    string `json:"email"`
		FullName string `json:"full_name"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Email == "" || body.Password == "" {
		response.BadRequest(w, "email and password required")
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		response.Internal(w, "failed to create organizer")
		return
	}
	id, err := h.svc.Queries().CreateOrganizerUser(r.Context(), body.Email, body.FullName, string(hash))
	if err != nil {
		response.Internal(w, "failed to create organizer")
		return
	}
	response.Created(w, map[string]interface{}{"id": id, "email": body.Email})
}

func (h *Handler) ListStaff(w http.ResponseWriter, r *http.Request) {
	var eventID *uuid.UUID
	if eid := r.URL.Query().Get("event_id"); eid != "" {
		if id, err := uuid.Parse(eid); err == nil {
			eventID = &id
		}
	}
	rows, err := h.svc.Queries().ListEventStaff(r.Context(), eventID)
	if err != nil {
		response.Internal(w, "failed to list staff")
		return
	}
	items := make([]map[string]interface{}, 0, len(rows))
	for _, s := range rows {
		items = append(items, map[string]interface{}{
			"id": s.ID, "event_id": s.EventID, "user_id": s.UserID,
			"user_email": s.UserEmail, "user_name": s.UserName, "event_title": s.EventTitle,
		})
	}
	response.OK(w, items)
}

func (h *Handler) AssignStaff(w http.ResponseWriter, r *http.Request) {
	var body struct {
		EventID string `json:"event_id"`
		UserID  string `json:"user_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.BadRequest(w, "invalid body")
		return
	}
	eventID, err := uuid.Parse(body.EventID)
	if err != nil {
		response.BadRequest(w, "invalid event_id")
		return
	}
	userID, err := uuid.Parse(body.UserID)
	if err != nil {
		response.BadRequest(w, "invalid user_id")
		return
	}
	if err := h.svc.Queries().AssignEventStaff(r.Context(), eventID, userID); err != nil {
		response.Internal(w, "assign failed")
		return
	}
	response.Created(w, map[string]string{"message": "assigned"})
}

func (h *Handler) RemoveStaff(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid id")
		return
	}
	if err := h.svc.Queries().RemoveEventStaff(r.Context(), id); err != nil {
		response.Internal(w, "remove failed")
		return
	}
	response.OK(w, map[string]string{"message": "removed"})
}

func (h *Handler) ListGateStaff(w http.ResponseWriter, r *http.Request) {
	users, err := h.svc.Queries().ListGateStaffUsers(r.Context())
	if err != nil {
		response.Internal(w, "failed to list gate staff")
		return
	}
	items := make([]map[string]interface{}, 0, len(users))
	for _, u := range users {
		items = append(items, map[string]interface{}{
			"id": u.ID, "email": u.Email, "full_name": u.FullName,
		})
	}
	response.OK(w, items)
}

func (h *Handler) CreateGateStaff(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email    string `json:"email"`
		FullName string `json:"full_name"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Email == "" || body.Password == "" {
		response.BadRequest(w, "email and password required")
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		response.Internal(w, "failed to create gate staff")
		return
	}
	id, err := h.svc.Queries().CreateGateStaffUser(r.Context(), body.Email, body.FullName, string(hash))
	if err != nil {
		response.Internal(w, "failed to create gate staff")
		return
	}
	response.Created(w, map[string]interface{}{"id": id, "email": body.Email})
}

func (h *Handler) ListSettlements(w http.ResponseWriter, r *http.Request) {
	rows, err := h.svc.Queries().ListSettlements(r.Context())
	if err != nil {
		response.Internal(w, "failed to list settlements")
		return
	}
	items := make([]map[string]interface{}, 0, len(rows))
	for _, s := range rows {
		m := map[string]interface{}{
			"id": s.ID, "organizer_id": s.OrganizerID, "organizer_name": s.OrganizerName,
			"period_start": s.PeriodStart, "period_end": s.PeriodEnd,
			"gross_revenue": s.GrossRevenue, "platform_fee": s.PlatformFee,
			"net_payout": s.NetPayout, "status": s.Status, "created_at": s.CreatedAt,
		}
		if s.PaidAt.Valid {
			m["paid_at"] = s.PaidAt.Time
		}
		items = append(items, m)
	}
	response.OK(w, items)
}

func (h *Handler) CreateSettlement(w http.ResponseWriter, r *http.Request) {
	var body struct {
		OrganizerID string `json:"organizer_id"`
		PeriodStart string `json:"period_start"`
		PeriodEnd   string `json:"period_end"`
		FeePercent  int    `json:"fee_percent"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.BadRequest(w, "invalid body")
		return
	}
	orgID, err := uuid.Parse(body.OrganizerID)
	if err != nil {
		response.BadRequest(w, "invalid organizer_id")
		return
	}
	start, _ := time.Parse("2006-01-02", body.PeriodStart)
	end, _ := time.Parse("2006-01-02", body.PeriodEnd)
	if body.FeePercent <= 0 {
		body.FeePercent = 10
	}
	s, err := h.svc.Queries().CreateSettlement(r.Context(), orgID, start, end, body.FeePercent)
	if err != nil {
		response.Internal(w, "failed to create settlement")
		return
	}
	user, _ := authctx.GetUser(r.Context())
	var actorID *uuid.UUID
	if user.ID != uuid.Nil {
		actorID = &user.ID
	}
	h.svc.Audit().Log(r.Context(), actorID, "settlement.create", "settlement", s.ID, nil)
	response.Created(w, map[string]interface{}{"id": s.ID, "net_payout": s.NetPayout})
}

func (h *Handler) MarkSettlementPaid(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid id")
		return
	}
	if err := h.svc.Queries().MarkSettlementPaid(r.Context(), id); err != nil {
		response.Internal(w, "update failed")
		return
	}
	response.OK(w, map[string]string{"message": "marked paid"})
}

func (h *Handler) enqueueRefundBatch(ctx context.Context, eventID uuid.UUID) {
	if h.jobQueue == nil {
		if h.paymentSvc != nil {
			_, _ = h.paymentSvc.RefundEventBookings(ctx, eventID)
		}
		return
	}
	payload, _ := json.Marshal(queue.RefundBatchPayload{EventID: eventID.String()})
	_ = h.jobQueue.Enqueue(ctx, queue.Job{Type: queue.JobRefundBatch, Payload: payload})
}

func (h *Handler) GetOrganizerPayout(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid organizer id")
		return
	}
	acc, err := h.svc.Queries().GetOrganizerPayoutAccount(r.Context(), id)
	if err != nil {
		response.OK(w, map[string]interface{}{})
		return
	}
	response.OK(w, map[string]interface{}{
		"bank_name": acc.BankName, "account_number": acc.AccountNumber, "account_holder": acc.AccountHolder,
	})
}

func (h *Handler) UpsertOrganizerPayout(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid organizer id")
		return
	}
	var body struct {
		BankName      string `json:"bank_name"`
		AccountNumber string `json:"account_number"`
		AccountHolder string `json:"account_holder"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.BankName == "" {
		response.BadRequest(w, "bank details required")
		return
	}
	if err := h.svc.Queries().UpsertOrganizerPayoutAccount(r.Context(), id, body.BankName, body.AccountNumber, body.AccountHolder); err != nil {
		response.Internal(w, "failed to save payout account")
		return
	}
	response.OK(w, map[string]string{"message": "saved"})
}

func (h *Handler) QueueDLQStats(w http.ResponseWriter, r *http.Request) {
	if h.jobQueue == nil {
		response.OK(w, map[string]int64{"dlq_size": 0})
		return
	}
	n, _ := h.jobQueue.DLQSize(r.Context())
	response.OK(w, map[string]int64{"dlq_size": n})
}
