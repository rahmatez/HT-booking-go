.PHONY: help up down logs migrate-up migrate-down migrate-create seed backend frontend dev test lint

help:
	@echo "High-Traffic Booking — available commands:"
	@echo "  make up            Start PostgreSQL & Redis"
	@echo "  make down          Stop containers"
	@echo "  make migrate-up    Run database migrations"
	@echo "  make migrate-down  Rollback last migration"
	@echo "  make seed          Seed sample data"
	@echo "  make backend       Run Go API server"
	@echo "  make frontend      Run Next.js dev server"
	@echo "  make dev           Run backend + frontend (requires 2 terminals)"
	@echo "  make test          Run backend tests"
	@echo "  make sqlc          Generate sqlc code"

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

migrate-up:
	cd backend && go run ./cmd/migrate up

migrate-down:
	cd backend && go run ./cmd/migrate down

seed:
	cd backend && go run ./cmd/seed

sqlc:
	cd backend && sqlc generate

backend:
	cd backend && go run ./cmd/api

frontend:
	cd frontend && npm run dev

test:
	cd backend && go test ./...

lint:
	cd backend && golangci-lint run ./...
