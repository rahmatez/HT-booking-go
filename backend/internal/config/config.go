package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	AppEnv       string
	AppPort      string
	AppURL       string
	FrontendURL  string

	DatabaseURL        string
	DatabaseMaxOpen    int
	DatabaseMaxIdle    int

	RedisURL string

	JWTSecret      string
	JWTAccessTTL   time.Duration
	JWTRefreshTTL  time.Duration

	BookingHoldTTL           time.Duration
	BookingMaxTicketsPerOrder int
	BookingMaxActiveHolds    int
	BookingPaymentGrace      time.Duration

	TicketSigningKey string

	PaymentGateway       string
	MidtransMerchantID   string
	MidtransServerKey    string
	MidtransClientKey    string
	MidtransIsProduction bool

	EmailProvider string
	ResendAPIKey  string
	EmailFrom     string

	TurnstileSecretKey string

	CORSAllowedOrigins []string

	RedisCacheEventsTTL time.Duration
	RedisCacheAvailTTL  time.Duration
	RedisCacheEventTTL  time.Duration

	RateLimitLoginPerMin    int
	RateLimitHoldPerMin     int
	RateLimitCheckoutPerMin int
	RateLimitWindow         time.Duration
}

func Load() (*Config, error) {
	cfg := &Config{
		AppEnv:  getEnv("APP_ENV", "development"),
		AppPort: getEnv("APP_PORT", "8080"),
		AppURL:      getEnv("APP_URL", "http://localhost:8080"),
		FrontendURL: getEnv("FRONTEND_URL", "http://localhost:3000"),

		DatabaseURL:     getEnv("DATABASE_URL", "postgres://booking:secret@localhost:5433/booking?sslmode=disable"),
		DatabaseMaxOpen: getEnvInt("DATABASE_MAX_OPEN_CONNS", 25),
		DatabaseMaxIdle: getEnvInt("DATABASE_MAX_IDLE_CONNS", 5),

		RedisURL: getEnv("REDIS_URL", "redis://localhost:6379/0"),

		JWTSecret: getEnv("JWT_SECRET", "dev-secret-change-in-production"),

		BookingMaxTicketsPerOrder: getEnvInt("BOOKING_MAX_TICKETS_PER_ORDER", 4),
		BookingMaxActiveHolds:     getEnvInt("BOOKING_MAX_ACTIVE_HOLDS", 3),

		TicketSigningKey: getEnv("TICKET_SIGNING_KEY", "dev-ticket-signing-key"),

		PaymentGateway:     getEnv("PAYMENT_GATEWAY", "midtrans"),
		MidtransMerchantID: getEnv("MIDTRANS_MERCHANT_ID", ""),
		MidtransServerKey:  getEnv("MIDTRANS_SERVER_KEY", ""),
		MidtransClientKey:  getEnv("MIDTRANS_CLIENT_KEY", ""),
		MidtransIsProduction: getEnvBool("MIDTRANS_IS_PRODUCTION", false),

		EmailProvider: getEnv("EMAIL_PROVIDER", "resend"),
		ResendAPIKey:  getEnv("RESEND_API_KEY", ""),
		EmailFrom:     getEnv("EMAIL_FROM", "noreply@booking.local"),

		TurnstileSecretKey: getEnv("TURNSTILE_SECRET_KEY", ""),
	}

	var err error
	cfg.JWTAccessTTL, err = time.ParseDuration(getEnv("JWT_ACCESS_TTL", "15m"))
	if err != nil {
		return nil, fmt.Errorf("JWT_ACCESS_TTL: %w", err)
	}
	cfg.JWTRefreshTTL, err = time.ParseDuration(getEnv("JWT_REFRESH_TTL", "168h"))
	if err != nil {
		return nil, fmt.Errorf("JWT_REFRESH_TTL: %w", err)
	}
	cfg.BookingHoldTTL, err = time.ParseDuration(getEnv("BOOKING_HOLD_TTL", "10m"))
	if err != nil {
		return nil, fmt.Errorf("BOOKING_HOLD_TTL: %w", err)
	}
	cfg.BookingPaymentGrace, err = time.ParseDuration(getEnv("BOOKING_PAYMENT_GRACE_PERIOD", "5m"))
	if err != nil {
		return nil, fmt.Errorf("BOOKING_PAYMENT_GRACE_PERIOD: %w", err)
	}

	origins := getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:3000")
	cfg.CORSAllowedOrigins = strings.Split(origins, ",")

	cfg.RateLimitLoginPerMin = getEnvInt("RATE_LIMIT_LOGIN_PER_MIN", 10)
	cfg.RateLimitHoldPerMin = getEnvInt("RATE_LIMIT_HOLD_PER_MIN", 30)
	cfg.RateLimitCheckoutPerMin = getEnvInt("RATE_LIMIT_CHECKOUT_PER_MIN", 15)
	cfg.RateLimitWindow, err = time.ParseDuration(getEnv("RATE_LIMIT_WINDOW", "1m"))
	if err != nil {
		return nil, fmt.Errorf("RATE_LIMIT_WINDOW: %w", err)
	}
	cfg.RedisCacheEventsTTL, err = time.ParseDuration(getEnv("REDIS_CACHE_EVENTS_TTL", "60s"))
	if err != nil {
		return nil, fmt.Errorf("REDIS_CACHE_EVENTS_TTL: %w", err)
	}
	cfg.RedisCacheAvailTTL, err = time.ParseDuration(getEnv("REDIS_CACHE_AVAIL_TTL", "5s"))
	if err != nil {
		return nil, fmt.Errorf("REDIS_CACHE_AVAIL_TTL: %w", err)
	}
	cfg.RedisCacheEventTTL, err = time.ParseDuration(getEnv("REDIS_CACHE_EVENT_TTL", "60s"))
	if err != nil {
		return nil, fmt.Errorf("REDIS_CACHE_EVENT_TTL: %w", err)
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return fallback
}

func getEnvBool(key string, fallback bool) bool {
	if v := os.Getenv(key); v != "" {
		b, err := strconv.ParseBool(v)
		if err == nil {
			return b
		}
	}
	return fallback
}
