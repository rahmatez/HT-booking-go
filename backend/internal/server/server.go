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
	"github.com/rahmatez/high-traffic-booking/backend/internal/checkin"
	"github.com/rahmatez/high-traffic-booking/backend/internal/config"
	"github.com/rahmatez/high-traffic-booking/backend/internal/db"
	"github.com/rahmatez/high-traffic-booking/backend/internal/payment"
	midtransclient "github.com/rahmatez/high-traffic-booking/backend/internal/payment/midtrans"
	"github.com/rahmatez/high-traffic-booking/backend/internal/platform/middleware"
	redisutil "github.com/rahmatez/high-traffic-booking/backend/internal/platform/redis"
	"github.com/rahmatez/high-traffic-booking/backend/internal/platform/response"
	"github.com/rahmatez/high-traffic-booking/backend/internal/ticket"
	"github.com/rahmatez/high-traffic-booking/backend/internal/waitingroom"
)

type routeDeps struct {
	queries            *db.Queries
	jwtSvc             *auth.JWTService
	rateLimiter        *redisutil.RateLimiter
	mtClient           *midtransclient.Client
	authHandler        *auth.Handler
	catalogHandler     *catalog.Handler
	bookingHandler     *booking.Handler
	waitingRoomHandler *waitingroom.Handler
	paymentHandler     *payment.Handler
	ticketHandler      *ticket.Handler
	checkinHandler     *checkin.Handler
	adminHandler       *admin.Handler
}

type Server struct {
	cfg    *config.Config
	log    *zap.Logger
	pool   *pgxpool.Pool
	redis  *goredis.Client
	router chi.Router
	http   *http.Server
}

