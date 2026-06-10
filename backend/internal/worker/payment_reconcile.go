package worker

import (
	"context"
	"time"

	"go.uber.org/zap"

	"github.com/rahmatez/high-traffic-booking/backend/internal/db"
	"github.com/rahmatez/high-traffic-booking/backend/internal/payment"
)

type PaymentReconcileWorker struct {
	queries *db.Queries
	payment *payment.Service
	log     *zap.Logger
	interval time.Duration
}

func NewPaymentReconcileWorker(queries *db.Queries, paymentSvc *payment.Service, log *zap.Logger) *PaymentReconcileWorker {
	return &PaymentReconcileWorker{
		queries:  queries,
		payment:  paymentSvc,
		log:      log,
		interval: 2 * time.Minute,
	}
}

func (w *PaymentReconcileWorker) Start(ctx context.Context) {
	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()
	w.log.Info("payment reconcile worker started", zap.Duration("interval", w.interval))
	for {
		select {
		case <-ctx.Done():
			w.log.Info("payment reconcile worker stopped")
			return
		case <-ticker.C:
			w.runOnce(ctx)
		}
	}
}

func (w *PaymentReconcileWorker) runOnce(ctx context.Context) {
	pending, err := w.queries.ListPendingPaymentsForReconcile(ctx, 50)
	if err != nil {
		w.log.Error("list pending payments", zap.Error(err))
		return
	}
	for _, p := range pending {
		if err := w.payment.ReconcilePayment(ctx, p.BookingID); err != nil {
			w.log.Debug("reconcile payment", zap.String("booking_id", p.BookingID.String()), zap.Error(err))
		}
	}
}
