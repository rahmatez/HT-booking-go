package admin

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/rahmatez/high-traffic-booking/backend/internal/catalog"
	"github.com/rahmatez/high-traffic-booking/backend/internal/db"
)

var ErrNotFound = errors.New("not found")

type Service struct {
	queries    *db.Queries
	catalogSvc *catalog.Service
}

func NewService(queries *db.Queries, catalogSvc *catalog.Service) *Service {
	return &Service{queries: queries, catalogSvc: catalogSvc}
}

func (s *Service) DashboardStats(ctx context.Context) (db.AdminDashboardStatsRow, error) {
	return s.queries.AdminDashboardStats(ctx)
}

func (s *Service) ListEvents(ctx context.Context, status, search string, page, perPage int) ([]db.ListAllEventsRow, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage

	events, err := s.queries.ListAllEvents(ctx, db.ListAllEventsParams{
		Column1: status,
		Column2: search,
		Limit:   int32(perPage),
		Offset:  int32(offset),
	})
	if err != nil {
		return nil, 0, err
	}

	total, err := s.queries.CountAllEvents(ctx, db.CountAllEventsParams{
		Column1: status,
		Column2: search,
	})
	return events, total, err
}

func (s *Service) GetEvent(ctx context.Context, id uuid.UUID) (*db.Event, []db.TicketType, error) {
	event, err := s.queries.GetEventByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil, ErrNotFound
		}
		return nil, nil, err
	}
	types, err := s.queries.ListTicketTypesByEvent(ctx, id)
	if err != nil {
		return nil, nil, err
	}
	return &event, types, nil
}

func (s *Service) ListBookings(ctx context.Context, status, eventID string, page, perPage int) ([]db.AdminListBookingsRow, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage

	bookings, err := s.queries.AdminListBookings(ctx, db.AdminListBookingsParams{
		Column1: status,
		Column2: eventID,
		Limit:   int32(perPage),
		Offset:  int32(offset),
	})
	if err != nil {
		return nil, 0, err
	}

	total, err := s.queries.CountAdminBookings(ctx, db.CountAdminBookingsParams{
		Column1: status,
		Column2: eventID,
	})
	return bookings, total, err
}

func (s *Service) GetBooking(ctx context.Context, id uuid.UUID) (db.GetBookingByIDAdminRow, []db.ListBookingItemsRow, error) {
	booking, err := s.queries.GetBookingByIDAdmin(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return db.GetBookingByIDAdminRow{}, nil, ErrNotFound
		}
		return db.GetBookingByIDAdminRow{}, nil, err
	}
	items, err := s.queries.ListBookingItems(ctx, id)
	return booking, items, err
}

func (s *Service) ListVenues(ctx context.Context) ([]db.Venue, error) {
	return s.queries.ListVenues(ctx)
}

func (s *Service) Catalog() *catalog.Service {
	return s.catalogSvc
}

func toInt64(v interface{}) int64 {
	switch n := v.(type) {
	case int64:
		return n
	case int32:
		return int64(n)
	case float64:
		return int64(n)
	default:
		return 0
	}
}
