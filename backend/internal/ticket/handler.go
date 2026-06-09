package ticket

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

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

func (h *Handler) ListByBooking(w http.ResponseWriter, r *http.Request) {
	user, ok := authctx.GetUser(r.Context())
	if !ok {
		response.Unauthorized(w, "authentication required")
		return
	}

	bookingID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid booking id")
		return
	}

	if _, err := h.queries.GetBookingByIDForUser(r.Context(), db.GetBookingByIDForUserParams{
		ID:     bookingID,
		UserID: user.ID,
	}); err != nil {
		response.NotFound(w, "booking not found")
		return
	}

	tickets, err := h.queries.ListTicketsByBooking(r.Context(), bookingID)
	if err != nil {
		response.Internal(w, "failed to list tickets")
		return
	}

	items := make([]map[string]interface{}, 0, len(tickets))
	for _, t := range tickets {
		items = append(items, map[string]interface{}{
			"id":               t.ID,
			"ticket_code":      t.TicketCode,
			"ticket_type_name": t.TicketTypeName,
			"status":           t.Status,
			"checked_in_at":    t.CheckedInAt,
			"created_at":       t.CreatedAt,
		})
	}

	response.OK(w, items)
}

func (h *Handler) GetByCode(w http.ResponseWriter, r *http.Request) {
	user, ok := authctx.GetUser(r.Context())
	if !ok {
		response.Unauthorized(w, "authentication required")
		return
	}

	code := chi.URLParam(r, "code")
	ticket, err := h.queries.GetTicketByCode(r.Context(), code)
	if err != nil {
		response.NotFound(w, "ticket not found")
		return
	}

	bookingRow, err := h.queries.GetBookingByIDForUser(r.Context(), db.GetBookingByIDForUserParams{
		ID:     ticket.BookingID,
		UserID: user.ID,
	})
	if err != nil {
		response.Forbidden(w, "access denied")
		return
	}
	_ = bookingRow

	response.OK(w, map[string]interface{}{
		"id":          ticket.ID,
		"ticket_code": ticket.TicketCode,
		"status":      ticket.Status,
		"booking_id":  ticket.BookingID,
	})
}
