package booking

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/rahmatez/high-traffic-booking/backend/internal/platform/authctx"
	"github.com/rahmatez/high-traffic-booking/backend/internal/platform/response"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Hold(w http.ResponseWriter, r *http.Request) {
	user, ok := authctx.GetUser(r.Context())
	if !ok {
		response.Unauthorized(w, "authentication required")
		return
	}

	idempotencyKey := r.Header.Get("Idempotency-Key")
	if idempotencyKey == "" {
		response.BadRequest(w, "Idempotency-Key header is required")
		return
	}

	var in HoldInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		response.BadRequest(w, "invalid request body")
		return
	}

	booking, items, err := h.svc.Hold(r.Context(), user.ID, idempotencyKey, in)
	if err != nil {
		switch {
		case errors.Is(err, ErrInventoryExhausted):
			response.Conflict(w, "INVENTORY_EXHAUSTED", "tiket sudah habis")
		case errors.Is(err, ErrHoldLimitReached):
			response.Conflict(w, "HOLD_LIMIT_REACHED", "terlalu banyak hold aktif")
		default:
			response.BadRequest(w, err.Error())
		}
		return
	}

	response.Created(w, BookingToMap(*booking, items))
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
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

	booking, items, err := h.svc.GetByID(r.Context(), user.ID, bookingID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			response.NotFound(w, "booking not found")
			return
		}
		response.Internal(w, "failed to get booking")
		return
	}

	response.OK(w, BookingToMap(*booking, items))
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	user, ok := authctx.GetUser(r.Context())
	if !ok {
		response.Unauthorized(w, "authentication required")
		return
	}

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	perPage, _ := strconv.Atoi(r.URL.Query().Get("per_page"))

	bookings, err := h.svc.ListByUser(r.Context(), user.ID, page, perPage)
	if err != nil {
		response.Internal(w, "failed to list bookings")
		return
	}

	items := make([]map[string]interface{}, 0, len(bookings))
	for _, b := range bookings {
		items = append(items, map[string]interface{}{
			"id":              b.ID,
			"event_id":        b.EventID,
			"event_title":     b.EventTitle,
			"event_slug":      b.EventSlug,
			"event_starts_at": b.EventStartsAt,
			"status":          b.Status,
			"total_amount":    b.TotalAmount,
			"hold_expires_at": b.HoldExpiresAt,
			"created_at":      b.CreatedAt,
		})
	}

	response.OK(w, items)
}

func (h *Handler) Cancel(w http.ResponseWriter, r *http.Request) {
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

	if err := h.svc.Cancel(r.Context(), user.ID, bookingID); err != nil {
		if errors.Is(err, ErrNotFound) {
			response.NotFound(w, "booking not found")
			return
		}
		if errors.Is(err, ErrInvalidStatus) {
			response.Conflict(w, "INVALID_STATUS", "booking cannot be cancelled")
			return
		}
		response.Internal(w, "failed to cancel booking")
		return
	}

	response.OK(w, map[string]string{"message": "booking cancelled"})
}

func (h *Handler) Confirm(w http.ResponseWriter, r *http.Request) {
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

	booking, err := h.svc.StartPayment(r.Context(), user.ID, bookingID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			response.NotFound(w, "booking not found")
			return
		}
		if errors.Is(err, ErrInvalidStatus) {
			response.Conflict(w, "INVALID_STATUS", "booking tidak dapat diproses")
			return
		}
		response.BadRequest(w, err.Error())
		return
	}

	response.OK(w, map[string]interface{}{
		"booking_id":      booking.ID,
		"status":          booking.Status,
		"total_amount":    booking.TotalAmount,
		"hold_expires_at": booking.HoldExpiresAt,
		"payment_url":     "/checkout/" + booking.ID.String(),
		"message":         "booking siap dibayar — gunakan POST /payments/checkout untuk Snap token",
	})
}
