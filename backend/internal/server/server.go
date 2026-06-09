package server

import (
	"context"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
	goredis "github.com/redis/go-redis/v9"
	"go.uber.org/zap"

	"github.com/rahmatez/high-traffic-booking/backend/internal/admin"
	"github.com/rahmatez/high-traffic-booking/backend/internal/auth"
	"github.com/rahmatez/high-traffic-booking/backend/internal/booking"
	"github.com/rahmatez/high-traffic-booking/backend/internal/catalog"
	"github.com/rahmatez/high-traffic-booking/backend/internal/config"
	"github.com/rahmatez/high-traffic-booking/backend/internal/db"
	"github.com/rahmatez/high-traffic-booking/backend/internal/payment"
	midtransclient "github.com/rahmatez/high-traffic-booking/backend/internal/payment/midtrans"
	"github.com/rahmatez/high-traffic-booking/backend/internal/platform/middleware"
	redisutil "github.com/rahmatez/high-traffic-booking/backend/internal/platform/redis"
	"github.com/rahmatez/high-traffic-booking/backend/internal/platform/response"
	"github.com/rahmatez/high-traffic-booking/backend/internal/ticket"
)

type Server struct {
	cfg    *config.Config
	log    *zap.Logger
	pool   *pgxpool.Pool
	redis  *goredis.Client
	router chi.Router
	http   *http.Server
}

