package worker

import (
	"context"
	"encoding/json"
	"time"

	"go.uber.org/zap"

	"github.com/google/uuid"
	"github.com/rahmatez/high-traffic-booking/backend/internal/notification"
	"github.com/rahmatez/high-traffic-booking/backend/internal/payment"
	"github.com/rahmatez/high-traffic-booking/backend/internal/queue"
)

type JobProcessor struct {
	q          *queue.RedisQueue
	emailSvc   *notification.Service
	paymentSvc *payment.Service
	log        *zap.Logger
}

func NewJobProcessor(q *queue.RedisQueue, emailSvc *notification.Service, paymentSvc *payment.Service, log *zap.Logger) *JobProcessor {
	return &JobProcessor{q: q, emailSvc: emailSvc, paymentSvc: paymentSvc, log: log}
}

func (p *JobProcessor) Start(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
			job, err := p.q.Dequeue(ctx, 5*time.Second)
			if err != nil || job == nil {
				continue
			}
			if err := p.process(ctx, *job); err != nil {
				_ = p.q.RetryOrDLQ(ctx, *job, err)
				p.log.Warn("job failed", zap.String("type", string(job.Type)), zap.Int("attempt", job.Attempts+1), zap.Error(err))
			}
		}
	}
}

func (p *JobProcessor) process(ctx context.Context, job queue.Job) error {
	switch job.Type {
	case queue.JobEmail:
		var payload queue.EmailJobPayload
		if err := json.Unmarshal(job.Payload, &payload); err != nil {
			return err
		}
		if err := p.emailSvc.Send(ctx, notification.EmailMessage{
			To: payload.To, Subject: payload.Subject, HTML: payload.HTML,
		}); err != nil {
			return err
		}
	case queue.JobRefundBatch:
		var payload queue.RefundBatchPayload
		if err := json.Unmarshal(job.Payload, &payload); err != nil {
			return err
		}
		eventID, err := uuid.Parse(payload.EventID)
		if err != nil {
			return err
		}
		n, err := p.paymentSvc.RefundEventBookings(ctx, eventID)
		if err != nil {
			return err
		}
		p.log.Info("refund batch completed", zap.String("event_id", payload.EventID), zap.Int("count", n))
	default:
		return nil
	}
	return nil
}
