package booking_test

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"

	"github.com/rahmatez/high-traffic-booking/backend/internal/booking"
	"github.com/rahmatez/high-traffic-booking/backend/internal/config"
	"github.com/rahmatez/high-traffic-booking/backend/internal/db"
	"github.com/rahmatez/high-traffic-booking/backend/internal/platform/database"
	redisutil "github.com/rahmatez/high-traffic-booking/backend/internal/platform/redis"
)

// TestConcurrentHoldLastTicket ensures only one hold succeeds when quota is 1.
// Skipped with -short (CI unit tests). Run: go test ./internal/booking/... -run TestConcurrentHoldLastTicket
func TestConcurrentHoldLastTicket(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	_ = godotenv.Load("../../.env")
	_ = godotenv.Load("../../../.env")

	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("config: %v", err)
	}

	ctx := context.Background()
	pool, err := database.NewPool(ctx, cfg.DatabaseURL, 10, 2)
	if err != nil {
		t.Skipf("database unavailable: %v", err)
	}
	defer pool.Close()

	redisClient, err := redisutil.NewClient(cfg.RedisURL)
	if err != nil {
		t.Skipf("redis unavailable: %v", err)
	}
	defer redisClient.Close()

	eventID, ticketTypeID, userIDs := seedRaceFixture(t, ctx, pool)
	if len(userIDs) < 2 {
		t.Fatal("need at least 2 users")
	}

	queries := db.New(pool)
	cache := redisutil.NewCache(redisClient)
	holdStore := redisutil.NewHoldStore(redisClient)
	svc := booking.NewService(pool, queries, cfg, holdStore, cache)

	const workers = 10
	var success int32
	var wg sync.WaitGroup
	wg.Add(workers)

	for i := 0; i < workers; i++ {
		userID := userIDs[i%len(userIDs)]
		go func(n int) {
			defer wg.Done()
			_, _, err := svc.Hold(ctx, userID, uuid.NewString(), booking.HoldInput{
				EventID: eventID,
				Items: []booking.HoldItem{{
					TicketTypeID: ticketTypeID,
					Quantity:     1,
				}},
			})
			if err == nil {
				atomic.AddInt32(&success, 1)
			}
		}(i)
	}

	wg.Wait()

	if success != 1 {
		t.Fatalf("expected exactly 1 successful hold, got %d", success)
	}

	tt, err := queries.GetTicketTypeByID(ctx, ticketTypeID)
	if err != nil {
		t.Fatalf("get ticket type: %v", err)
	}
	if tt.HeldCount != 1 {
		t.Fatalf("expected held_count=1, got %d", tt.HeldCount)
	}
}

func seedRaceFixture(t *testing.T, ctx context.Context, pool *pgxpool.Pool) (uuid.UUID, uuid.UUID, []uuid.UUID) {
	t.Helper()

	tag := fmt.Sprintf("race-%d", time.Now().UnixNano())
	var eventID, ticketTypeID uuid.UUID
	var userIDs []uuid.UUID

	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatalf("begin: %v", err)
	}
	defer tx.Rollback(ctx)

	var venueID uuid.UUID
	err = tx.QueryRow(ctx, `
		INSERT INTO venues (name, address, city, capacity)
		VALUES ($1, 'Test', 'Jakarta', 100)
		RETURNING id
	`, "Race Venue "+tag).Scan(&venueID)
	if err != nil {
		t.Fatalf("venue id: %v", err)
	}

	err = tx.QueryRow(ctx, `
		INSERT INTO events (slug, title, description, venue_id, status, starts_at, ends_at)
		VALUES ($1, 'Race Event', 'test', $2, 'published', NOW() + interval '30 days', NOW() + interval '31 days')
		RETURNING id
	`, tag, venueID).Scan(&eventID)
	if err != nil {
		t.Fatalf("event: %v", err)
	}

	err = tx.QueryRow(ctx, `
		INSERT INTO ticket_types (event_id, name, price, total_quota, max_per_order, sales_start_at, sales_end_at)
		VALUES ($1, 'Solo', 100000, 1, 1, NOW() - interval '1 hour', NOW() + interval '30 days')
		RETURNING id
	`, eventID).Scan(&ticketTypeID)
	if err != nil {
		t.Fatalf("ticket type: %v", err)
	}

	for i := 0; i < 5; i++ {
		email := fmt.Sprintf("%s-user%d@race.test", tag, i)
		var userID uuid.UUID
		err = tx.QueryRow(ctx, `
			INSERT INTO users (email, password_hash, full_name, role)
			VALUES ($1, 'hash', $2, 'user')
			RETURNING id
		`, email, fmt.Sprintf("User %d", i)).Scan(&userID)
		if err != nil {
			t.Fatalf("user: %v", err)
		}
		userIDs = append(userIDs, userID)
	}

	if err := tx.Commit(ctx); err != nil {
		t.Fatalf("commit: %v", err)
	}

	t.Cleanup(func() {
		cleanupCtx := context.Background()
		_, _ = pool.Exec(cleanupCtx, `DELETE FROM bookings WHERE event_id = $1`, eventID)
		_, _ = pool.Exec(cleanupCtx, `DELETE FROM ticket_types WHERE event_id = $1`, eventID)
		_, _ = pool.Exec(cleanupCtx, `DELETE FROM events WHERE id = $1`, eventID)
		_, _ = pool.Exec(cleanupCtx, `DELETE FROM venues WHERE id = $1`, venueID)
		for _, uid := range userIDs {
			_, _ = pool.Exec(cleanupCtx, `DELETE FROM users WHERE id = $1`, uid)
		}
	})

	return eventID, ticketTypeID, userIDs
}
