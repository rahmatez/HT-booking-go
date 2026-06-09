# High-Traffic Booking & Ticketing Platform

Platform booking & ticketing skala besar dengan stack **Golang + PostgreSQL + Redis + Next.js + Tailwind**.

## Prasyarat

- Go 1.22+
- Node.js 20+
- Docker & Docker Compose
- [sqlc](https://docs.sqlc.dev/) (opsional, untuk regenerate query)

## Quick Start

```bash
# 1. Clone & setup environment
cp .env.example .env

# 2. Jalankan PostgreSQL & Redis
make up

# 3. Migrasi database (via psql di container)
docker exec -i htb-postgres psql -U booking -d booking < backend/migrations/000001_init_schema.up.sql

# 4. Seed data sample
make seed

# 5. Jalankan backend (terminal 1)
make backend

# 6. Jalankan frontend (terminal 2)
make frontend
```

Buka:
- Frontend: http://localhost:3000
- API: http://localhost:8080/api/v1
- Health: http://localhost:8080/healthz

## Akun Demo (setelah seed)

| Role | Email | Password |
|------|-------|----------|
| User | user@booking.local | user12345 |
| Admin | admin@booking.local | admin12345 |

Event demo: `/events/konser-demo-2026`

**Admin panel:** http://localhost:3000/admin (login sebagai admin)

## Struktur Proyek

```
├── backend/          # Go API (Chi, sqlc, pgx)
├── frontend/         # Next.js 16 + Tailwind 4
├── docker-compose.yml
├── plan.md           # Rancangan arsitektur lengkap
└── Makefile
```

## Alur Booking (MVP)

1. Login → pilih event → pilih tiket
2. **Hold** inventory (10 menit, Redis-ready architecture)
3. Checkout + countdown timer
4. **Simulate payment** (development) → konfirmasi booking
5. E-ticket dengan kode unik

## API Endpoints Utama

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/api/v1/auth/register` | Registrasi |
| POST | `/api/v1/auth/login` | Login |
| GET | `/api/v1/admin/dashboard/stats` | Statistik dashboard (admin) |
| GET | `/api/v1/admin/events` | List semua event (admin) |
| POST | `/api/v1/admin/events` | Buat event (admin) |
| GET | `/api/v1/admin/bookings` | List semua booking (admin) |
| GET | `/api/v1/events` | List event |
| GET | `/api/v1/events/:slug` | Detail event |
| POST | `/api/v1/bookings/hold` | Hold tiket |
| POST | `/api/v1/bookings/:id/confirm` | Mulai pembayaran |
| POST | `/api/v1/payments/simulate` | Simulasi bayar (dev only) |

## Perintah Berguna

```bash
make up          # Start containers
make down        # Stop containers
make seed        # Seed sample data
make backend     # Run Go API
make frontend    # Run Next.js dev
make test        # Run Go tests
make sqlc        # Regenerate sqlc code
```

## Catatan Port

PostgreSQL Docker menggunakan port **5433** (bukan 5432) untuk menghindari konflik dengan PostgreSQL lokal.

## Dokumentasi

Lihat [plan.md](./plan.md) untuk rancangan arsitektur, roadmap, dan keputusan teknis lengkap.
