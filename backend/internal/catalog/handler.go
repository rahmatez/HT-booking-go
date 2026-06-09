package catalog

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/rahmatez/high-traffic-booking/backend/internal/platform/response"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) ListEvents(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	search := q.Get("q")
	page, _ := strconv.Atoi(q.Get("page"))
	perPage, _ := strconv.Atoi(q.Get("per_page"))

	events, total, err := h.svc.ListEvents(r.Context(), search, page, perPage)
	if err != nil {
		response.Internal(w, "failed to list events")
		return
	}

	items := make([]map[string]interface{}, 0, len(events))
	for _, e := range events {
		m := map[string]interface{}{
			"id":          e.ID,
			"slug":        e.Slug,
			"title":       e.Title,
			"description": e.Description,
			"status":      e.Status,
			"starts_at":   e.StartsAt,
			"ends_at":     e.EndsAt,
			"created_at":  e.CreatedAt,
		}
		if e.VenueID.Valid {
			m["venue_id"] = uuid.UUID(e.VenueID.Bytes)
		}
		if e.CoverImageUrl.Valid {
			m["cover_image_url"] = e.CoverImageUrl.String
		}
		if e.VenueName.Valid {
			m["venue_name"] = e.VenueName.String
		}
		if e.VenueCity.Valid {
			m["venue_city"] = e.VenueCity.String
		}
		items = append(items, m)
	}

	if perPage <= 0 {
		perPage = 20
	}
	if page <= 0 {
		page = 1
	}

	response.OKWithMeta(w, items, response.Meta{
		Page:    page,
		PerPage: perPage,
		Total:   total,
	})
}

func (h *Handler) GetEvent(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	event, types, err := h.svc.GetEventBySlug(r.Context(), slug)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			response.NotFound(w, "event not found")
			return
		}
		response.Internal(w, "failed to get event")
		return
	}

	ticketTypes := make([]map[string]interface{}, 0, len(types))
	for _, tt := range types {
		ticketTypes = append(ticketTypes, TicketTypeToMap(tt))
	}

	response.OK(w, map[string]interface{}{
		"event":        EventToMap(*event, "", ""),
		"ticket_types": ticketTypes,
	})
}

func (h *Handler) GetAvailability(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	avail, err := h.svc.GetAvailability(r.Context(), slug)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			response.NotFound(w, "event not found")
			return
		}
		response.Internal(w, "failed to get availability")
		return
	}
	response.OK(w, avail)
}

func (h *Handler) CreateEvent(w http.ResponseWriter, r *http.Request) {
	var in CreateEventInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		response.BadRequest(w, "invalid request body")
		return
	}
	if in.Title == "" || in.StartsAt.IsZero() || in.EndsAt.IsZero() {
		response.BadRequest(w, "title, starts_at, and ends_at are required")
		return
	}

	event, err := h.svc.CreateEvent(r.Context(), in)
	if err != nil {
		response.Internal(w, "failed to create event")
		return
	}
	response.Created(w, EventToMap(event, "", ""))
}

func (h *Handler) UpdateEvent(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid event id")
		return
	}

	var in CreateEventInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		response.BadRequest(w, "invalid request body")
		return
	}

	event, err := h.svc.UpdateEvent(r.Context(), id, in)
	if err != nil {
		response.Internal(w, "failed to update event")
		return
	}
	response.OK(w, EventToMap(event, "", ""))
}

func (h *Handler) CreateTicketType(w http.ResponseWriter, r *http.Request) {
	eventID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid event id")
		return
	}

	var in CreateTicketTypeInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		response.BadRequest(w, "invalid request body")
		return
	}

	tt, err := h.svc.CreateTicketType(r.Context(), eventID, in)
	if err != nil {
		response.Internal(w, "failed to create ticket type")
		return
	}
	response.Created(w, TicketTypeToMap(tt))
}

func (h *Handler) CreateVenue(w http.ResponseWriter, r *http.Request) {
	var in CreateVenueInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		response.BadRequest(w, "invalid request body")
		return
	}

	venue, err := h.svc.CreateVenue(r.Context(), in)
	if err != nil {
		response.Internal(w, "failed to create venue")
		return
	}
	response.Created(w, venue)
}
