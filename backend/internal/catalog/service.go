package catalog

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/rahmatez/high-traffic-booking/backend/internal/config"
	"github.com/rahmatez/high-traffic-booking/backend/internal/db"
	redisutil "github.com/rahmatez/high-traffic-booking/backend/internal/platform/redis"
)

var ErrNotFound = errors.New("not found")

type eventDetailCache struct {
	Event       db.Event        `json:"event"`
	TicketTypes []db.TicketType `json:"ticket_types"`
	VenueName   string          `json:"venue_name"`
	VenueCity   string          `json:"venue_city"`
}

type Service struct {
	queries *db.Queries
	cache   *redisutil.Cache
	cfg     *config.Config
}

func NewService(queries *db.Queries, cache *redisutil.Cache, cfg *config.Config) *Service {
	return &Service{queries: queries, cache: cache, cfg: cfg}
}

type CreateEventInput struct {
	Slug                 string                 `json:"slug"`
	Title                string                 `json:"title"`
	Description          string                 `json:"description"`
	VenueID              *uuid.UUID             `json:"venue_id"`
	CategoryID           *uuid.UUID             `json:"category_id"`
	CoverImageURL        string                 `json:"cover_image_url"`
	Status               string                 `json:"status"`
	StartsAt             time.Time              `json:"starts_at"`
	EndsAt               time.Time              `json:"ends_at"`
	Metadata             map[string]interface{} `json:"metadata"`
	WaitingRoomEnabled   bool                   `json:"waiting_room_enabled"`
	WaitingRoomCapacity  int32                  `json:"waiting_room_capacity"`
}

type CreateTicketTypeInput struct {
	Name         string    `json:"name"`
	Price        int64     `json:"price"`
	TotalQuota   int32     `json:"total_quota"`
	MaxPerOrder  int32     `json:"max_per_order"`
	SalesStartAt time.Time `json:"sales_start_at"`
	SalesEndAt   time.Time `json:"sales_end_at"`
}

type CreateVenueInput struct {
	Name      string   `json:"name"`
	Address   string   `json:"address"`
	City      string   `json:"city"`
	Capacity  int32    `json:"capacity"`
	Latitude  *float64 `json:"latitude"`
	Longitude *float64 `json:"longitude"`
}

type ListEventsFilter struct {
	Search       string
	CategorySlug string
	City         string
	DateFrom     string
	DateTo       string
	PriceMin     int64
	PriceMax     int64
	Page         int
	PerPage      int
}

func (s *Service) ListEventsFiltered(ctx context.Context, f ListEventsFilter) ([]db.PublishedEventRow, int64, error) {
	page, perPage := f.Page, f.PerPage
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage

	events, err := s.queries.ListPublishedEventsFiltered(ctx, f.Search, f.CategorySlug, f.City, f.DateFrom, f.DateTo, f.PriceMin, f.PriceMax, int32(perPage), int32(offset))
	if err != nil {
		return nil, 0, err
	}
	total, err := s.queries.CountPublishedEventsFiltered(ctx, f.Search, f.CategorySlug, f.City, f.DateFrom, f.DateTo, f.PriceMin, f.PriceMax)
	return events, total, err
}

func (s *Service) ListEvents(ctx context.Context, search string, page, perPage int) ([]db.ListPublishedEventsRow, int64, error) {
	filtered, total, err := s.ListEventsFiltered(ctx, ListEventsFilter{Search: search, Page: page, PerPage: perPage})
	if err != nil {
		return nil, 0, err
	}
	legacy := make([]db.ListPublishedEventsRow, 0, len(filtered))
	for _, e := range filtered {
		legacy = append(legacy, db.ListPublishedEventsRow{
			ID: e.ID, Slug: e.Slug, Title: e.Title, Description: e.Description,
			VenueID: e.VenueID, CoverImageUrl: e.CoverImageUrl, Status: e.Status,
			StartsAt: e.StartsAt, EndsAt: e.EndsAt, CreatedAt: e.CreatedAt,
			VenueName: e.VenueName, VenueCity: e.VenueCity,
		})
	}
	return legacy, total, nil
}

func (s *Service) GetEventBySlug(ctx context.Context, slug string) (*db.Event, []db.TicketType, error) {
	event, types, err := s.getEventDetailCached(ctx, slug)
	if err != nil {
		return nil, nil, err
	}
	return event, types, nil
}

func (s *Service) getEventDetailCached(ctx context.Context, slug string) (*db.Event, []db.TicketType, error) {
	cacheKey := redisutil.CacheKey("event", slug)
	if s.cache != nil {
		var cached eventDetailCache
		if ok, _ := s.cache.GetJSON(ctx, cacheKey, &cached); ok {
			return &cached.Event, cached.TicketTypes, nil
		}
	}

	event, err := s.queries.GetPublishedEventBySlug(ctx, slug)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil, ErrNotFound
		}
		return nil, nil, err
	}

	types, err := s.queries.ListTicketTypesByEvent(ctx, event.ID)
	if err != nil {
		return nil, nil, err
	}

	if s.cache != nil && s.cfg != nil {
		_ = s.cache.SetJSON(ctx, cacheKey, eventDetailCache{
			Event:       event,
			TicketTypes: types,
		}, s.cfg.RedisCacheEventTTL)
	}

	return &event, types, nil
}

