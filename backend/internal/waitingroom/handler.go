package waitingroom

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/rahmatez/high-traffic-booking/backend/internal/platform/response"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Join(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	result, err := h.svc.Join(r.Context(), slug)
	if err != nil {
		response.NotFound(w, "event not found")
		return
	}
	response.OK(w, result)
}

func (h *Handler) Status(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	token := r.URL.Query().Get("token")
	if token == "" {
		response.BadRequest(w, "token required")
		return
	}
	result, err := h.svc.Status(r.Context(), slug, token)
	if err != nil {
		response.NotFound(w, err.Error())
		return
	}
	response.OK(w, result)
}

func (h *Handler) Config(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	enabled, capacity, err := h.svc.GetConfig(r.Context(), slug)
	if err != nil {
		response.NotFound(w, "event not found")
		return
	}
	response.OK(w, map[string]interface{}{
		"enabled":  enabled,
		"capacity": capacity,
	})
}
