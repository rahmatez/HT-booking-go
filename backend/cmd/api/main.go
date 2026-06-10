package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"
	"go.uber.org/zap"

	"github.com/rahmatez/high-traffic-booking/backend/internal/config"
	"github.com/rahmatez/high-traffic-booking/backend/internal/platform/database"
	"github.com/rahmatez/high-traffic-booking/backend/internal/platform/logger"
	redisclient "github.com/rahmatez/high-traffic-booking/backend/internal/platform/redis"
	"github.com/rahmatez/high-traffic-booking/backend/internal/server"
)

func main() {
	_ = godotenv.Load()
	_ = godotenv.Load("../.env")

	cfg, err := config.Load()
	if err != nil {
		panic(err)
	}

	log, err := logger.New(cfg.AppEnv)
	if err != nil {
		panic(err)
	}
	defer log.Sync()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	pool, err := database.NewPool(ctx, cfg.DatabaseURL, cfg.DatabaseMaxOpen, cfg.DatabaseMaxIdle)
	if err != nil {
		log.Fatal("database connection failed", zap.Error(err))
	}
	defer pool.Close()

	redis, err := redisclient.NewClient(cfg.RedisURL)
	if err != nil {
		log.Fatal("redis connection failed", zap.Error(err))
	}
	defer redis.Close()

	app := server.NewApp(cfg, log, pool, redis)
	app.StartBackground(ctx)

	go func() {
		if err := app.Server.Start(); err != nil {
			log.Fatal("server error", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	cancel()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	if err := app.Server.Shutdown(shutdownCtx); err != nil {
		log.Error("shutdown error", zap.Error(err))
	}
}
