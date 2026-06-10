package payment

import (
	"context"

	"github.com/google/uuid"
)

func (s *Service) RefundEventBookings(ctx context.Context, eventID uuid.UUID) (int, error) {
	ids, err := s.queries.ListConfirmedBookingIDsForEvent(ctx, eventID)
	if err != nil {
		return 0, err
	}
	count := 0
	for _, id := range ids {
		if err := s.RefundBookingWithPolicy(ctx, id, true); err != nil {
			continue
		}
		count++
	}
	return count, nil
}
