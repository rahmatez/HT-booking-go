package checkin

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/rahmatez/high-traffic-booking/backend/internal/db"
	"github.com/rahmatez/high-traffic-booking/backend/internal/platform/authctx"
	"github.com/rahmatez/high-traffic-booking/backend/internal/platform/response"
)

type Handler struct {
	queries *db.Queries
}

func NewHandler(queries *db.Queries) *Handler {
	return &Handler{queries: queries}
}

func (h *Handler) Scan(w http.ResponseWriter, r *http.Request) {
	var body struct {
		TicketCode string `json:"ticket_code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.TicketCode == "" {
		response.BadRequest(w, "ticket_code is required")
		return
	}

	ticket, eventID, eventTitle, userName, err := h.queries.GetTicketForCheckIn(r.Context(), body.TicketCode)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			response.NotFound(w, "ticket not found")
			return
		}
		response.Internal(w, "failed to lookup ticket")
		return
	}

	user, _ := authctx.GetUser(r.Context())
	if user.Role == "gate_staff" {
		ok, err := h.queries.UserIsEventStaff(r.Context(), user.ID, eventID)
		if err != nil || !ok {
			response.Forbidden(w, "not assigned to this event")
			return
		}
	}

	if ticket.Status == "used" || ticket.CheckedInAt.Valid {
		response.Fail(w, http.StatusConflict, "ALREADY_USED", "tiket sudah discan")
		return
	}
	if ticket.Status != "active" {
		response.Fail(w, http.StatusConflict, "INVALID_TICKET", "tiket tidak aktif")
		return
	}

	checked, err := h.queries.CheckInTicket(r.Context(), body.TicketCode)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			response.Fail(w, http.StatusConflict, "ALREADY_USED", "tiket sudah discan")
			return
		}
		response.Internal(w, "check-in failed")
		return
	}

	response.OK(w, map[string]interface{}{
		"ticket_code":   checked.TicketCode,
		"event_title":   eventTitle,
		"holder_name":   userName,
		"checked_in_at": checked.CheckedInAt,
		"message":       "Check-in berhasil",
	})
}

func (h *Handler) Stats(w http.ResponseWriter, r *http.Request) {
	eventID, err := uuid.Parse(chi.URLParam(r, "eventId"))
	if err != nil {
		response.BadRequest(w, "invalid event id")
		return
	}
	checkedIn, total, err := h.queries.CountCheckedInByEvent(r.Context(), eventID)
	if err != nil {
		response.Internal(w, "failed to load stats")
		return
	}
	response.OK(w, map[string]interface{}{
		"checked_in": checkedIn,
		"total":      total,
	})
}
