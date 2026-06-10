package admin

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/rahmatez/high-traffic-booking/backend/internal/db"
	"github.com/rahmatez/high-traffic-booking/backend/internal/platform/authctx"
	"github.com/rahmatez/high-traffic-booking/backend/internal/platform/response"
)

func (h *Handler) ListCategories(w http.ResponseWriter, r *http.Request) {
	cats, err := h.svc.Queries().ListCategories(r.Context())
	if err != nil {
		response.Internal(w, "failed to list categories")
		return
	}
	items := make([]map[string]interface{}, 0, len(cats))
	for _, c := range cats {
		items = append(items, map[string]interface{}{
			"id": c.ID, "slug": c.Slug, "name": c.Name, "sort_order": c.SortOrder,
		})
	}
	response.OK(w, items)
}

func (h *Handler) CreateCategory(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Slug      string `json:"slug"`
		Name      string `json:"name"`
		SortOrder int32  `json:"sort_order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Slug == "" || body.Name == "" {
		response.BadRequest(w, "slug and name required")
		return
	}
	c, err := h.svc.Queries().CreateCategory(r.Context(), body.Slug, body.Name, body.SortOrder)
	if err != nil {
		response.Internal(w, "failed to create category")
		return
	}
	response.Created(w, map[string]interface{}{"id": c.ID, "slug": c.Slug, "name": c.Name})
}

func (h *Handler) ListBanners(w http.ResponseWriter, r *http.Request) {
	banners, err := h.svc.Queries().ListAllBanners(r.Context())
	if err != nil {
		response.Internal(w, "failed to list banners")
		return
	}
	items := make([]map[string]interface{}, 0, len(banners))
	for _, b := range banners {
		m := map[string]interface{}{
			"id": b.ID, "title": b.Title, "subtitle": b.Subtitle,
			"sort_order": b.SortOrder, "active": b.Active,
		}
		if b.ImageURL.Valid {
			m["image_url"] = b.ImageURL.String
		}
		if b.LinkURL.Valid {
			m["link_url"] = b.LinkURL.String
		}
		items = append(items, m)
	}
	response.OK(w, items)
}

func (h *Handler) CreateBanner(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Title     string `json:"title"`
		Subtitle  string `json:"subtitle"`
		ImageURL  string `json:"image_url"`
		LinkURL   string `json:"link_url"`
		SortOrder int32  `json:"sort_order"`
		Active    bool   `json:"active"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Title == "" {
		response.BadRequest(w, "title required")
		return
	}
	b := db.Banner{Title: body.Title, Subtitle: body.Subtitle, SortOrder: body.SortOrder, Active: body.Active}
	if body.ImageURL != "" {
		b.ImageURL = pgtype.Text{String: body.ImageURL, Valid: true}
	}
	if body.LinkURL != "" {
		b.LinkURL = pgtype.Text{String: body.LinkURL, Valid: true}
	}
	created, err := h.svc.Queries().CreateBanner(r.Context(), b)
	if err != nil {
		response.Internal(w, "failed to create banner")
		return
	}
	response.Created(w, map[string]interface{}{"id": created.ID, "title": created.Title})
}

func (h *Handler) ListModeration(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	perPage, _ := strconv.Atoi(r.URL.Query().Get("per_page"))
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage

	events, err := h.svc.Queries().ListDraftEventsForModeration(r.Context(), int32(perPage), int32(offset))
	if err != nil {
		response.Internal(w, "failed to list draft events")
		return
	}
	total, _ := h.svc.Queries().CountDraftEventsForModeration(r.Context())

	items := make([]map[string]interface{}, 0, len(events))
	for _, e := range events {
		m := map[string]interface{}{
			"id": e.ID, "slug": e.Slug, "title": e.Title, "status": e.Status,
			"starts_at": e.StartsAt, "ends_at": e.EndsAt, "created_at": e.CreatedAt,
		}
		if e.VenueName.Valid {
			m["venue_name"] = e.VenueName.String
		}
		if e.VenueCity.Valid {
			m["venue_city"] = e.VenueCity.String
		}
		items = append(items, m)
	}
	response.OKWithMeta(w, items, response.Meta{Page: page, PerPage: perPage, Total: total})
}

func (h *Handler) ModerateEvent(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid event id")
		return
	}
	var body struct {
		Action string `json:"action"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.BadRequest(w, "invalid body")
		return
	}
	status := ""
	switch body.Action {
	case "approve":
		status = "published"
	case "reject":
		status = "cancelled"
	default:
		response.BadRequest(w, "action must be approve or reject")
		return
	}
	if err := h.svc.Queries().ModerateEventStatus(r.Context(), id, status); err != nil {
		response.Internal(w, "moderation failed")
		return
	}
	user, _ := authctx.GetUser(r.Context())
	var actorID *uuid.UUID
	if user.ID != uuid.Nil {
		actorID = &user.ID
	}
	h.svc.Audit().Log(r.Context(), actorID, "event.moderate", "event", id, map[string]interface{}{"action": body.Action, "status": status})
	response.OK(w, map[string]string{"status": status})
}
