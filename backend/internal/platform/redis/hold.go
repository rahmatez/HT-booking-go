package redis

import (
	"context"
	"fmt"
	"sort"
	"time"

	"github.com/google/uuid"
	goredis "github.com/redis/go-redis/v9"
)

// HoldStore manages distributed locks and hold metadata in Redis.
type HoldStore struct {
	client *goredis.Client
}

func NewHoldStore(client *goredis.Client) *HoldStore {
	return &HoldStore{client: client}
}

// WithTicketLocks acquires per-ticket-type locks (sorted to avoid deadlocks).
func (h *HoldStore) WithTicketLocks(ctx context.Context, ticketTypeIDs []uuid.UUID, ttl time.Duration, fn func() error) error {
	ids := append([]uuid.UUID(nil), ticketTypeIDs...)
	sort.Slice(ids, func(i, j int) bool {
		return ids[i].String() < ids[j].String()
	})

	acquired := make([]string, 0, len(ids))
	defer func() {
		if len(acquired) > 0 {
			_ = h.client.Del(context.Background(), acquired...).Err()
		}
	}()

	for _, id := range ids {
		key := fmt.Sprintf("eventra:lock:tt:%s", id)
		ok, err := h.client.SetNX(ctx, key, "1", ttl).Result()
		if err != nil {
			return err
		}
		if !ok {
			return fmt.Errorf("ticket type busy, retry")
		}
		acquired = append(acquired, key)
	}

	return fn()
}

// RegisterHold stores hold metadata with TTL for fast lookup and expiry tracking.
func (h *HoldStore) RegisterHold(ctx context.Context, bookingID, eventID uuid.UUID, ttl time.Duration) error {
	pipe := h.client.Pipeline()
	bookingKey := fmt.Sprintf("eventra:hold:booking:%s", bookingID)
	pipe.Set(ctx, bookingKey, eventID.String(), ttl)
	pipe.ZAdd(ctx, "eventra:holds:expiring", goredis.Z{
		Score:  float64(time.Now().Add(ttl).Unix()),
		Member: bookingID.String(),
	})
	_, err := pipe.Exec(ctx)
	return err
}

// ReleaseHold removes hold metadata from Redis.
func (h *HoldStore) ReleaseHold(ctx context.Context, bookingID uuid.UUID) error {
	pipe := h.client.Pipeline()
	pipe.Del(ctx, fmt.Sprintf("eventra:hold:booking:%s", bookingID))
	pipe.ZRem(ctx, "eventra:holds:expiring", bookingID.String())
	_, err := pipe.Exec(ctx)
	return err
}
