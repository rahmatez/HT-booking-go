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

	"github.com/rahmatez/high-traffic-booking/backend/internal/db"
)

var ErrNotFound = errors.New("not found")

type Service struct {
	queries *db.Queries
}

func NewService(queries *db.Queries) *Service {
	return &Service{queries: queries}
}

type CreateEventInput struct {
	Slug          string                 `json:"slug"`
	Title         string                 `json:"title"`
	Description   string                 `json:"description"`
	VenueID       *uuid.UUID             `json:"venue_id"`
	CoverImageURL string                 `json:"cover_image_url"`
	Status        string                 `json:"status"`
	StartsAt      time.Time              `json:"starts_at"`
	EndsAt        time.Time              `json:"ends_at"`
	Metadata      map[string]interface{} `json:"metadata"`
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

func (s *Service) ListEvents(ctx context.Context, search string, page, perPage int) ([]db.ListPublishedEventsRow, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage

	events, err := s.queries.ListPublishedEvents(ctx, db.ListPublishedEventsParams{
		Column1: search,
		Limit:   int32(perPage),
		Offset:  int32(offset),
	})
	if err != nil {
		return nil, 0, err
	}

	total, err := s.queries.CountPublishedEvents(ctx, search)
	if err != nil {
		return nil, 0, err
	}

	return events, total, nil
}

func (s *Service) GetEventBySlug(ctx context.Context, slug string) (*db.Event, []db.TicketType, error) {
	event, err := s.queries.GetEventBySlug(ctx, slug)
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

	return &event, types, nil
}

func (s *Service) GetAvailability(ctx context.Context, slug string) ([]map[string]interface{}, error) {
	event, types, err := s.GetEventBySlug(ctx, slug)
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

	return s.queries.CreateEvent(ctx, db.CreateEventParams{
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

	return s.queries.UpdateEvent(ctx, db.UpdateEventParams{
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
}

func (s *Service) CreateTicketType(ctx context.Context, eventID uuid.UUID, in CreateTicketTypeInput) (db.TicketType, error) {
	maxPerOrder := in.MaxPerOrder
	if maxPerOrder <= 0 {
		maxPerOrder = 4
	}
	return s.queries.CreateTicketType(ctx, db.CreateTicketTypeParams{
		EventID:      eventID,
		Name:         in.Name,
		Price:        in.Price,
		TotalQuota:   in.TotalQuota,
		MaxPerOrder:  maxPerOrder,
		SalesStartAt: in.SalesStartAt,
		SalesEndAt:   in.SalesEndAt,
	})
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
	return map[string]interface{}{
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
	}
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
