package catalog

import (
	"context"

	"github.com/rahmatez/high-traffic-booking/backend/internal/db"
)

type HomepageData struct {
	Banners    []db.Banner
	Categories []db.EventCategory
	Events     []db.PublishedEventRow
}

func (s *Service) GetHomepage(ctx context.Context) (HomepageData, error) {
	banners, err := s.queries.ListActiveBanners(ctx)
	if err != nil {
		return HomepageData{}, err
	}
	categories, err := s.queries.ListCategories(ctx)
	if err != nil {
		return HomepageData{}, err
	}
	events, err := s.queries.ListPublishedEventsFiltered(ctx, "", "", "", "", "", 0, 0, 6, 0)
	if err != nil {
		return HomepageData{}, err
	}
	return HomepageData{Banners: banners, Categories: categories, Events: events}, nil
}

func (s *Service) ListCategories(ctx context.Context) ([]db.EventCategory, error) {
	return s.queries.ListCategories(ctx)
}

func publishedEventToMap(e db.PublishedEventRow) map[string]interface{} {
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
	if e.CoverImageUrl.Valid {
		m["cover_image_url"] = e.CoverImageUrl.String
	}
	if e.VenueName.Valid {
		m["venue_name"] = e.VenueName.String
	}
	if e.VenueCity.Valid {
		m["venue_city"] = e.VenueCity.String
	}
	if e.CategorySlug.Valid {
		m["category_slug"] = e.CategorySlug.String
		m["category_name"] = e.CategoryName.String
	}
	return m
}
