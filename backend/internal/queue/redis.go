package queue

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	goredis "github.com/redis/go-redis/v9"
)

const (
	queueKey = "jobs:queue"
	dlqKey   = "jobs:dlq"
)

type JobType string

const (
	JobEmail       JobType = "email"
	JobRefundBatch JobType = "refund_batch"
)

type Job struct {
	ID        string          `json:"id"`
	Type      JobType         `json:"type"`
	Payload   json.RawMessage `json:"payload"`
	CreatedAt time.Time       `json:"created_at"`
	Attempts  int             `json:"attempts"`
	MaxRetry  int             `json:"max_retry"`
	LastError string          `json:"last_error,omitempty"`
}

type RefundBatchPayload struct {
	EventID string `json:"event_id"`
}

type EmailJobPayload struct {
	To      string `json:"to"`
	Subject string `json:"subject"`
	HTML    string `json:"html"`
}

type RedisQueue struct {
	client *goredis.Client
}

func NewRedisQueue(client *goredis.Client) *RedisQueue {
	return &RedisQueue{client: client}
}

func (q *RedisQueue) Enqueue(ctx context.Context, job Job) error {
	if job.CreatedAt.IsZero() {
		job.CreatedAt = time.Now()
	}
	if job.ID == "" {
		job.ID = uuid.New().String()
	}
	if job.MaxRetry == 0 {
		job.MaxRetry = 3
	}
	raw, err := json.Marshal(job)
	if err != nil {
		return err
	}
	return q.client.LPush(ctx, queueKey, raw).Err()
}

func (q *RedisQueue) Dequeue(ctx context.Context, timeout time.Duration) (*Job, error) {
	res, err := q.client.BRPop(ctx, timeout, queueKey).Result()
	if err != nil {
		return nil, err
	}
	if len(res) < 2 {
		return nil, nil
	}
	var job Job
	if err := json.Unmarshal([]byte(res[1]), &job); err != nil {
		return nil, err
	}
	return &job, nil
}

func (q *RedisQueue) RetryOrDLQ(ctx context.Context, job Job, jobErr error) error {
	job.Attempts++
	job.LastError = jobErr.Error()
	if job.Attempts < job.MaxRetry {
		return q.Enqueue(ctx, job)
	}
	raw, err := json.Marshal(job)
	if err != nil {
		return err
	}
	return q.client.LPush(ctx, dlqKey, raw).Err()
}

func (q *RedisQueue) DLQSize(ctx context.Context) (int64, error) {
	return q.client.LLen(ctx, dlqKey).Result()
}