func newServer(cfg *config.Config, log *zap.Logger, pool *pgxpool.Pool, redis *goredis.Client, deps routeDeps) *Server {
	r := chi.NewRouter()
	r.Use(chimiddleware.RequestID)
	r.Use(chimiddleware.RealIP)
	r.Use(chimiddleware.Recoverer)
	r.Use(middleware.CORS(cfg.CORSAllowedOrigins))
	r.Use(middleware.RequestLogger(log))

	r.Get("/healthz", healthz)
	r.Get("/readyz", readyz(pool, redis, deps.mtClient))

	r.Route("/api/v1", func(api chi.Router) {
		api.Route("/auth", func(ar chi.Router) {
			ar.With(middleware.RateLimit(deps.rateLimiter, middleware.RateLimitConfig{
				Scope:  "login",
				Limit:  cfg.RateLimitLoginPerMin,
				Window: cfg.RateLimitWindow,
				KeyFn:  middleware.ClientIP,
			})).Post("/register", deps.authHandler.Register)
			ar.With(middleware.RateLimit(deps.rateLimiter, middleware.RateLimitConfig{
				Scope:  "login",
				Limit:  cfg.RateLimitLoginPerMin,
				Window: cfg.RateLimitWindow,
				KeyFn:  middleware.ClientIP,
			})).Post("/login", deps.authHandler.Login)
			ar.Post("/refresh", deps.authHandler.Refresh)
			ar.Post("/logout", deps.authHandler.Logout)
			ar.Post("/forgot-password", deps.authHandler.ForgotPassword)
			ar.Post("/reset-password", deps.authHandler.ResetPassword)
			ar.Post("/verify-email", deps.authHandler.VerifyEmail)
			ar.With(middleware.Auth(deps.jwtSvc)).Get("/me", deps.authHandler.Me)
			ar.With(middleware.Auth(deps.jwtSvc)).Post("/request-verify-email", deps.authHandler.RequestVerifyEmail)
		})

		api.Get("/homepage", deps.catalogHandler.Homepage)
		api.Get("/categories", deps.catalogHandler.ListCategories)

		api.Route("/events", func(er chi.Router) {
			er.Get("/", deps.catalogHandler.ListEvents)
			er.Get("/search", deps.catalogHandler.ListEvents)
			er.Get("/{slug}", deps.catalogHandler.GetEvent)
			er.Get("/{slug}/availability", deps.catalogHandler.GetAvailability)
			er.Get("/{slug}/queue/config", deps.waitingRoomHandler.Config)
			er.Post("/{slug}/queue/join", deps.waitingRoomHandler.Join)
			er.Get("/{slug}/queue/status", deps.waitingRoomHandler.Status)
		})

		api.Post("/promos/validate", deps.bookingHandler.ValidatePromo)

		api.Route("/bookings", func(br chi.Router) {
			br.Use(middleware.Auth(deps.jwtSvc))
			br.With(middleware.RateLimit(deps.rateLimiter, middleware.RateLimitConfig{
				Scope:  "hold",
				Limit:  cfg.RateLimitHoldPerMin,
				Window: cfg.RateLimitWindow,
				KeyFn:  middleware.AuthUserID,
			})).Post("/hold", deps.bookingHandler.Hold)
			br.Get("/", deps.bookingHandler.List)
			br.Get("/{id}", deps.bookingHandler.Get)
			br.Post("/{id}/confirm", deps.bookingHandler.Confirm)
			br.Delete("/{id}", deps.bookingHandler.Cancel)
			br.Get("/{id}/tickets", deps.ticketHandler.ListByBooking)
			br.Get("/{bookingId}/tickets/{ticketId}/pdf", deps.ticketHandler.DownloadPDF)
		})

		api.Route("/payments", func(pr chi.Router) {
			pr.Post("/webhook/{gateway}", deps.paymentHandler.Webhook)
			pr.With(middleware.Auth(deps.jwtSvc)).With(middleware.RateLimit(deps.rateLimiter, middleware.RateLimitConfig{
				Scope:  "checkout",
				Limit:  cfg.RateLimitCheckoutPerMin,
				Window: cfg.RateLimitWindow,
				KeyFn:  middleware.AuthUserID,
			})).Post("/checkout", deps.paymentHandler.Checkout)
			pr.With(middleware.Auth(deps.jwtSvc)).Post("/sync", deps.paymentHandler.Sync)
			pr.With(middleware.Auth(deps.jwtSvc)).Get("/{id}/status", deps.paymentHandler.GetStatus)
			pr.With(middleware.Auth(deps.jwtSvc)).Post("/simulate", deps.paymentHandler.SimulatePayment)
		})

		api.Route("/tickets", func(tr chi.Router) {
			tr.Use(middleware.Auth(deps.jwtSvc))
			tr.Get("/{code}", deps.ticketHandler.GetByCode)
		})

		api.Route("/admin", func(ar chi.Router) {
			ar.Use(middleware.Auth(deps.jwtSvc))
			ar.Use(middleware.RequireRoleDB(deps.queries, "admin", "organizer", "gate_staff"))

			ar.Get("/dashboard/stats", deps.adminHandler.DashboardStats)
			ar.Get("/dashboard/trend", deps.adminHandler.DashboardTrend)
			ar.Get("/events", deps.adminHandler.ListEvents)
			ar.Post("/events", deps.adminHandler.CreateEvent)
			ar.Get("/events/{id}", deps.adminHandler.GetEvent)
			ar.Put("/events/{id}", deps.adminHandler.UpdateEvent)
			ar.Get("/events/{id}/attendees", deps.adminHandler.ListAttendees)
			ar.Get("/events/{id}/attendees/export", deps.adminHandler.ExportAttendees)
			ar.Post("/events/{id}/ticket-types", deps.adminHandler.CreateTicketType)
			ar.Put("/events/{id}/ticket-types/{ticketTypeId}", deps.adminHandler.UpdateTicketType)
			ar.Delete("/events/{id}/ticket-types/{ticketTypeId}", deps.adminHandler.DeleteTicketType)
			ar.Get("/venues", deps.adminHandler.ListVenues)
			ar.Post("/venues", deps.adminHandler.CreateVenue)
			ar.Get("/bookings", deps.adminHandler.ListBookings)
			ar.Get("/bookings/{id}", deps.adminHandler.GetBooking)

			ar.Get("/payments", deps.adminHandler.ListPayments)
			ar.Get("/reports/sales", deps.adminHandler.SalesReport)
			ar.Get("/reports/exports/bookings", deps.adminHandler.ExportBookings)
			ar.Get("/promos", deps.adminHandler.ListPromos)
			ar.Post("/promos", deps.adminHandler.CreatePromo)
			ar.Post("/bookings/{id}/refund", deps.adminHandler.RefundBooking)

			ar.Group(func(cr chi.Router) {
				cr.Use(middleware.RequireRoleDB(deps.queries, "admin", "organizer", "gate_staff"))
				cr.Post("/check-in/scan", deps.checkinHandler.Scan)
				cr.Get("/check-in/stats/{eventId}", deps.checkinHandler.Stats)
			})

			ar.Group(func(adm chi.Router) {
				adm.Use(middleware.RequireRoleDB(deps.queries, "admin"))
				adm.Get("/users", deps.adminHandler.ListUsers)
				adm.Get("/settings", deps.adminHandler.GetSettings)
				adm.Put("/settings/{key}", deps.adminHandler.UpdateSettings)
				adm.Get("/audit", deps.adminHandler.ListAuditLogs)
				adm.Get("/categories", deps.adminHandler.ListCategories)
				adm.Post("/categories", deps.adminHandler.CreateCategory)
				adm.Put("/categories/{id}", deps.adminHandler.UpdateCategory)
				adm.Delete("/categories/{id}", deps.adminHandler.DeleteCategory)
				adm.Get("/banners", deps.adminHandler.ListBanners)
				adm.Post("/banners", deps.adminHandler.CreateBanner)
				adm.Put("/banners/{id}", deps.adminHandler.UpdateBanner)
				adm.Delete("/banners/{id}", deps.adminHandler.DeleteBanner)
				adm.Get("/moderation", deps.adminHandler.ListModeration)
				adm.Post("/moderation/{id}", deps.adminHandler.ModerateEvent)
				adm.Get("/organizers", deps.adminHandler.ListOrganizers)
				adm.Post("/organizers", deps.adminHandler.CreateOrganizer)
				adm.Get("/staff", deps.adminHandler.ListStaff)
				adm.Post("/staff", deps.adminHandler.AssignStaff)
				adm.Delete("/staff/{id}", deps.adminHandler.RemoveStaff)
				adm.Get("/gate-staff", deps.adminHandler.ListGateStaff)
				adm.Post("/gate-staff", deps.adminHandler.CreateGateStaff)
				adm.Get("/settlements", deps.adminHandler.ListSettlements)
				adm.Post("/settlements", deps.adminHandler.CreateSettlement)
				adm.Post("/settlements/{id}/paid", deps.adminHandler.MarkSettlementPaid)
				adm.Get("/organizers/{id}/payout", deps.adminHandler.GetOrganizerPayout)
				adm.Put("/organizers/{id}/payout", deps.adminHandler.UpsertOrganizerPayout)
				adm.Get("/queue/dlq", deps.adminHandler.QueueDLQStats)
			})
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

func readyz(pool *pgxpool.Pool, redis *goredis.Client, mt *midtransclient.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		checks := map[string]string{}
		if err := pool.Ping(ctx); err != nil {
			checks["postgres"] = "down"
			response.Fail(w, http.StatusServiceUnavailable, "NOT_READY", "database unavailable")
			return
		}
		checks["postgres"] = "up"
		if err := redis.Ping(ctx).Err(); err != nil {
			checks["redis"] = "down"
			response.Fail(w, http.StatusServiceUnavailable, "NOT_READY", "redis unavailable")
			return
		}
		checks["redis"] = "up"
		if mt.IsConfigured() {
			checks["midtrans"] = "configured"
		} else {
			checks["midtrans"] = "not_configured"
		}
		response.OK(w, map[string]interface{}{"status": "ready", "checks": checks})
	}
}
