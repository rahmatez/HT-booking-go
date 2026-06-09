package payment

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/rahmatez/high-traffic-booking/backend/internal/booking"
	"github.com/rahmatez/high-traffic-booking/backend/internal/config"
	"github.com/rahmatez/high-traffic-booking/backend/internal/db"
	"github.com/rahmatez/high-traffic-booking/backend/internal/platform/authctx"
	"github.com/rahmatez/high-traffic-booking/backend/internal/platform/response"
)

type Handler struct {
	queries        *db.Queries
	bookingService *booking.Service
	cfg            *config.Config
}

func NewHandler(queries *db.Queries, bookingService *booking.Service, cfg *config.Config) *Handler {
	return &Handler{queries: queries, bookingService: bookingService, cfg: cfg}
}

func (h *Handler) GetStatus(w http.ResponseWriter, r *http.Request) {
	user, ok := authctx.GetUser(r.Context())
	if !ok {
		response.Unauthorized(w, "authentication required")
		return
	}

	paymentID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid payment id")
		return
	}

	payment, err := h.queries.GetPaymentByID(r.Context(), paymentID)
	if err != nil {
		response.NotFound(w, "payment not found")
		return
	}

	bookingRow, err := h.queries.GetBookingByIDForUser(r.Context(), db.GetBookingByIDForUserParams{
		ID:     payment.BookingID,
		UserID: user.ID,
	})
	if err != nil {
		response.Forbidden(w, "access denied")
		return
	}
	_ = bookingRow

	response.OK(w, map[string]interface{}{
		"id":          payment.ID,
		"booking_id":  payment.BookingID,
		"status":      payment.Status,
		"amount":      payment.Amount,
		"gateway":     payment.Gateway,
		"gateway_ref": payment.GatewayRef,
		"paid_at":     payment.PaidAt,
	})
}

// SimulatePayment — development only: mark booking as paid and confirm.
func (h *Handler) SimulatePayment(w http.ResponseWriter, r *http.Request) {
	if h.cfg.AppEnv == "production" {
		response.Forbidden(w, "not available in production")
		return
	}

	user, ok := authctx.GetUser(r.Context())
	if !ok {
		response.Unauthorized(w, "authentication required")
		return
	}

	var body struct {
		BookingID uuid.UUID `json:"booking_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.BadRequest(w, "invalid request body")
		return
	}

	bookingRow, err := h.queries.GetBookingByIDForUser(r.Context(), db.GetBookingByIDForUserParams{
		ID:     body.BookingID,
		UserID: user.ID,
	})
	if err != nil {
		response.NotFound(w, "booking not found")
		return
	}

	if err := h.bookingService.ConfirmPayment(r.Context(), bookingRow.ID); err != nil {
		response.Internal(w, "failed to confirm payment")
		return
	}

	response.OK(w, map[string]interface{}{
		"message":    "payment simulated successfully",
		"booking_id": bookingRow.ID,
		"status":     "confirmed",
	})
}

func (h *Handler) Webhook(w http.ResponseWriter, r *http.Request) {
	gateway := chi.URLParam(r, "gateway")
	_ = gateway
	// TODO: verify signature and process webhook (Midtrans/Xendit)
	response.OK(w, map[string]string{"message": "webhook received"})
}
