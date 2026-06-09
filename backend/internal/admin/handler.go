package admin

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/rahmatez/high-traffic-booking/backend/internal/catalog"
	"github.com/rahmatez/high-traffic-booking/backend/internal/platform/response"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) DashboardStats(w http.ResponseWriter, r *http.Request) {
	stats, err := h.svc.DashboardStats(r.Context())
	if err != nil {
		response.Internal(w, "failed to load stats")
		return
	}
	response.OK(w, map[string]interface{}{
		"total_events":       stats.TotalEvents,
		"published_events":   stats.PublishedEvents,
		"total_bookings":     stats.TotalBookings,
		"confirmed_bookings": stats.ConfirmedBookings,
		"total_revenue":      stats.TotalRevenue,
		"tickets_sold":       stats.TicketsSold,
	})
}

func (h *Handler) ListEvents(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	status := q.Get("status")
	search := q.Get("q")
	page, _ := strconv.Atoi(q.Get("page"))
	perPage, _ := strconv.Atoi(q.Get("per_page"))

	events, total, err := h.svc.ListEvents(r.Context(), status, search, page, perPage)
	if err != nil {
		response.Internal(w, "failed to list events")
		return
	}

	items := make([]map[string]interface{}, 0, len(events))
	for _, e := range events {
		m := map[string]interface{}{
			"id":         e.ID,
			"slug":       e.Slug,
			"title":      e.Title,
			"status":     e.Status,
			"starts_at":  e.StartsAt,
			"ends_at":    e.EndsAt,
			"created_at": e.CreatedAt,
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
	response.OKWithMeta(w, items, response.Meta{Page: page, PerPage: perPage, Total: total})
}

func (h *Handler) GetEvent(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid event id")
		return
	}

	event, types, err := h.svc.GetEvent(r.Context(), id)
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
		ticketTypes = append(ticketTypes, catalog.TicketTypeToMap(tt))
	}

	response.OK(w, map[string]interface{}{
		"event":        catalog.EventToMap(*event, "", ""),
		"ticket_types": ticketTypes,
	})
}

func (h *Handler) CreateEvent(w http.ResponseWriter, r *http.Request) {
	var in catalog.CreateEventInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		response.BadRequest(w, "invalid request body")
		return
	}
	if in.Title == "" || in.StartsAt.IsZero() || in.EndsAt.IsZero() {
		response.BadRequest(w, "title, starts_at, and ends_at are required")
		return
	}

	event, err := h.svc.Catalog().CreateEvent(r.Context(), in)
	if err != nil {
		response.Internal(w, "failed to create event")
		return
	}
	response.Created(w, catalog.EventToMap(event, "", ""))
}

func (h *Handler) UpdateEvent(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid event id")
		return
	}

	var in catalog.CreateEventInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		response.BadRequest(w, "invalid request body")
		return
	}

	event, err := h.svc.Catalog().UpdateEvent(r.Context(), id, in)
	if err != nil {
		response.Internal(w, "failed to update event")
		return
	}
	response.OK(w, catalog.EventToMap(event, "", ""))
}

func (h *Handler) CreateTicketType(w http.ResponseWriter, r *http.Request) {
	eventID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid event id")
		return
	}

	var in catalog.CreateTicketTypeInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		response.BadRequest(w, "invalid request body")
		return
	}

	tt, err := h.svc.Catalog().CreateTicketType(r.Context(), eventID, in)
	if err != nil {
		response.Internal(w, "failed to create ticket type")
		return
	}
	response.Created(w, catalog.TicketTypeToMap(tt))
}

func (h *Handler) CreateVenue(w http.ResponseWriter, r *http.Request) {
	var in catalog.CreateVenueInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		response.BadRequest(w, "invalid request body")
		return
	}

	venue, err := h.svc.Catalog().CreateVenue(r.Context(), in)
	if err != nil {
		response.Internal(w, "failed to create venue")
		return
	}
	response.Created(w, venue)
}

func (h *Handler) ListVenues(w http.ResponseWriter, r *http.Request) {
	venues, err := h.svc.ListVenues(r.Context())
	if err != nil {
		response.Internal(w, "failed to list venues")
		return
	}
	response.OK(w, venues)
}

func (h *Handler) ListBookings(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	status := q.Get("status")
	eventID := q.Get("event_id")
	if eventID != "" {
		if _, err := uuid.Parse(eventID); err != nil {
			response.BadRequest(w, "invalid event_id")
			return
		}
	}
	page, _ := strconv.Atoi(q.Get("page"))
	perPage, _ := strconv.Atoi(q.Get("per_page"))

	bookings, total, err := h.svc.ListBookings(r.Context(), status, eventID, page, perPage)
	if err != nil {
		response.Internal(w, "failed to list bookings")
		return
	}

	items := make([]map[string]interface{}, 0, len(bookings))
	for _, b := range bookings {
		items = append(items, map[string]interface{}{
			"id":            b.ID,
			"user_id":       b.UserID,
			"user_email":    b.UserEmail,
			"user_name":     b.UserName,
			"event_id":      b.EventID,
			"event_title":   b.EventTitle,
			"event_slug":    b.EventSlug,
			"status":        b.Status,
			"total_amount":  b.TotalAmount,
			"hold_expires_at": b.HoldExpiresAt,
			"created_at":    b.CreatedAt,
		})
	}

	if perPage <= 0 {
		perPage = 20
	}
	if page <= 0 {
		page = 1
	}
	response.OKWithMeta(w, items, response.Meta{Page: page, PerPage: perPage, Total: total})
}

func (h *Handler) GetBooking(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid booking id")
		return
	}

	booking, items, err := h.svc.GetBooking(r.Context(), id)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			response.NotFound(w, "booking not found")
			return
		}
		response.Internal(w, "failed to get booking")
		return
	}

	itemMaps := make([]map[string]interface{}, 0, len(items))
	for _, it := range items {
		itemMaps = append(itemMaps, map[string]interface{}{
			"id":               it.ID,
			"ticket_type_id":   it.TicketTypeID,
			"ticket_type_name": it.TicketTypeName,
			"quantity":         it.Quantity,
			"unit_price":       it.UnitPrice,
		})
	}

	response.OK(w, map[string]interface{}{
		"id":            booking.ID,
		"user_email":    booking.UserEmail,
		"user_name":     booking.UserName,
		"event_title":   booking.EventTitle,
		"event_slug":    booking.EventSlug,
		"status":        booking.Status,
		"total_amount":  booking.TotalAmount,
		"created_at":      booking.CreatedAt,
		"items":         itemMaps,
	})
}
