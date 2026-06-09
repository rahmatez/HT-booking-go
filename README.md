# Eventra

Platform booking & ticketing event — **Eventra** — dibangun dengan stack **Golang + PostgreSQL + Redis + Next.js + Tailwind**.

> Nama repo folder (`high-traffic-booking`) adalah nama teknis proyek; brand produk adalah **Eventra**.

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
docker exec -i eventra-postgres psql -U booking -d booking < backend/migrations/000001_init_schema.up.sql

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
2. **Hold** inventory (10 menit)
3. Checkout + countdown timer
4. **Bayar via Midtrans Snap** (sandbox) → konfirmasi booking
5. E-ticket dengan kode unik

### Midtrans Sandbox

Tambahkan ke `.env` dan `frontend/.env.local`:

```env
MIDTRANS_SERVER_KEY=SB-Mid-server-...
MIDTRANS_CLIENT_KEY=SB-Mid-client-...
MIDTRANS_IS_PRODUCTION=false
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=SB-Mid-client-...
NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION=false
```

Kartu test sandbox: `4811 1111 1111 1114` (CVV `123`, expiry masa depan).

Webhook production: set URL di Midtrans Dashboard → `POST {APP_URL}/api/v1/payments/webhook/midtrans`

Untuk development lokal, status pembayaran disinkronkan otomatis via `POST /payments/sync` setelah Snap sukses (tanpa perlu ngrok).

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
| POST | `/api/v1/payments/checkout` | Buat Snap token Midtrans |
| POST | `/api/v1/payments/sync` | Sinkron status bayar dari Midtrans |
| POST | `/api/v1/payments/webhook/midtrans` | Webhook notifikasi Midtrans |
| POST | `/api/v1/payments/simulate` | Simulasi bayar (fallback tanpa keys) |

## Redis (cache, hold lock, rate limit)

| Fitur | Deskripsi |
|-------|-----------|
| **Rate limit** | Login, hold booking, checkout — via Redis counter |
| **Cache** | Event list (60s), detail event (60s), availability (5s) |
| **Hold lock** | Distributed lock per tipe tiket saat hold + metadata TTL di Redis |

Jalankan integration test race condition (butuh PostgreSQL + Redis):

```bash
make test-integration
```

## Perintah Berguna

```bash
make up          # Start containers
make down        # Stop containers
make seed        # Seed sample data
make backend     # Run Go API
make frontend    # Run Next.js dev
make test        # Run Go unit tests (short)
make test-integration  # Race condition hold test
make sqlc        # Regenerate sqlc code
```

## Catatan Port

PostgreSQL Docker menggunakan port **5433** (bukan 5432) untuk menghindari konflik dengan PostgreSQL lokal.

## Dokumentasi

- [plan.md](./plan.md) — Arsitektur, database, API, roadmap MVP Fase 1  
- [plan-production.md](./plan-production.md) — Roadmap production (Fase A/B/C) menuju standar platform tiket seperti Loket/Tiket.com
