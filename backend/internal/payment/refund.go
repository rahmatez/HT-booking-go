package payment

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"github.com/rahmatez/high-traffic-booking/backend/internal/db"
)

func (s *Service) RefundBooking(ctx context.Context, bookingID uuid.UUID) error {
	return s.RefundBookingWithPolicy(ctx, bookingID, false)
}

func (s *Service) RefundBookingWithPolicy(ctx context.Context, bookingID uuid.UUID, forceFull bool) error {
	payment, err := s.queries.GetPaymentByBookingID(ctx, bookingID)
	if err != nil {
		return fmt.Errorf("payment not found")
	}
	if payment.Status != string(db.PaymentStatusSuccess) {
		return fmt.Errorf("payment is not refundable")
	}

	booking, err := s.queries.GetBookingByID(ctx, bookingID)
	if err != nil {
		return fmt.Errorf("booking not found")
	}
	event, err := s.queries.GetEventByID(ctx, booking.EventID)
	if err != nil {
		return fmt.Errorf("event not found")
	}

	decision, err := CalculateRefund(payment.Amount, event.StartsAt, DefaultRefundPolicy(), forceFull)
	if err != nil {
		return err
	}
	if decision.Kind == "none" {
		return fmt.Errorf("refund not allowed: %s", decision.Reason)
	}

	if s.midtrans.IsConfigured() {
		refundKey := fmt.Sprintf("refund-%s-%d", bookingID.String(), decision.Amount)
		if err := s.midtrans.RefundTransaction(ctx, bookingID.String(), refundKey, decision.Amount, decision.Reason); err != nil {
			return err
		}
	}

	return s.queries.RefundPayment(ctx, bookingID)
}