func (s *Service) GetAvailability(ctx context.Context, slug string) ([]map[string]interface{}, error) {
	cacheKey := redisutil.CacheKey("avail", slug)
	if s.cache != nil {
		var cached []map[string]interface{}
		if ok, _ := s.cache.GetJSON(ctx, cacheKey, &cached); ok {
			return cached, nil
		}
	}

	event, types, err := s.getEventDetailCached(ctx, slug)
	if err != nil {
		return nil, err
	}
	if event.Status != string(db.EventStatusPublished) {
		return nil, ErrNotFound
	}

	result := make([]map[string]interface{}, 0, len(types))
	for _, tt := range types {
		available := tt.TotalQuota - tt.SoldCount - tt.HeldCount
		if available < 0 {
			available = 0
		}
		result = append(result, map[string]interface{}{
			"id":         tt.ID,
			"name":       tt.Name,
			"price":      tt.Price,
			"available":  available,
			"total_quota": tt.TotalQuota,
			"sales_start_at": tt.SalesStartAt,
			"sales_end_at":   tt.SalesEndAt,
		})
	}

	if s.cache != nil && s.cfg != nil {
		_ = s.cache.SetJSON(ctx, cacheKey, result, s.cfg.RedisCacheAvailTTL)
	}

	return result, nil
}

func (s *Service) CreateEvent(ctx context.Context, in CreateEventInput) (db.Event, error) {
	meta, _ := json.Marshal(in.Metadata)
	if in.Metadata == nil {
		meta = []byte("{}")
	}

	status := in.Status
	if status == "" {
		status = "draft"
	}

	slug := in.Slug
	if slug == "" {
		slug = slugify(in.Title)
	}

	var venueID pgtype.UUID
	if in.VenueID != nil {
		venueID = pgtype.UUID{Bytes: *in.VenueID, Valid: true}
	}

	var cover pgtype.Text
	if in.CoverImageURL != "" {
		cover = pgtype.Text{String: in.CoverImageURL, Valid: true}
	}

	event, err := s.queries.CreateEvent(ctx, db.CreateEventParams{
		Slug:          slug,
		Title:         in.Title,
		Description:   in.Description,
		VenueID:       venueID,
		CoverImageUrl: cover,
		Status:        status,
		StartsAt:      in.StartsAt,
		EndsAt:        in.EndsAt,
		Metadata:      meta,
	})
	if err != nil {
		return db.Event{}, err
	}
	_ = s.queries.SetEventCategory(ctx, event.ID, in.CategoryID)
	capacity := in.WaitingRoomCapacity
	if capacity <= 0 {
		capacity = 100
	}
	_ = s.queries.UpdateEventWaitingRoom(ctx, event.ID, in.WaitingRoomEnabled, capacity)
	s.invalidateCaches(ctx, event.ID, event.Slug)
	return event, nil
}

func (s *Service) UpdateEvent(ctx context.Context, id uuid.UUID, in CreateEventInput) (db.Event, error) {
	meta, _ := json.Marshal(in.Metadata)
	if in.Metadata == nil {
		meta = []byte("{}")
	}

	var venueID pgtype.UUID
	if in.VenueID != nil {
		venueID = pgtype.UUID{Bytes: *in.VenueID, Valid: true}
	}

	var cover pgtype.Text
	if in.CoverImageURL != "" {
		cover = pgtype.Text{String: in.CoverImageURL, Valid: true}
	}

	event, err := s.queries.UpdateEvent(ctx, db.UpdateEventParams{
		ID:            id,
		Title:         in.Title,
		Description:   in.Description,
		VenueID:       venueID,
		CoverImageUrl: cover,
		Status:        in.Status,
		StartsAt:      in.StartsAt,
		EndsAt:        in.EndsAt,
		Metadata:      meta,
	})
	if err != nil {
		return db.Event{}, err
	}
	_ = s.queries.SetEventCategory(ctx, event.ID, in.CategoryID)
	capacity := in.WaitingRoomCapacity
	if capacity <= 0 {
		capacity = 100
	}
	_ = s.queries.UpdateEventWaitingRoom(ctx, event.ID, in.WaitingRoomEnabled, capacity)
	s.invalidateCaches(ctx, event.ID, event.Slug)
	return event, nil
}

