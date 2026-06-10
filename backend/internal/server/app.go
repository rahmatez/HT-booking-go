package server

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
	goredis "github.com/redis/go-redis/v9"
	"go.uber.org/zap"

	"github.com/rahmatez/high-traffic-booking/backend/internal/admin"
	"github.com/rahmatez/high-traffic-booking/backend/internal/audit"
	"github.com/rahmatez/high-traffic-booking/backend/internal/auth"
	"github.com/rahmatez/high-traffic-booking/backend/internal/booking"
	"github.com/rahmatez/high-traffic-booking/backend/internal/catalog"
	"github.com/rahmatez/high-traffic-booking/backend/internal/checkin"
	"github.com/rahmatez/high-traffic-booking/backend/internal/config"
	"github.com/rahmatez/high-traffic-booking/backend/internal/db"
	"github.com/rahmatez/high-traffic-booking/backend/internal/notification"
	"github.com/rahmatez/high-traffic-booking/backend/internal/payment"
	midtransclient "github.com/rahmatez/high-traffic-booking/backend/internal/payment/midtrans"
	redisutil "github.com/rahmatez/high-traffic-booking/backend/internal/platform/redis"
	"github.com/rahmatez/high-traffic-booking/backend/internal/queue"
	"github.com/rahmatez/high-traffic-booking/backend/internal/ticket"
	"github.com/rahmatez/high-traffic-booking/backend/internal/waitingroom"
	"github.com/rahmatez/high-traffic-booking/backend/internal/worker"
)

// App is the single composition root: one shared service graph for HTTP handlers and background workers.
type App struct {
	Server *Server

	emailSvc        *notification.Service
	jobProcessor    *worker.JobProcessor
	holdWorker      *worker.HoldExpiryWorker
	reconcileWorker *worker.PaymentReconcileWorker
}

func NewApp(cfg *config.Config, log *zap.Logger, pool *pgxpool.Pool, redis *goredis.Client) *App {
	queries := db.New(pool)
	jwtSvc := auth.NewJWTService(cfg.JWTSecret, cfg.JWTAccessTTL, cfg.JWTRefreshTTL)

	cache := redisutil.NewCache(redis)
	holdStore := redisutil.NewHoldStore(redis)
	rateLimiter := redisutil.NewRateLimiter(redis)

	emailSvc := notification.NewService(cfg)
	authEmail := notification.NewAuthEmailAdapter(emailSvc)
	bookingNotifier := notification.NewBookingNotifier(emailSvc, queries, cfg)

	authSvc := auth.NewService(pool, queries, jwtSvc, cfg.FrontendURL)
	authSvc.SetEmailSender(authEmail)
	authHandler := auth.NewHandler(authSvc, cfg)

	catalogSvc := catalog.NewService(queries, cache, cfg)
	catalogHandler := catalog.NewHandler(catalogSvc)

	bookingSvc := booking.NewService(pool, queries, cfg, holdStore, cache)

	waitingRoomSvc := waitingroom.NewService(redis, queries)
	bookingSvc.SetQueueGate(waitingRoomSvc)
	waitingRoomHandler := waitingroom.NewHandler(waitingRoomSvc)

	bookingHandler := booking.NewHandler(bookingSvc)

	mtClient := midtransclient.NewClient(cfg.MidtransServerKey, cfg.MidtransClientKey, cfg.MidtransIsProduction)
	paymentSvc := payment.NewService(pool, queries, bookingSvc, mtClient, cfg)
	paymentSvc.SetOnConfirmed(bookingNotifier.OnPaymentConfirmed)
	paymentHandler := payment.NewHandler(paymentSvc, queries, bookingSvc, cfg)

	ticketHandler := ticket.NewHandler(queries)
	checkinHandler := checkin.NewHandler(queries)

	auditSvc := audit.NewService(queries)
	adminSvc := admin.NewService(queries, catalogSvc, auditSvc)
	jobQueue := queue.NewRedisQueue(redis)
	adminHandler := admin.NewHandler(adminSvc, paymentSvc, jobQueue)

	srv := newServer(cfg, log, pool, redis, routeDeps{
		queries:            queries,
		jwtSvc:             jwtSvc,
		rateLimiter:        rateLimiter,
		mtClient:           mtClient,
		authHandler:        authHandler,
		catalogHandler:     catalogHandler,
		bookingHandler:     bookingHandler,
		waitingRoomHandler: waitingRoomHandler,
		paymentHandler:     paymentHandler,
		ticketHandler:      ticketHandler,
		checkinHandler:     checkinHandler,
		adminHandler:       adminHandler,
	})

	return &App{
		Server:          srv,
		emailSvc:        emailSvc,
		jobProcessor:    worker.NewJobProcessor(jobQueue, emailSvc, paymentSvc, log),
		holdWorker:      worker.NewHoldExpiryWorker(queries, bookingSvc, log),
		reconcileWorker: worker.NewPaymentReconcileWorker(queries, paymentSvc, log),
	}
}

func (a *App) StartBackground(ctx context.Context) {
	go a.emailSvc.StartWorker(ctx)
	go a.jobProcessor.Start(ctx)
	go a.holdWorker.Start(ctx)
	go a.reconcileWorker.Start(ctx)
}
