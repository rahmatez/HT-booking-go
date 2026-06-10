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
	category := q.Get("category")
	city := q.Get("city")
	dateFrom := q.Get("date_from")
	dateTo := q.Get("date_to")
	priceMin, _ := strconv.ParseInt(q.Get("price_min"), 10, 64)
	priceMax, _ := strconv.ParseInt(q.Get("price_max"), 10, 64)
	page, _ := strconv.Atoi(q.Get("page"))
	perPage, _ := strconv.Atoi(q.Get("per_page"))

	events, total, err := h.svc.ListEventsFiltered(r.Context(), ListEventsFilter{
		Search: search, CategorySlug: category, City: city,
		DateFrom: dateFrom, DateTo: dateTo, PriceMin: priceMin, PriceMax: priceMax,
		Page: page, PerPage: perPage,
	})
	if err != nil {
		response.Internal(w, "failed to list events")
		return
	}

	items := make([]map[string]interface{}, 0, len(events))
	for _, e := range events {
		items = append(items, publishedEventToMap(e))
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

func (h *Handler) Homepage(w http.ResponseWriter, r *http.Request) {
	data, err := h.svc.GetHomepage(r.Context())
	if err != nil {
		response.Internal(w, "failed to load homepage")
		return
	}
	banners := make([]map[string]interface{}, 0, len(data.Banners))
	for _, b := range data.Banners {
		m := map[string]interface{}{
			"id": b.ID, "title": b.Title, "subtitle": b.Subtitle, "sort_order": b.SortOrder,
		}
		if b.ImageURL.Valid {
			m["image_url"] = b.ImageURL.String
		}
		if b.LinkURL.Valid {
			m["link_url"] = b.LinkURL.String
		}
		banners = append(banners, m)
	}
	categories := make([]map[string]interface{}, 0, len(data.Categories))
	for _, c := range data.Categories {
		categories = append(categories, map[string]interface{}{
			"id": c.ID, "slug": c.Slug, "name": c.Name,
		})
	}
	events := make([]map[string]interface{}, 0, len(data.Events))
	for _, e := range data.Events {
		events = append(events, publishedEventToMap(e))
	}
	response.OK(w, map[string]interface{}{
		"banners": banners, "categories": categories, "events": events,
	})
}

func (h *Handler) ListCategories(w http.ResponseWriter, r *http.Request) {
	cats, err := h.svc.ListCategories(r.Context())
	if err != nil {
		response.Internal(w, "failed to list categories")
		return
	}
	items := make([]map[string]interface{}, 0, len(cats))
	for _, c := range cats {
		items = append(items, map[string]interface{}{"id": c.ID, "slug": c.Slug, "name": c.Name})
	}
	response.OK(w, items)
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