func (s *Service) CreateTicketType(ctx context.Context, eventID uuid.UUID, in CreateTicketTypeInput) (db.TicketType, error) {
	maxPerOrder := in.MaxPerOrder
	if maxPerOrder <= 0 {
		maxPerOrder = 4
	}
	tt, err := s.queries.CreateTicketType(ctx, db.CreateTicketTypeParams{
		EventID:      eventID,
		Name:         in.Name,
		Price:        in.Price,
		TotalQuota:   in.TotalQuota,
		MaxPerOrder:  maxPerOrder,
		SalesStartAt: in.SalesStartAt,
		SalesEndAt:   in.SalesEndAt,
	})
	if err != nil {
		return db.TicketType{}, err
	}
	event, err := s.queries.GetEventByID(ctx, eventID)
	if err == nil {
		s.invalidateCaches(ctx, event.ID, event.Slug)
	}
	return tt, nil
}

func (s *Service) UpdateTicketType(ctx context.Context, ticketTypeID uuid.UUID, in CreateTicketTypeInput) (db.TicketType, error) {
	maxPerOrder := in.MaxPerOrder
	if maxPerOrder <= 0 {
		maxPerOrder = 4
	}
	tt, err := s.queries.UpdateTicketType(ctx, ticketTypeID, in.Name, in.Price, in.TotalQuota, maxPerOrder, in.SalesStartAt, in.SalesEndAt)
	if err != nil {
		return db.TicketType{}, err
	}
	event, err := s.queries.GetEventByID(ctx, tt.EventID)
	if err == nil {
		s.invalidateCaches(ctx, event.ID, event.Slug)
	}
	return tt, nil
}

func (s *Service) DeleteTicketType(ctx context.Context, ticketTypeID uuid.UUID) error {
	tt, err := s.queries.GetTicketTypeByID(ctx, ticketTypeID)
	if err != nil {
		return err
	}
	if err := s.queries.DeleteTicketType(ctx, ticketTypeID); err != nil {
		return err
	}
	event, err := s.queries.GetEventByID(ctx, tt.EventID)
	if err == nil {
		s.invalidateCaches(ctx, event.ID, event.Slug)
	}
	return nil
}

func (s *Service) invalidateCaches(ctx context.Context, eventID uuid.UUID, slug string) {
	if s.cache == nil {
		return
	}
	_ = s.cache.Delete(ctx,
		redisutil.CacheKey("avail", slug),
		redisutil.CacheKey("event", slug),
	)
	_ = s.cache.DeleteByPrefix(ctx, redisutil.CacheKey("events", "list"))
	_ = eventID
}

func (s *Service) CreateVenue(ctx context.Context, in CreateVenueInput) (db.Venue, error) {
	var lat, lng pgtype.Numeric
	if in.Latitude != nil {
		_ = lat.Scan(fmt.Sprintf("%f", *in.Latitude))
	}
	if in.Longitude != nil {
		_ = lng.Scan(fmt.Sprintf("%f", *in.Longitude))
	}
	return s.queries.CreateVenue(ctx, db.CreateVenueParams{
		Name:      in.Name,
		Address:   in.Address,
		City:      in.City,
		Capacity:  in.Capacity,
		Latitude:  lat,
		Longitude: lng,
	})
}

func EventToMap(e db.Event, venueName, venueCity string) map[string]interface{} {
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
	if venueName != "" {
		m["venue_name"] = venueName
		m["venue_city"] = venueCity
	}
	return m
}

func TicketTypeToMap(tt db.TicketType) map[string]interface{} {
	available := tt.TotalQuota - tt.SoldCount - tt.HeldCount
	if available < 0 {
		available = 0
	}
	label := ticketSaleLabel(tt)
	m := map[string]interface{}{
		"id":             tt.ID,
		"event_id":       tt.EventID,
		"name":           tt.Name,
		"price":          tt.Price,
		"total_quota":    tt.TotalQuota,
		"sold_count":     tt.SoldCount,
		"held_count":     tt.HeldCount,
		"available":      available,
		"max_per_order":  tt.MaxPerOrder,
		"sales_start_at": tt.SalesStartAt,
		"sales_end_at":   tt.SalesEndAt,
		"sale_status":    label,
	}
	if label == "early_bird" {
		m["tier_label"] = "Early Bird"
	}
	return m
}

func ticketSaleLabel(tt db.TicketType) string {
	now := time.Now()
	if now.Before(tt.SalesStartAt) {
		return "coming_soon"
	}
	if now.After(tt.SalesEndAt) {
		return "ended"
	}
	name := strings.ToLower(tt.Name)
	if strings.Contains(name, "early") || strings.Contains(name, "bird") {
		return "early_bird"
	}
	return "on_sale"
}

func slugify(s string) string {
	s = strings.ToLower(s)
	s = strings.ReplaceAll(s, " ", "-")
	var b strings.Builder
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' {
			b.WriteRune(r)
		}
	}
	return b.String()
}
