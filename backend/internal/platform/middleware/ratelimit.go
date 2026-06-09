package middleware

import (
	"net/http"
	"strings"
	"time"

	"github.com/rahmatez/high-traffic-booking/backend/internal/platform/authctx"
	redisutil "github.com/rahmatez/high-traffic-booking/backend/internal/platform/redis"
	"github.com/rahmatez/high-traffic-booking/backend/internal/platform/response"
)

type RateLimitConfig struct {
	Scope  string
	Limit  int
	Window time.Duration
	KeyFn  func(r *http.Request) string
}

func RateLimit(limiter *redisutil.RateLimiter, cfg RateLimitConfig) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			id := cfg.KeyFn(r)
			if id == "" {
				id = "unknown"
			}
			key := redisutil.RateLimitKey(cfg.Scope, id)

			allowed, err := limiter.Allow(r.Context(), key, cfg.Limit, cfg.Window)
			if err != nil {
				response.TooManyRequests(w, "layanan sibuk, coba lagi sebentar")
				return
			}
			if !allowed {
				response.TooManyRequests(w, "terlalu banyak permintaan, coba lagi sebentar")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func ClientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return strings.TrimSpace(xri)
	}
	host := r.RemoteAddr
	if idx := strings.LastIndex(host, ":"); idx >= 0 {
		return host[:idx]
	}
	return host
}

func AuthUserID(r *http.Request) string {
	user, ok := authctx.GetUser(r.Context())
	if !ok {
		return ""
	}
	return user.ID.String()
}

func IPOrAuthUser(r *http.Request) string {
	if id := AuthUserID(r); id != "" {
		return id
	}
	return ClientIP(r)
}
