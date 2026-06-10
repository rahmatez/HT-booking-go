package notification

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"github.com/rahmatez/high-traffic-booking/backend/internal/config"
	"github.com/rahmatez/high-traffic-booking/backend/internal/db"
)

type BookingNotifier struct {
	svc     *Service
	queries *db.Queries
	cfg     *config.Config
}

func NewBookingNotifier(svc *Service, queries *db.Queries, cfg *config.Config) *BookingNotifier {
	return &BookingNotifier{svc: svc, queries: queries, cfg: cfg}
}

func (n *BookingNotifier) OnPaymentConfirmed(ctx context.Context, bookingID uuid.UUID) {
	email, name, eventTitle, tickets, err := n.queries.GetBookingEmailContext(ctx, bookingID)
	if err != nil || email == "" {
		return
	}
	bookingURL := fmt.Sprintf("%s/bookings/%s", n.cfg.FrontendURL, bookingID)

	subject, html := PaymentConfirmEmail(name, eventTitle, bookingURL, 0)
	n.svc.Enqueue(EmailMessage{To: email, Subject: subject, HTML: html})

	subject2, html2 := ETicketEmail(name, eventTitle, bookingURL, tickets)
	n.svc.Enqueue(EmailMessage{To: email, Subject: subject2, HTML: html2})
}

func (n *BookingNotifier) OnBookingCancelled(ctx context.Context, bookingID uuid.UUID) {
	email, name, eventTitle, _, err := n.queries.GetBookingEmailContext(ctx, bookingID)
	if err != nil || email == "" {
		return
	}
	subject, html := CancellationEmail(name, eventTitle)
	n.svc.Enqueue(EmailMessage{To: email, Subject: subject, HTML: html})
}
