package payment

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/rahmatez/high-traffic-booking/backend/internal/booking"
	"github.com/rahmatez/high-traffic-booking/backend/internal/config"
	"github.com/rahmatez/high-traffic-booking/backend/internal/db"
	"github.com/rahmatez/high-traffic-booking/backend/internal/payment/midtrans"
	"github.com/rahmatez/high-traffic-booking/backend/internal/platform/authctx"
	"github.com/rahmatez/high-traffic-booking/backend/internal/platform/response"
)

type Handler struct {
	svc            *Service
	queries        *db.Queries
	bookingService *booking.Service
	cfg            *config.Config
}

func NewHandler(svc *Service, queries *db.Queries, bookingService *booking.Service, cfg *config.Config) *Handler {
	return &Handler{svc: svc, queries: queries, bookingService: bookingService, cfg: cfg}
}

func (h *Handler) Checkout(w http.ResponseWriter, r *http.Request) {
	user, ok := authctx.GetUser(r.Context())
	if !ok {
		response.Unauthorized(w, "authentication required")
		return
	}

	var body struct {
		BookingID uuid.UUID `json:"booking_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.BookingID == uuid.Nil {
		response.BadRequest(w, "booking_id is required")
		return
	}

	result, err := h.svc.Checkout(r.Context(), user.ID, body.BookingID)
	if err != nil {
		switch {
		case err == ErrNotConfigured:
			response.Fail(w, http.StatusServiceUnavailable, "PAYMENT_NOT_CONFIGURED", "payment gateway belum dikonfigurasi")
		case err == booking.ErrNotFound:
			response.NotFound(w, "booking not found")
		case err == booking.ErrInvalidStatus:
			response.Conflict(w, "INVALID_STATUS", "booking tidak dapat dibayar")
		default:
			response.BadRequest(w, err.Error())
		}
		return
	}

	response.OK(w, result)
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

	_, err = h.queries.GetBookingByIDForUser(r.Context(), db.GetBookingByIDForUserParams{
		ID:     payment.BookingID,
		UserID: user.ID,
	})
	if err != nil {
		response.Forbidden(w, "access denied")
		return
	}

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

// SimulatePayment — development fallback when Midtrans keys are not set.
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

	if bookingRow.Status == string(db.BookingStatusHeld) {
		if _, err := h.bookingService.StartPayment(r.Context(), user.ID, body.BookingID); err != nil {
			response.BadRequest(w, err.Error())
			return
		}
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

func (h *Handler) Sync(w http.ResponseWriter, r *http.Request) {
	user, ok := authctx.GetUser(r.Context())
	if !ok {
		response.Unauthorized(w, "authentication required")
		return
	}

	var body struct {
		BookingID uuid.UUID `json:"booking_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.BookingID == uuid.Nil {
		response.BadRequest(w, "booking_id is required")
		return
	}

	status, err := h.svc.SyncBookingPayment(r.Context(), user.ID, body.BookingID)
	if err != nil {
		if err == booking.ErrNotFound {
			response.NotFound(w, "booking not found")
			return
		}
		response.BadRequest(w, err.Error())
		return
	}

	response.OK(w, map[string]string{"status": status})
}

func (h *Handler) Webhook(w http.ResponseWriter, r *http.Request) {
	gateway := chi.URLParam(r, "gateway")
	if gateway != "midtrans" {
		response.NotFound(w, "unknown gateway")
		return
	}

	var notif midtrans.TransactionStatus
	if err := json.NewDecoder(r.Body).Decode(&notif); err != nil {
		response.BadRequest(w, "invalid notification body")
		return
	}

	if err := h.svc.HandleMidtransNotification(r.Context(), notif); err != nil {
		response.BadRequest(w, err.Error())
		return
	}

	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"ok"}`))
}
