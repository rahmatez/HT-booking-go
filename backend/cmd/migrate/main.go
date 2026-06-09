package main

import (
	"fmt"
	"os"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()
	_ = godotenv.Load("../.env")
	_ = godotenv.Load("../../.env")

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		databaseURL = "postgres://booking:secret@localhost:5433/booking?sslmode=disable"
	}

	m, err := migrate.New("file://migrations", databaseURL)
	if err != nil {
		fmt.Fprintf(os.Stderr, "migrate init: %v\n", err)
		os.Exit(1)
	}
	defer m.Close()

	cmd := "up"
	if len(os.Args) > 1 {
		cmd = os.Args[1]
	}

	switch cmd {
	case "up":
		err = m.Up()
	case "down":
		err = m.Steps(-1)
	default:
		fmt.Fprintf(os.Stderr, "usage: migrate [up|down]\n")
		os.Exit(1)
	}

	if err != nil && err != migrate.ErrNoChange {
		fmt.Fprintf(os.Stderr, "migrate %s: %v\n", cmd, err)
		os.Exit(1)
	}

	fmt.Printf("migrate %s: ok\n", cmd)
}
