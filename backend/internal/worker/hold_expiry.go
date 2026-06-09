package worker

import (
	"context"
	"time"

	"go.uber.org/zap"

	"github.com/rahmatez/high-traffic-booking/backend/internal/booking"
	"github.com/rahmatez/high-traffic-booking/backend/internal/db"
)

type HoldExpiryWorker struct {
	queries *db.Queries
	booking *booking.Service
	log     *zap.Logger
	interval time.Duration
}

func NewHoldExpiryWorker(queries *db.Queries, bookingSvc *booking.Service, log *zap.Logger) *HoldExpiryWorker {
	return &HoldExpiryWorker{
		queries:  queries,
		booking:  bookingSvc,
		log:      log,
		interval: 30 * time.Second,
	}
}

func (w *HoldExpiryWorker) Start(ctx context.Context) {
	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()

	w.log.Info("hold expiry worker started", zap.Duration("interval", w.interval))

	for {
		select {
		case <-ctx.Done():
			w.log.Info("hold expiry worker stopped")
			return
		case <-ticker.C:
			w.runOnce(ctx)
		}
	}
}

func (w *HoldExpiryWorker) runOnce(ctx context.Context) {
	held, err := w.queries.ListExpiredHeldBookings(ctx, 100)
	if err != nil {
		w.log.Error("list expired held bookings", zap.Error(err))
		return
	}
	for _, b := range held {
		if err := w.booking.ExpireHeldBooking(ctx, b.ID); err != nil {
			w.log.Error("expire held booking", zap.String("booking_id", b.ID.String()), zap.Error(err))
		}
	}

	pending, err := w.queries.ListExpiredPendingPaymentBookings(ctx, 100)
	if err != nil {
		w.log.Error("list expired pending payment bookings", zap.Error(err))
		return
	}
	for _, b := range pending {
		if err := w.booking.ExpireHeldBooking(ctx, b.ID); err != nil {
			w.log.Error("expire pending booking", zap.String("booking_id", b.ID.String()), zap.Error(err))
		}
	}
}
