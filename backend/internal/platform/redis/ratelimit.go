package redis

import (
	"context"
	"fmt"
	"time"

	goredis "github.com/redis/go-redis/v9"
)

type RateLimiter struct {
	client *goredis.Client
}

func NewRateLimiter(client *goredis.Client) *RateLimiter {
	return &RateLimiter{client: client}
}

// Allow returns false when the limit for key is exceeded within window.
func (r *RateLimiter) Allow(ctx context.Context, key string, limit int, window time.Duration) (bool, error) {
	if limit <= 0 {
		return true, nil
	}

	pipe := r.client.Pipeline()
	incr := pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, window)
	if _, err := pipe.Exec(ctx); err != nil {
		return false, err
	}

	count, err := incr.Result()
	if err != nil {
		return false, err
	}
	return count <= int64(limit), nil
}

func RateLimitKey(scope, identifier string) string {
	return fmt.Sprintf("eventra:rl:%s:%s", scope, identifier)
}
