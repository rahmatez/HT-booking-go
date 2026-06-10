package ticket

import (
	"fmt"
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

func (h *Handler) DownloadPDF(w http.ResponseWriter, r *http.Request) {
	user, ok := authctx.GetUser(r.Context())
	if !ok {
		response.Unauthorized(w, "authentication required")
		return
	}

	bookingID, err := uuid.Parse(chi.URLParam(r, "bookingId"))
	if err != nil {
		response.BadRequest(w, "invalid booking id")
		return
	}
	ticketID, err := uuid.Parse(chi.URLParam(r, "ticketId"))
	if err != nil {
		response.BadRequest(w, "invalid ticket id")
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
		response.Internal(w, "failed to load ticket")
		return
	}

	var found *db.ListTicketsByBookingRow
	for i := range tickets {
		if tickets[i].ID == ticketID {
			found = &tickets[i]
			break
		}
	}
	if found == nil {
		response.NotFound(w, "ticket not found")
		return
	}

	booking, err := h.queries.GetBookingByIDAdmin(r.Context(), bookingID)
	if err != nil {
		response.Internal(w, "failed to load booking")
		return
	}

	pdfBytes, err := GeneratePDF(PDFInput{
		EventTitle: booking.EventTitle,
		HolderName: booking.UserName,
		TicketCode: found.TicketCode,
		TicketType: found.TicketTypeName,
		BookingID:  bookingID.String(),
	})
	if err != nil {
		response.Internal(w, "failed to generate pdf")
		return
	}

	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="ticket-%s.pdf"`, found.TicketCode))
	w.Write(pdfBytes)
}
