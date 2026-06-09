package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"

	"github.com/rahmatez/high-traffic-booking/backend/internal/config"
	"github.com/rahmatez/high-traffic-booking/backend/internal/db"
	"github.com/rahmatez/high-traffic-booking/backend/internal/platform/database"
)

func main() {
	_ = godotenv.Load()
	_ = godotenv.Load("../.env")

	cfg, err := config.Load()
	if err != nil {
		panic(err)
	}

	ctx := context.Background()
	pool, err := database.NewPool(ctx, cfg.DatabaseURL, 5, 2)
	if err != nil {
		panic(err)
	}
	defer pool.Close()

	queries := db.New(pool)

	// Admin user
	adminHash, _ := bcrypt.GenerateFromPassword([]byte("admin12345"), bcrypt.DefaultCost)
	admin, err := queries.CreateUser(ctx, db.CreateUserParams{
		Email:        "admin@booking.local",
		PasswordHash: string(adminHash),
		FullName:     "Platform Admin",
		Phone:        pgtype.Text{},
		Role:         "admin",
	})
	if err != nil {
		fmt.Println("admin may already exist:", err)
	} else {
		fmt.Println("created admin:", admin.Email)
	}

	// Demo user
	userHash, _ := bcrypt.GenerateFromPassword([]byte("user12345"), bcrypt.DefaultCost)
	user, err := queries.CreateUser(ctx, db.CreateUserParams{
		Email:        "user@booking.local",
		PasswordHash: string(userHash),
		FullName:     "Demo User",
		Phone:        pgtype.Text{String: "081234567890", Valid: true},
		Role:         "user",
	})
	if err != nil {
		fmt.Println("user may already exist:", err)
	} else {
		fmt.Println("created user:", user.Email)
	}

	venue, err := queries.CreateVenue(ctx, db.CreateVenueParams{
		Name:      "Gelora Bung Karno",
		Address:   "Jl. Pintu Satu Senayan",
		City:      "Jakarta",
		Capacity:  50000,
		Latitude:  pgtype.Numeric{},
		Longitude: pgtype.Numeric{},
	})
	if err != nil {
		fmt.Println("venue may already exist, skipping event seed")
		os.Exit(0)
	}

	starts := time.Now().AddDate(0, 1, 0)
	ends := starts.Add(4 * time.Hour)

	event, err := queries.CreateEvent(ctx, db.CreateEventParams{
		Slug:          "konser-demo-2026",
		Title:         "Konser Demo 2026",
		Description:   "Event demo untuk pengujian platform booking high-traffic.",
		VenueID:       pgtype.UUID{Bytes: venue.ID, Valid: true},
		CoverImageUrl: pgtype.Text{},
		Status:        "published",
		StartsAt:      starts,
		EndsAt:        ends,
		Metadata:      []byte(`{}`),
	})
	if err != nil {
		fmt.Println("event seed error:", err)
		os.Exit(1)
	}

	salesStart := time.Now()
	salesEnd := starts.Add(-1 * time.Hour)

	_, err = queries.CreateTicketType(ctx, db.CreateTicketTypeParams{
		EventID:      event.ID,
		Name:         "Regular",
		Price:        250000,
		TotalQuota:   1000,
		MaxPerOrder:  4,
		SalesStartAt: salesStart,
		SalesEndAt:   salesEnd,
	})
	if err != nil {
		fmt.Println("ticket type regular error:", err)
	}

	_, err = queries.CreateTicketType(ctx, db.CreateTicketTypeParams{
		EventID:      event.ID,
		Name:         "VIP",
		Price:        750000,
		TotalQuota:   200,
		MaxPerOrder:  2,
		SalesStartAt: salesStart,
		SalesEndAt:   salesEnd,
	})
	if err != nil {
		fmt.Println("ticket type vip error:", err)
	}

	fmt.Println("seed completed successfully")
	fmt.Println("  admin: admin@booking.local / admin12345")
	fmt.Println("  user:  user@booking.local / user12345")
	fmt.Println("  event: /events/konser-demo-2026")
}