func New(cfg *config.Config, log *zap.Logger, pool *pgxpool.Pool, redis *goredis.Client) *Server {
	queries := db.New(pool)
	jwtSvc := auth.NewJWTService(cfg.JWTSecret, cfg.JWTAccessTTL, cfg.JWTRefreshTTL)

	cache := redisutil.NewCache(redis)
	holdStore := redisutil.NewHoldStore(redis)
	rateLimiter := redisutil.NewRateLimiter(redis)

	authSvc := auth.NewService(pool, queries, jwtSvc)
	authHandler := auth.NewHandler(authSvc)

	catalogSvc := catalog.NewService(queries, cache, cfg)
	catalogHandler := catalog.NewHandler(catalogSvc)

	bookingSvc := booking.NewService(pool, queries, cfg, holdStore, cache)
	bookingHandler := booking.NewHandler(bookingSvc)

	mtClient := midtransclient.NewClient(cfg.MidtransServerKey, cfg.MidtransClientKey, cfg.MidtransIsProduction)
	paymentSvc := payment.NewService(pool, queries, bookingSvc, mtClient, cfg)
	paymentHandler := payment.NewHandler(paymentSvc, queries, bookingSvc, cfg)
	ticketHandler := ticket.NewHandler(queries)

	adminSvc := admin.NewService(queries, catalogSvc)
	adminHandler := admin.NewHandler(adminSvc)

	r := chi.NewRouter()
	r.Use(chimiddleware.RequestID)
	r.Use(chimiddleware.RealIP)
	r.Use(chimiddleware.Recoverer)
	r.Use(middleware.CORS(cfg.CORSAllowedOrigins))
	r.Use(middleware.RequestLogger(log))

	r.Get("/healthz", healthz)
	r.Get("/readyz", readyz(pool, redis))

	r.Route("/api/v1", func(api chi.Router) {
		api.Route("/auth", func(ar chi.Router) {
			ar.With(middleware.RateLimit(rateLimiter, middleware.RateLimitConfig{
				Scope:  "login",
				Limit:  cfg.RateLimitLoginPerMin,
				Window: cfg.RateLimitWindow,
				KeyFn:  middleware.ClientIP,
			})).Post("/register", authHandler.Register)
			ar.With(middleware.RateLimit(rateLimiter, middleware.RateLimitConfig{
				Scope:  "login",
				Limit:  cfg.RateLimitLoginPerMin,
				Window: cfg.RateLimitWindow,
				KeyFn:  middleware.ClientIP,
			})).Post("/login", authHandler.Login)
			ar.Post("/refresh", authHandler.Refresh)
			ar.Post("/logout", authHandler.Logout)
			ar.With(middleware.Auth(jwtSvc)).Get("/me", authHandler.Me)
		})

		api.Route("/events", func(er chi.Router) {
			er.Get("/", catalogHandler.ListEvents)
			er.Get("/search", catalogHandler.ListEvents)
			er.Get("/{slug}", catalogHandler.GetEvent)
			er.Get("/{slug}/availability", catalogHandler.GetAvailability)
		})

		api.Route("/bookings", func(br chi.Router) {
			br.Use(middleware.Auth(jwtSvc))
			br.With(middleware.RateLimit(rateLimiter, middleware.RateLimitConfig{
				Scope:  "hold",
				Limit:  cfg.RateLimitHoldPerMin,
				Window: cfg.RateLimitWindow,
				KeyFn:  middleware.AuthUserID,
			})).Post("/hold", bookingHandler.Hold)
			br.Get("/", bookingHandler.List)
			br.Get("/{id}", bookingHandler.Get)
			br.Post("/{id}/confirm", bookingHandler.Confirm)
			br.Delete("/{id}", bookingHandler.Cancel)
			br.Get("/{id}/tickets", ticketHandler.ListByBooking)
		})

		api.Route("/payments", func(pr chi.Router) {
			pr.Post("/webhook/{gateway}", paymentHandler.Webhook)
			pr.With(middleware.Auth(jwtSvc)).With(middleware.RateLimit(rateLimiter, middleware.RateLimitConfig{
				Scope:  "checkout",
				Limit:  cfg.RateLimitCheckoutPerMin,
				Window: cfg.RateLimitWindow,
				KeyFn:  middleware.AuthUserID,
			})).Post("/checkout", paymentHandler.Checkout)
			pr.With(middleware.Auth(jwtSvc)).Post("/sync", paymentHandler.Sync)
			pr.With(middleware.Auth(jwtSvc)).Get("/{id}/status", paymentHandler.GetStatus)
			pr.With(middleware.Auth(jwtSvc)).Post("/simulate", paymentHandler.SimulatePayment)
		})

		api.Route("/tickets", func(tr chi.Router) {
			tr.Use(middleware.Auth(jwtSvc))
			tr.Get("/{code}", ticketHandler.GetByCode)
		})

		api.Route("/admin", func(ar chi.Router) {
			ar.Use(middleware.Auth(jwtSvc))
			ar.Use(middleware.RequireRoleDB(queries, "admin", "organizer"))
			ar.Get("/dashboard/stats", adminHandler.DashboardStats)
			ar.Get("/events", adminHandler.ListEvents)
			ar.Post("/events", adminHandler.CreateEvent)
			ar.Get("/events/{id}", adminHandler.GetEvent)
			ar.Put("/events/{id}", adminHandler.UpdateEvent)
			ar.Post("/events/{id}/ticket-types", adminHandler.CreateTicketType)
			ar.Get("/venues", adminHandler.ListVenues)
			ar.Post("/venues", adminHandler.CreateVenue)
			ar.Get("/bookings", adminHandler.ListBookings)
			ar.Get("/bookings/{id}", adminHandler.GetBooking)
		})
	})

	return &Server{
		cfg:    cfg,
		log:    log,
		pool:   pool,
		redis:  redis,
		router: r,
		http: &http.Server{
			Addr:         ":" + cfg.AppPort,
			Handler:      r,
			ReadTimeout:  15 * time.Second,
			WriteTimeout: 30 * time.Second,
			IdleTimeout:  60 * time.Second,
		},
	}
}

func (s *Server) Start() error {
	s.log.Info("server starting", zap.String("addr", s.http.Addr))
	return s.http.ListenAndServe()
}

func (s *Server) Shutdown(ctx context.Context) error {
	s.log.Info("server shutting down")
	return s.http.Shutdown(ctx)
}

func healthz(w http.ResponseWriter, r *http.Request) {
	response.OK(w, map[string]string{"status": "ok"})
}

func readyz(pool *pgxpool.Pool, redis *goredis.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		if err := pool.Ping(ctx); err != nil {
			response.Fail(w, http.StatusServiceUnavailable, "NOT_READY", "database unavailable")
			return
		}
		if err := redis.Ping(ctx).Err(); err != nil {
			response.Fail(w, http.StatusServiceUnavailable, "NOT_READY", "redis unavailable")
			return
		}
		response.OK(w, map[string]string{"status": "ready"})
	}
}
