# High-Traffic Booking & Ticketing Platform

> Rancangan dan persiapan awal untuk platform booking & ticketing skala besar.  
> Stack: **Golang** (backend) · **PostgreSQL** (database) · **Next.js + Tailwind** (frontend)

## Daftar Isi

1. [Ringkasan Proyek](#1-ringkasan-proyek)
2. [Arsitektur Sistem](#2-arsitektur-sistem)
3. [Tech Stack](#3-tech-stack)
4. [Struktur Repository](#4-struktur-repository)
5. [Desain Database](#5-desain-database)
6. [API Design](#6-api-design-rest)
7. [Frontend](#7-frontend--halaman--komponen)
8. [Keamanan](#8-keamanan)
9. [Observability](#9-observability)
10. [NFR & SLO](#10-kebutuhan-non-fungsional-nfr--slo)
11. [Aturan Bisnis](#11-aturan-bisnis--kebijakan)
12. [Strategi Testing](#12-strategi-testing)
13. [CI/CD & Deployment](#13-cicd--deployment)
14. [Compliance & Privasi](#14-compliance-legal--privasi)
15. [Strategi Caching](#15-strategi-caching)
16. [Multi-Tenancy Organizer](#16-multi-tenancy-organizer-fase-2)
17. [Roadmap Implementasi](#17-roadmap-implementasi)
18. [Environment Variables](#18-environment-variables)
19. [Keputusan Arsitektur (ADR)](#19-keputusan-arsitektur-adr)
20. [Risiko & Mitigasi](#20-risiko--mitigasi)
21. [Checklist](#21-checklist-sebelum-mulai-coding)
22. [Referensi](#22-referensi)

---

## 1. Ringkasan Proyek

### 1.1 Visi

Membangun platform e-commerce booking & ticketing yang mampu menangani traffic tinggi (flash sale, event populer) dengan jaminan **zero double booking**, pengalaman pengguna yang responsif, dan alur pembayaran yang aman.

### 1.2 Scope MVP (Fase 1)

| In Scope | Out of Scope (Fase Berikutnya) |
|----------|-------------------------------|
| Registrasi & login pengguna | Virtual waiting room |
| Browse & detail event | Seat map interaktif (SVG/Canvas) |
| Booking berbasis kuota (tanpa seat map) | Dynamic pricing |
| Hold booking + countdown expiry | Resale marketplace |
| Integrasi payment gateway | Multi-region deployment |
| E-ticket (email + halaman digital) | Mobile app native |
| Admin panel dasar (CRUD event) | Ticket scanner app |

### 1.3 Prinsip Desain

1. **Correctness over speed** — inventory tidak boleh oversell, meski traffic tinggi.
2. **Modular monolith dulu** — satu codebase Go terstruktur, pecah ke microservices saat perlu.
3. **Async by default** — proses berat (payment reconcile, notifikasi) lewat message queue.
4. **Observable** — setiap request booking bisa ditrace dari awal sampai konfirmasi.
5. **Idempotent** — semua endpoint mutasi (booking, payment) wajib idempotency key.

### 1.4 Persona Pengguna

| Persona | Kebutuhan Utama |
|---------|----------------|
| **Guest / Buyer** | Cepat menemukan event, aman checkout, e-ticket mudah diakses |
| **Organizer** | Kelola event & kuota, pantau penjualan real-time |
| **Admin Platform** | Moderasi event, kelola user, akses laporan global |
| **Gate Staff** | Scan & validasi tiket cepat di venue (Fase 3) |

### 1.5 Keputusan Produk Awal

| Keputusan | Pilihan | Alasan |
|-----------|---------|--------|
| Guest checkout | **Tidak** (wajib login) | Mempermudah riwayat booking, refund, dan anti-fraud |
| Keranjang belanja | **Tidak** (direct checkout) | Pola ticketing = beli langsung, minim latency |
| Mata uang | **IDR (integer, tanpa desimal)** | Hindari floating point, sesuai regulasi lokal |
| Timezone | **Asia/Jakarta (WIB)** default | Satu timezone dulu, multi-TZ di Fase 3 |
| Bahasa UI | **Bahasa Indonesia** | Target pasar awal; i18n di Fase 3 |

---

## 2. Arsitektur Sistem

### 2.1 Diagram Arsitektur (Target Production)

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
│   Next.js Web (SSR/ISR)  ·  Admin Dashboard  ·  [Mobile - F3]  │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                         EDGE LAYER                              │
│   CDN (static assets)  ·  WAF  ·  Rate Limiter  ·  SSL/TLS     │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                      API / GATEWAY LAYER                        │
│   Load Balancer (Nginx/Traefik)  →  Golang API (modular)       │
└──────┬──────────────────┬──────────────────┬────────────────────┘
       │                  │                  │
┌──────▼──────┐   ┌───────▼───────┐   ┌───────▼────────┐
│ PostgreSQL  │   │     Redis     │   │ Message Queue  │
│  Primary +  │   │ cache · lock  │   │ NATS / RabbitMQ│
│  Replicas   │   │ hold · rate   │   │                │
└─────────────┘   └───────────────┘   └───────┬────────┘
                                              │
                              ┌───────────────▼───────────────┐
                              │        ASYNC WORKERS          │
                              │ booking · payment · notif     │
                              └───────────────────────────────┘
```

### 2.2 Komponen & Tanggung Jawab

| Komponen | Fungsi | Fase |
|----------|--------|------|
| **Next.js Frontend** | UI publik, checkout, e-ticket viewer | F1 |
| **Next.js Admin** | CMS event, laporan booking | F1 |
| **Golang API** | REST/JSON API, business logic | F1 |
| **PostgreSQL** | Source of truth: users, events, bookings, payments | F1 |
| **Redis** | Session hold, distributed lock, cache, rate limit | F1 |
| **Message Queue** | Async booking confirm, email, payment webhook | F2 |
| **Object Storage** | QR code image, invoice PDF | F2 |
| **PgBouncer** | Connection pooling | F2 |
| **Read Replicas** | Query read-heavy (listing, history) | F3 |
| **CDN** | Cache halaman event populer | F3 |

### 2.3 Alur Booking (End-to-End)

```
User browse event
    → Pilih jumlah tiket / slot
    → API: HOLD inventory (Redis TTL 10 menit)
    → User diarahkan ke checkout + countdown timer
    → User bayar via payment gateway
    → Gateway kirim webhook → worker proses
    → Worker: CONFIRM booking (atomic DB update)
    → Worker: generate ticket + kirim email
    → User lihat e-ticket di dashboard

Jika hold expire / payment gagal:
    → Redis TTL habis → inventory dikembalikan
    → Booking status = expired / cancelled
```

### 2.4 State Machine Booking & Payment

```
                    ┌──────────┐
                    │   held   │◄── POST /bookings/hold
                    └────┬─────┘
                         │ user ke checkout
                         ▼
              ┌─────────────────────┐
              │  pending_payment    │◄── POST /bookings/:id/confirm
              └─────────┬───────────┘
                        │
           ┌────────────┼────────────┐
           ▼            ▼            ▼
    ┌────────────┐ ┌──────────┐ ┌───────────┐
    │ confirmed  │ │ expired  │ │ cancelled │
    └────────────┘ └──────────┘ └───────────┘
     webhook OK     hold TTL      user cancel /
                    habis         payment gagal
```

**Transisi yang valid:**

| Dari | Ke | Trigger |
|------|----|---------|
| — | `held` | Hold berhasil, inventory direservasi |
| `held` | `pending_payment` | User mulai checkout, payment session dibuat |
| `held` | `expired` | `hold_expires_at` lewat (background job) |
| `held` | `cancelled` | User batalkan sebelum bayar |
| `pending_payment` | `confirmed` | Webhook payment sukses |
| `pending_payment` | `cancelled` | Payment gagal / ditolak gateway |
| `pending_payment` | `expired` | Hold habis saat masih pending (edge case) |
| `confirmed` | `cancelled` | Refund penuh (Fase 2) |

### 2.5 Edge Case Kritis: Payment vs Hold Expiry

```
Skenario: User bayar di menit ke-9, webhook datang di menit ke-11 (hold TTL 10 menit)

Kebijakan:
  1. Jika payment session sudah dibuat SEBELUM hold expire → honor payment (grace period 5 menit)
  2. Worker cek: payment.status = success AND payment.created_at < booking.hold_expires_at + 5m
  3. Jika valid → confirm booking meski hold sudah expire
  4. Jika tidak valid → auto-refund via gateway + booking = expired
```

### 2.6 Outbox Pattern (Fase 2)

Untuk memastikan event tidak hilang saat kirim ke message queue:

```
Transaksi DB:
  1. UPDATE booking status
  2. INSERT outbox_events (type, payload, status=pending)
  COMMIT

Worker terpisah:
  3. Poll outbox_events WHERE status = pending
  4. Publish ke NATS/RabbitMQ
  5. UPDATE outbox_events SET status = published
```

---

## 3. Tech Stack

### 3.1 Backend (Golang)

| Kategori | Pilihan | Alasan |
|----------|---------|--------|
| HTTP Framework | **Chi** atau **Gin** | Ringan, middleware ecosystem matang |
| Database Driver | **pgx** | Performa native, pool bawaan |
| Query Builder | **sqlc** | Type-safe SQL, tanpa magic ORM |
| Migration | **golang-migrate** | Standar industri, CLI & embed |
| Validation | **go-playground/validator** | Struct tag validation |
| Config | Environment variables + **Viper** | 12-factor app |
| Logging | **Zap** (uber-go/zap) | Structured JSON logs |
| Auth | JWT (access + refresh) | Stateless, mudah di Next.js |
| Tracing | **OpenTelemetry** | Distributed tracing |
| Testing | std `testing` + **testify** | Unit & integration test |
| Linting | **golangci-lint** | Static analysis, enforce standar |
| Mocks | **mockery** atau manual interface | Isolasi unit test |
| Job Scheduler | **robfig/cron** atau ticker Go | Hold expiry, outbox poller |
| QR Code | **skip2/go-qrcode** | Generate QR tiket |

### 3.2 Database (PostgreSQL)

| Kategori | Pilihan |
|----------|---------|
| Versi | PostgreSQL 16+ |
| Pooling | PgBouncer (transaction mode) |
| Backup | pg_dump terjadwal + WAL archiving (production) |
| Extensions | `uuid-ossp`, `pg_trgm` (search), `btree_gist` (opsional) |

### 3.3 Frontend (Next.js + Tailwind)

| Kategori | Pilihan | Alasan |
|----------|---------|--------|
| Framework | **Next.js 15** (App Router) | SSR/ISR, routing modern |
| Styling | **Tailwind CSS 4** | Utility-first, konsisten |
| UI Components | **shadcn/ui** | Accessible, Tailwind-native |
| Server State | **TanStack Query** | Cache, refetch, optimistic update |
| Client State | **Zustand** | Ringan untuk checkout flow |
| Forms | **React Hook Form + Zod** | Validasi type-safe |
| HTTP Client | `fetch` + wrapper atau **ky** | Native, cukup untuk REST |
| Auth | Custom JWT (httpOnly cookie) | Kontrol penuh, integrasi langsung dengan Go API |
| Linting | **ESLint** + **Prettier** | Konsistensi kode frontend |
| E2E Test | **Playwright** (Fase 2) | Test alur booking end-to-end |
| SEO | `metadata` API + JSON-LD | Event schema untuk Google |

### 3.4 Infrastruktur Lokal (Development)

| Layanan | Image / Tool |
|---------|-------------|
| PostgreSQL | `postgres:16-alpine` |
| Redis | `redis:7-alpine` |
| Message Queue | `nats:2-alpine` atau `rabbitmq:3-management` |
| Object Storage | `minio/minio` (Fase 2) |
| Orchestration | `docker-compose.yml` |

### 3.5 Integrasi Pihak Ketiga

| Layanan | Provider (disarankan) | Fase |
|---------|----------------------|------|
| Payment | **Midtrans** atau **Xendit** | F1 |
| Email | **Resend** atau AWS SES | F1 |
| SMS/OTP | Twilio (opsional) | F2 |
| Error Tracking | **Sentry** | F1 |
| Analytics | PostHog atau Google Analytics | F2 |
| Anti-bot | Cloudflare Turnstile | F2 |

---

## 4. Struktur Repository

```
high-traffic-booking/
├── backend/
│   ├── cmd/
│   │   └── api/                  # Entry point HTTP server
│   ├── internal/
│   │   ├── auth/                 # Register, login, JWT
│   │   ├── catalog/              # Event, venue, kategori
│   │   ├── inventory/            # Kuota, availability
│   │   ├── booking/              # Hold, confirm, cancel
│   │   ├── payment/              # Gateway, webhook
│   │   ├── ticket/               # Generate & validasi tiket
│   │   ├── notification/         # Email, SMS
│   │   └── admin/                # Endpoint admin
│   ├── worker/                   # Background jobs (Fase 2)
│   │   ├── hold_expiry/
│   │   ├── outbox_publisher/
│   │   └── payment_reconcile/
│   ├── pkg/                      # Shared utilities (tidak domain-specific)
│   ├── migrations/               # SQL migration files
│   ├── queries/                  # sqlc query files
│   ├── sqlc.yaml
│   ├── go.mod
│   └── go.sum
├── frontend/
│   ├── app/                      # Next.js App Router
│   │   ├── (public)/             # Landing, browse events
│   │   ├── events/[slug]/        # Detail event
│   │   ├── checkout/             # Payment flow
│   │   ├── bookings/             # Riwayat & e-ticket
│   │   ├── auth/                 # Login, register
│   │   └── admin/                # Dashboard organizer
│   ├── components/
│   ├── lib/                      # API client, utils, hooks
│   ├── public/
│   ├── tailwind.config.ts
│   └── package.json
├── infra/
│   ├── docker/
│   └── k8s/                      # (Fase 3)
├── docs/
│   ├── api/                      # OpenAPI spec
│   └── adr/                      # Architecture Decision Records
├── scripts/
│   ├── seed.sh                   # Seed data development
│   └── loadtest/                 # k6 scripts (Fase 3)
├── docker-compose.yml
├── .env.example
├── Makefile
└── plan.md                       # Dokumen ini
```

---

## 5. Desain Database

### 5.1 Entity Relationship (Ringkas)

```
users ──────────────< bookings >────────────── payments
  │                      │                        │
  │                      │                        └── payment_transactions
  │                      │
  │                      └── booking_items >── ticket_types
  │                                              │
  └── user_profiles                              └── events >── venues
                                                       │
                                                       └── event_schedules
```

### 5.2 Tabel Inti

#### `users`
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | UUID PK | |
| email | VARCHAR UNIQUE | |
| password_hash | VARCHAR | bcrypt |
| full_name | VARCHAR | |
| phone | VARCHAR | nullable |
| role | ENUM | `user`, `admin`, `organizer` |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

#### `events`
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | UUID PK | |
| slug | VARCHAR UNIQUE | URL-friendly |
| title | VARCHAR | |
| description | TEXT | |
| venue_id | UUID FK | |
| cover_image_url | VARCHAR | |
| status | ENUM | `draft`, `published`, `cancelled`, `completed` |
| starts_at | TIMESTAMPTZ | |
| ends_at | TIMESTAMPTZ | |
| metadata | JSONB | Info tambahan fleksibel |
| created_at | TIMESTAMPTZ | |

#### `ticket_types`
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | UUID PK | |
| event_id | UUID FK | |
| name | VARCHAR | e.g. "VIP", "Regular" |
| price | BIGINT | Dalam satuan terkecil (sen/rupiah) |
| total_quota | INT | Total tiket tersedia |
| sold_count | INT DEFAULT 0 | Tiket terjual (confirmed) |
| held_count | INT DEFAULT 0 | Tiket sedang di-hold (belum bayar) |
| max_per_order | INT DEFAULT 4 | Batas per transaksi |
| sales_start_at | TIMESTAMPTZ | |
| sales_end_at | TIMESTAMPTZ | |
| version | INT DEFAULT 0 | Optimistic locking |

#### `bookings`
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | UUID PK | |
| user_id | UUID FK | |
| event_id | UUID FK | |
| status | ENUM | `held`, `pending_payment`, `confirmed`, `cancelled`, `expired` |
| hold_expires_at | TIMESTAMPTZ | TTL hold |
| total_amount | BIGINT | |
| idempotency_key | VARCHAR UNIQUE | Cegah duplikasi |
| created_at | TIMESTAMPTZ | |
| confirmed_at | TIMESTAMPTZ | nullable |

#### `booking_items`
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | UUID PK | |
| booking_id | UUID FK | |
| ticket_type_id | UUID FK | |
| quantity | INT | |
| unit_price | BIGINT | Harga saat booking (snapshot) |

#### `tickets`
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | UUID PK | |
| booking_id | UUID FK | |
| ticket_type_id | UUID FK | |
| ticket_code | VARCHAR UNIQUE | Kode unik untuk QR |
| status | ENUM | `active`, `used`, `cancelled` |
| checked_in_at | TIMESTAMPTZ | nullable |

#### `payments`
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | UUID PK | |
| booking_id | UUID FK | |
| gateway | VARCHAR | `midtrans`, `xendit` |
| gateway_ref | VARCHAR | ID dari gateway |
| amount | BIGINT | |
| status | ENUM | `pending`, `success`, `failed`, `refunded` |
| paid_at | TIMESTAMPTZ | nullable |
| idempotency_key | VARCHAR UNIQUE | Cegah duplikasi webhook |

#### `venues`
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | UUID PK | |
| name | VARCHAR | Nama venue |
| address | TEXT | Alamat lengkap |
| city | VARCHAR | Kota |
| capacity | INT | Kapasitas maksimal venue |
| latitude | DECIMAL | Opsional, untuk maps |
| longitude | DECIMAL | Opsional, untuk maps |

#### `refresh_tokens`
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | UUID PK | |
| user_id | UUID FK | |
| token_hash | VARCHAR | Hash dari refresh token |
| expires_at | TIMESTAMPTZ | |
| revoked_at | TIMESTAMPTZ | nullable, untuk logout |

#### `audit_logs`
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | UUID PK | |
| actor_id | UUID | User yang melakukan aksi |
| action | VARCHAR | e.g. `booking.confirmed`, `event.published` |
| entity_type | VARCHAR | e.g. `booking`, `event` |
| entity_id | UUID | |
| metadata | JSONB | Detail perubahan (before/after) |
| created_at | TIMESTAMPTZ | |

#### `outbox_events` (Fase 2)
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | UUID PK | |
| event_type | VARCHAR | e.g. `booking.confirmed` |
| payload | JSONB | Data event |
| status | ENUM | `pending`, `published`, `failed` |
| created_at | TIMESTAMPTZ | |
| published_at | TIMESTAMPTZ | nullable |

#### `promo_codes` (Fase 2)
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | UUID PK | |
| code | VARCHAR UNIQUE | Kode voucher |
| discount_type | ENUM | `percentage`, `fixed` |
| discount_value | BIGINT | Nilai diskon |
| max_uses | INT | Batas pemakaian total |
| used_count | INT DEFAULT 0 | |
| valid_from | TIMESTAMPTZ | |
| valid_until | TIMESTAMPTZ | |
| event_id | UUID FK | nullable, jika spesifik event |

### 5.3 Index Strategy

```sql
-- Availability lookup
CREATE INDEX idx_ticket_types_event ON ticket_types(event_id);

-- User booking history
CREATE INDEX idx_bookings_user_created ON bookings(user_id, created_at DESC);

-- Active holds (untuk cleanup job)
CREATE INDEX idx_bookings_held_expires ON bookings(status, hold_expires_at)
  WHERE status = 'held';

-- Ticket validation
CREATE UNIQUE INDEX idx_tickets_code ON tickets(ticket_code);

-- Event listing
CREATE INDEX idx_events_status_starts ON events(status, starts_at)
  WHERE status = 'published';
```

### 5.4 Strategi Concurrency (Inventory)

```
┌─────────────────────────────────────────────────────────┐
│                  INVENTORY CONTROL                       │
├─────────────────────────────────────────────────────────┤
│ Layer 1: Redis (fast path)                              │
│   - Key: avail:{ticket_type_id} → sisa kuota (cache)    │
│   - Key: hold:{booking_id} → detail hold + TTL          │
│   - Lua script: cek avail >= qty, decrement, set hold   │
│   - TTL hold = BOOKING_HOLD_TTL (10 menit)              │
│                                                           │
│ Layer 2: PostgreSQL (source of truth)                    │
│   - available = total_quota - sold_count - held_count   │
│   - Saat HOLD:                                            │
│     UPDATE ticket_types SET held_count += $qty           │
│     WHERE available >= $qty AND version = $ver           │
│   - Saat CONFIRM:                                         │
│     sold_count += $qty, held_count -= $qty               │
│   - Saat EXPIRE/CANCEL:                                   │
│     held_count -= $qty                                    │
│   - Jika 0 rows affected → sold out / conflict           │
│                                                           │
│ Layer 3: Rekonsiliasi Redis ↔ DB (background, setiap 30s)│
│   - Compare Redis avail dengan DB available             │
│   - Jika selisih → sync Redis dari DB (DB menang)       │
│                                                           │
│ Layer 4: Idempotency                                      │
│   - Header: Idempotency-Key (UUID)                      │
│   - Simpan di bookings.idempotency_key                    │
│   - Return hasil sama jika key sudah diproses            │
└─────────────────────────────────────────────────────────┘
```

**Batasan tambahan:**
- Maks **1 hold aktif** per user per event (cegah hoarding tiket)
- Maks **3 hold aktif** total per user di seluruh event
- Rate limit `POST /bookings/hold`: **5 req/menit** per user

---

## 6. API Design (REST)

Base URL: `/api/v1`

### 6.1 Auth

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/auth/register` | Daftar akun baru |
| POST | `/auth/login` | Login, return JWT |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Invalidate refresh token |
| POST | `/auth/forgot-password` | Kirim link reset password via email |
| POST | `/auth/reset-password` | Set password baru dengan token |
| POST | `/auth/verify-email` | Verifikasi email setelah registrasi |

### 6.2 Catalog (Public)

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/events` | List event (paginated, filter status) |
| GET | `/events/:slug` | Detail event + ticket types + availability |
| GET | `/events/:slug/availability` | Real-time kuota tersisa |
| GET | `/events/search` | Cari event by keyword, kota, tanggal |

### 6.3 Booking

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/bookings/hold` | Hold tiket (butuh auth) |
| GET | `/bookings/:id` | Status booking |
| POST | `/bookings/:id/confirm` | Trigger payment |
| DELETE | `/bookings/:id` | Cancel booking |
| GET | `/bookings` | Riwayat booking user |

### 6.4 Payment

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/payments/webhook/:gateway` | Callback dari gateway |
| GET | `/payments/:id/status` | Cek status pembayaran |

### 6.5 Ticket

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/tickets/:code` | Detail tiket (owner only) |
| GET | `/bookings/:id/tickets` | List tiket dalam booking |

### 6.6 Admin

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/admin/events` | Buat event |
| PUT | `/admin/events/:id` | Update event |
| DELETE | `/admin/events/:id` | Hapus/archive event |
| POST | `/admin/events/:id/ticket-types` | Tambah tipe tiket |
| GET | `/admin/bookings` | List semua booking (filter) |
| GET | `/admin/reports/sales` | Laporan penjualan |

### 6.7 Response Format Standar

```json
{
  "success": true,
  "data": { },
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 150
  }
}
```

```json
{
  "success": false,
  "error": {
    "code": "INVENTORY_EXHAUSTED",
    "message": "Tiket sudah habis"
  }
}
```

### 6.8 Konvensi API

**Pagination** — query params: `?page=1&per_page=20` (default 20, maks 100)

**Sorting** — `?sort=starts_at&order=asc`

**Filtering** — `?status=published&city=Jakarta&date_from=2026-07-01`

**Auth header** — `Authorization: Bearer <access_token>`

**Idempotency** — `Idempotency-Key: <uuid-v4>` (wajib di POST mutasi)

**Request ID** — `X-Request-ID: <uuid>` (dikembalikan di response header untuk tracing)

### 6.9 Katalog Error Code

| Code | HTTP | Deskripsi |
|------|------|-----------|
| `VALIDATION_ERROR` | 400 | Input tidak valid |
| `UNAUTHORIZED` | 401 | Token invalid / expired |
| `FORBIDDEN` | 403 | Tidak punya akses |
| `NOT_FOUND` | 404 | Resource tidak ditemukan |
| `INVENTORY_EXHAUSTED` | 409 | Kuota habis |
| `HOLD_EXPIRED` | 409 | Hold sudah expired |
| `HOLD_LIMIT_REACHED` | 429 | Terlalu banyak hold aktif |
| `DUPLICATE_REQUEST` | 409 | Idempotency key sudah diproses |
| `PAYMENT_FAILED` | 402 | Pembayaran gagal |
| `RATE_LIMITED` | 429 | Terlalu banyak request |
| `INTERNAL_ERROR` | 500 | Error server |

---

## 7. Frontend — Halaman & Komponen

### 7.1 Halaman Publik

| Route | Render | Deskripsi |
|-------|--------|-----------|
| `/` | SSG/ISR | Landing page, event unggulan |
| `/events` | ISR | Daftar event dengan filter & search |
| `/events/[slug]` | ISR + client fetch availability | Detail event, pilih tiket |
| `/checkout/[bookingId]` | SSR | Checkout + countdown hold |
| `/bookings` | SSR | Riwayat booking (auth required) |
| `/bookings/[id]` | SSR | Detail booking + e-ticket |
| `/auth/login` | Static | Form login |
| `/auth/register` | Static | Form registrasi |
| `/auth/forgot-password` | Static | Form lupa password |
| `/auth/verify-email` | Static | Konfirmasi verifikasi email |
| `/payment/callback` | SSR | Redirect setelah bayar di gateway |

### 7.2 Halaman Admin

| Route | Deskripsi |
|-------|-----------|
| `/admin` | Dashboard ringkasan |
| `/admin/events` | CRUD event |
| `/admin/events/new` | Form buat event |
| `/admin/events/[id]/edit` | Edit event + ticket types |
| `/admin/bookings` | Tabel booking + filter |
| `/admin/reports` | Grafik penjualan |

### 7.3 Komponen Kunci

- `EventCard` — kartu event di listing
- `TicketSelector` — pilih tipe & jumlah tiket
- `HoldCountdown` — timer countdown hold (WebSocket/polling)
- `CheckoutForm` — ringkasan order + tombol bayar
- `ETicketViewer` — tampilkan QR + detail tiket
- `AdminEventForm` — form CRUD event
- `BookingTable` — tabel data booking (admin)

### 7.4 SEO & Metadata

Setiap halaman event (`/events/[slug]`) wajib memiliki:
- `<title>`, `<meta description>`, Open Graph tags (`og:image`, `og:title`)
- JSON-LD `Event` schema (nama, tanggal, lokasi, harga, availability)
- Canonical URL
- `sitemap.xml` auto-generate dari event published
- `robots.txt`

### 7.5 Pola Komunikasi Frontend ↔ Backend

```
Browser → Next.js (SSR/CSR)
              ↓
         Go API langsung (tidak via BFF route)
              ↓
         PostgreSQL / Redis
```

- **Auth token**: access token di memory (Zustand), refresh token di httpOnly cookie
- **SSR data fetch**: Next.js server component panggil Go API dengan service token atau forward cookie
- **Real-time availability**: polling setiap 5 detik di halaman event (bukan WebSocket di MVP)

---

## 8. Keamanan

| Area | Implementasi |
|------|-------------|
| Transport | HTTPS only, HSTS header |
| Auth | JWT access (15 min) + refresh (7 hari), httpOnly cookie untuk refresh |
| Password | bcrypt cost 12 |
| Rate Limiting | Redis: 100 req/min per IP (public), 30 req/min (auth endpoints) |
| CORS | Whitelist domain frontend saja |
| Input | Validasi di Go (validator) + Zod di frontend |
| SQL Injection | Prepared statements via sqlc/pgx |
| XSS | React auto-escape, sanitize rich text |
| CSRF | SameSite cookie + CSRF token untuk mutasi |
| Payment | Verifikasi webhook signature, jangan simpan data kartu |
| Secrets | `.env` lokal, Vault/Secrets Manager di production |
| Audit | Log setiap perubahan status booking & payment |
| Email verification | Wajib sebelum bisa booking (cegah akun fake) |
| Password reset | Token sekali pakai, expire 1 jam |
| Webhook IP whitelist | Hanya terima callback dari IP gateway resmi |
| File upload | Validasi MIME type + max 5MB untuk cover event |
| Brute force | Lock akun setelah 5 gagal login (15 menit) |

### 8.1 Keamanan Tiket & QR Code

```
ticket_code = HMAC-SHA256(booking_id + ticket_id + secret, TICKET_SIGNING_KEY)
QR payload  = base64(ticket_code + "." + signature)
```

- QR bersifat **statis** (tidak berubah), tapi validasi cek status di server
- Saat scan: cek `ticket.status = active` → update ke `used` (one-time scan)
- `TICKET_SIGNING_KEY` di-rotate per event season (Fase 3)
- Tidak expose data sensitif user di QR (hanya ticket_code)

---

## 9. Observability

| Aspek | Tool | Fase |
|-------|------|------|
| Logging | Zap → stdout (dev), Loki/ELK (prod) | F1 |
| Metrics | Prometheus + Grafana | F2 |
| Tracing | OpenTelemetry → Jaeger/Tempo | F2 |
| Error Tracking | Sentry | F1 |
| Uptime | Better Uptime / Pingdom | F2 |
| Alerting | Grafana Alerting / PagerDuty | F3 |

### 9.1 Metrik Kritis

- `booking_hold_total` — jumlah hold dibuat
- `booking_confirm_total` — jumlah booking dikonfirmasi
- `booking_expired_total` — jumlah hold expired
- `inventory_conflict_total` — race condition terdeteksi
- `payment_success_total` / `payment_failed_total`
- `api_request_duration_seconds` (histogram, per endpoint)
- `redis_hold_active_gauge` — hold aktif saat ini

### 9.2 Health Check Endpoints

| Endpoint | Tipe | Cek |
|----------|------|-----|
| `GET /healthz` | Liveness | Proses API hidup |
| `GET /readyz` | Readiness | PostgreSQL + Redis reachable |

---

## 10. Kebutuhan Non-Fungsional (NFR) & SLO

| Metrik | Target MVP | Target Production |
|--------|-----------|-------------------|
| Availability | 99.5% | 99.9% |
| API latency (p95) | < 500ms | < 300ms |
| Hold operation (p99) | < 200ms | < 100ms |
| Error rate | < 1% | < 0.1% |
| RPO (data loss) | 1 jam | 15 menit |
| RTO (recovery) | 4 jam | 1 jam |
| Concurrent users | 500 | 10.000+ |
| Double booking | **0** | **0** |

---

## 11. Aturan Bisnis & Kebijakan

### 11.1 Booking

| Aturan | Nilai |
|--------|-------|
| Durasi hold | 10 menit (konfigurabel) |
| Maks tiket per order | 4 (per ticket type) |
| Maks hold aktif per user | 3 total, 1 per event |
| Grace period payment | 5 menit setelah hold expire |
| Pembatalan oleh user | Hanya saat status `held` atau `pending_payment` |

### 11.2 Pembayaran

| Aturan | Nilai |
|--------|-------|
| Metode (MVP) | QRIS, Virtual Account, Credit Card (via Midtrans) |
| Timeout payment | Sama dengan sisa waktu hold |
| Biaya platform | 5% dari total (konfigurabel per event) |
| PPN | 11% (jika applicable, toggle per organizer) |

### 11.3 Refund (Fase 2)

| Kondisi | Kebijakan |
|---------|-----------|
| Event dibatalkan organizer | Refund 100% otomatis |
| User cancel sebelum event | Refund 50% (jika > 48 jam sebelum event) |
| User cancel < 48 jam | Tidak ada refund |
| Payment gagal | Tidak ada charge, hold dilepas |

### 11.4 Event Dibatalkan

```
Organizer cancel event
  → Semua booking confirmed → status cancelled
  → Worker trigger refund otomatis
  → Email notifikasi ke semua pembeli
  → Event status = cancelled, tidak tampil di listing
```

---

## 12. Strategi Testing

### 12.1 Piramida Testing

```
         ┌─────────┐
         │  E2E    │  Playwright — alur booking lengkap (Fase 2)
         ├─────────┤
         │ Integr. │  testcontainers (PG + Redis) — hold, confirm, expire
         ├─────────┤
         │  Unit   │  Domain logic, validation, state machine
         └─────────┘
```

### 12.2 Test Kritis (Wajib Ada)

| Skenario | Tipe | Prioritas |
|----------|------|-----------|
| Hold tiket → kuota berkurang | Integration | P0 |
| 100 concurrent hold, kuota 50 → tepat 50 sukses | Integration | P0 |
| Hold expire → kuota kembali | Integration | P0 |
| Double confirm dengan idempotency key sama | Integration | P0 |
| Payment webhook duplikat → tidak double confirm | Integration | P0 |
| State transition invalid → ditolak | Unit | P0 |
| QR ticket → scan pertama OK, scan kedua ditolak | Integration | P1 |

### 12.3 Load Test (Fase 3)

```javascript
// k6 scenario: flash sale
// 10.000 VU, ramp 0→10K dalam 30 detik
// Target: hold p99 < 200ms, 0 oversell
```

---

## 13. CI/CD & Deployment

### 13.1 Pipeline (GitHub Actions)

```
Push / PR
  → Lint (golangci-lint, eslint)
  → Unit test
  → Integration test (testcontainers)
  → Build Docker image
  → [main only] Deploy to staging
  → [tag v*] Deploy to production (manual approval)
```

### 13.2 Environment

| Env | Branch | Infrastruktur | Database |
|-----|--------|--------------|----------|
| Local | — | docker-compose | PostgreSQL lokal |
| Staging | `main` | 1 VPS / cloud VM | Managed PG (small) |
| Production | tag `v*` | K8s / managed | Managed PG + replica |

### 13.3 Deployment Strategy

- **Staging**: rolling deploy
- **Production**: blue-green deploy (zero downtime)
- **Database migration**: backward-compatible, jalankan sebelum deploy app baru
- **Rollback**: keep 1 versi image sebelumnya, switch traffic jika error rate > 1%

### 13.4 Graceful Shutdown (Go API)

```
SIGTERM diterima
  → Stop terima request baru
  → Tunggu in-flight request selesai (timeout 30 detik)
  → Tutup koneksi DB & Redis pool
  → Exit
```

---

## 14. Compliance, Legal & Privasi

| Area | Implementasi |
|------|-------------|
| **UU PDP (Indonesia)** | Consent checkbox saat registrasi, kebijakan privasi |
| **Penyimpanan data** | Hapus data user upon request (GDPR-like) |
| **Retensi booking** | Simpan 3 tahun (kebutuhan akuntansi) |
| **Retensi log** | 90 hari |
| **PCI-DSS** | Tidak simpan data kartu — delegasi ke payment gateway |
| **Syarat & Ketentuan** | Halaman `/terms` dan `/privacy` |
| **Invoice** | Generate invoice PDF saat payment confirmed (Fase 2) |
| **E-ticket disclaimer** | Syarat penggunaan tiket, kebijakan refund |

---

## 15. Strategi Caching

| Data | Cache | TTL | Invalidasi |
|------|-------|-----|-----------|
| Event listing | Redis | 60 detik | Saat event created/updated |
| Event detail | Redis | 30 detik | Saat event updated |
| Availability | Redis (real-time) | Tidak di-cache (langsung dari counter) | — |
| User session | Redis | Sama dengan JWT TTL | Saat logout |
| API response (CDN) | Cloudflare | 60 detik (ISR) | Revalidate on-demand |

**Prinsip**: Jangan cache data yang bersifat authoritative (booking status, payment). Cache hanya untuk read-heavy, eventually consistent.

---

## 16. Multi-Tenancy Organizer (Fase 2)

```
organizers
  ├── id, name, email, commission_rate
  └── events (organizer_id FK)

Isolasi data:
  - Organizer hanya lihat event & booking miliknya
  - Admin platform lihat semua
  - API: middleware cek organizer_id dari JWT claims
```

---

## 17. Roadmap Implementasi

### Fase 1 — MVP (Minggu 1–8)

**Tujuan:** Platform fungsional end-to-end untuk booking event berbasis kuota.

#### Minggu 1–2: Fondasi
- [ ] Inisialisasi repo (backend Go + frontend Next.js)
- [ ] `docker-compose.yml` (PostgreSQL + Redis)
- [ ] Skema database + migration awal
- [ ] Setup sqlc + generate query
- [ ] Health check endpoint
- [ ] CI pipeline dasar (lint, test, build)

#### Minggu 3–4: Auth & Catalog
- [ ] Register, login, JWT auth (backend)
- [ ] Email verification flow
- [ ] Forgot / reset password
- [ ] Halaman login/register (frontend)
- [ ] CRUD event + venue (admin API)
- [ ] List, detail, search event (public API + frontend)
- [ ] Seed script data sample

#### Minggu 5–6: Booking Flow
- [ ] Hold mechanism (Redis + DB + `held_count`)
- [ ] Hold expiry background job (cron)
- [ ] Batasan hold per user (1/event, 3 total)
- [ ] Checkout page + countdown timer
- [ ] Booking history page
- [ ] Idempotency key middleware
- [ ] Integration test: concurrent hold

#### Minggu 7–8: Payment & Ticket
- [ ] Integrasi payment gateway (sandbox)
- [ ] Webhook handler + idempotency + confirm booking
- [ ] Grace period payment setelah hold expire
- [ ] Generate signed ticket code + QR + e-ticket page
- [ ] Email notifikasi (konfirmasi booking)
- [ ] Admin dashboard dasar
- [ ] Halaman `/terms` dan `/privacy`
- [ ] Integration test: full booking flow

**Deliverable Fase 1:** User bisa browse event → hold tiket → bayar → terima e-ticket.

---

### Fase 2 — Scale Ready (Minggu 9–16)

**Tujuan:** Siap menangani traffic menengah, observability lengkap.

- [ ] Message queue (NATS/RabbitMQ) untuk async processing
- [ ] Worker: payment reconcile, email, ticket generation
- [ ] Seat map interaktif (SVG-based)
- [ ] Object storage (MinIO/S3) untuk QR & PDF
- [ ] PgBouncer connection pooling
- [ ] Rate limiting middleware (Redis)
- [ ] OpenTelemetry tracing
- [ ] Prometheus metrics + Grafana dashboard
- [ ] Sentry error tracking
- [ ] Cloudflare Turnstile (anti-bot)
- [ ] Promo code / voucher system
- [ ] Refund flow dasar

**Deliverable Fase 2:** Platform stabil dengan monitoring, seat map, dan async processing.

---

### Fase 3 — High Traffic (Minggu 17–24)

**Tujuan:** Siap untuk flash sale / event besar (10K+ concurrent users).

- [ ] Virtual waiting room (queue system)
- [ ] PostgreSQL read replicas
- [ ] CDN untuk static assets & ISR pages
- [ ] Redis cluster (bukan single instance)
- [ ] Database partitioning (bookings, tickets by month)
- [ ] Load testing dengan k6 (target: 10K concurrent, zero double booking)
- [ ] Kubernetes deployment
- [ ] Auto-scaling policy
- [ ] Ticket scanner app (validasi QR di pintu masuk)
- [ ] Multi-language (i18n)
- [ ] Runbook operasional (incident response)

**Deliverable Fase 3:** Platform production-grade siap event besar.

---

## 18. Environment Variables

```env
# ── App ──
APP_ENV=development          # development | staging | production
APP_PORT=8080
APP_URL=http://localhost:8080

# ── Database ──
DATABASE_URL=postgres://booking:secret@localhost:5432/booking?sslmode=disable
DATABASE_MAX_OPEN_CONNS=25
DATABASE_MAX_IDLE_CONNS=5

# ── Redis ──
REDIS_URL=redis://localhost:6379/0

# ── JWT ──
JWT_SECRET=change-me-in-production
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=168h

# ── Booking ──
BOOKING_HOLD_TTL=10m
BOOKING_MAX_TICKETS_PER_ORDER=4
BOOKING_MAX_ACTIVE_HOLDS=3
BOOKING_PAYMENT_GRACE_PERIOD=5m

# ── Ticket ──
TICKET_SIGNING_KEY=change-me-in-production

# ── Payment ──
PAYMENT_GATEWAY=midtrans       # midtrans | xendit
MIDTRANS_SERVER_KEY=
MIDTRANS_CLIENT_KEY=
MIDTRANS_IS_PRODUCTION=false

# ── Email ──
EMAIL_PROVIDER=resend          # resend | ses
RESEND_API_KEY=
EMAIL_FROM=noreply@booking.app

# ── Frontend ──
NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ── Observability ──
SENTRY_DSN=
OTEL_EXPORTER_OTLP_ENDPOINT=
```

---

## 19. Keputusan Arsitektur (ADR)

### ADR-001: Modular Monolith vs Microservices

**Keputusan:** Mulai dengan modular monolith (satu binary Go, package terpisah per domain).

**Alasan:**
- Tim kecil, iterasi cepat di MVP
- Transaksi booking butuh consistency — lebih mudah dalam satu DB transaction
- Pecah ke microservices hanya saat ada bottleneck terukur di domain spesifik

### ADR-002: sqlc vs GORM

**Keputusan:** sqlc untuk generate type-safe Go code dari SQL mentah.

**Alasan:**
- Query kompleks (inventory update dengan optimistic lock) lebih eksplisit
- Tidak ada magic ORM yang menyembunyikan N+1 query
- Performa lebih baik (tidak ada reflection overhead)

### ADR-003: Redis untuk Hold, PostgreSQL untuk Truth

**Keputusan:** Hold sementara di Redis (cepat), konfirmasi final di PostgreSQL (persisten).

**Alasan:**
- Hold adalah operasi high-frequency, low-durability → cocok di Redis
- Booking confirmed harus ACID → harus di PostgreSQL
- Jika Redis down, fallback ke DB-only (lebih lambat tapi tetap correct)

### ADR-004: ISR untuk Halaman Event

**Keputusan:** Gunakan Next.js ISR (Incremental Static Regeneration) untuk halaman event.

**Alasan:**
- Halaman event relatif statis, traffic read-heavy
- ISR mengurangi beban API saat traffic spike
- Revalidate setiap 60 detik untuk data yang agak fresh

### ADR-005: Wajib Login (Tanpa Guest Checkout)

**Keputusan:** User harus login sebelum bisa hold tiket.

**Alasan:**
- Mempermudah riwayat booking, refund, dan notifikasi
- Mengurangi bot / scalper yang gonta-ganti identitas
- Trade-off: sedikit friction di checkout, acceptable untuk ticketing

### ADR-006: held_count Terpisah dari sold_count

**Keputusan:** Tambah kolom `held_count` di `ticket_types`, terpisah dari `sold_count`.

**Alasan:**
- `available = total_quota - sold_count - held_count` selalu akurat
- Hold expire/cancel hanya perlu decrement `held_count`, bukan rollback `sold_count`
- Memudahkan audit dan rekonsiliasi inventory

### ADR-007: Direct API Call (Tanpa BFF)

**Keputusan:** Frontend memanggil Go API langsung, bukan melalui Next.js API routes.

**Alasan:**
- Mengurangi hop latency (penting saat flash sale)
- Go API sudah jadi single backend — BFF menambah kompleksitas tanpa manfaat di MVP
- SSR tetap bisa fetch langsung dari server component

### ADR-008: Polling untuk Availability (Bukan WebSocket di MVP)

**Keputusan:** Gunakan polling 5 detik untuk update kuota di halaman event.

**Alasan:**
- Lebih sederhana, tidak butuh infra WebSocket
- Cukup untuk MVP; upgrade ke SSE/WebSocket di Fase 2 jika perlu

---

## 20. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|--------|--------|----------|
| Double booking saat flash sale | Oversell tiket, reputasi rusak | Redis lock + `held_count` + optimistic lock + load test |
| Payment webhook gagal diterima | Booking stuck di pending | Reconciliation worker + manual retry dashboard |
| Payment sukses setelah hold expire | User bayar tapi tiket hangus | Grace period 5 menit + auto-refund jika invalid |
| Redis down saat peak | Hold gagal | Fallback ke DB-only hold + circuit breaker |
| Redis-DB inventory drift | Kuota tidak akurat | Background reconciler setiap 30 detik (DB menang) |
| Database connection exhausted | API timeout | PgBouncer + connection limit per service |
| DDoS / bot scraping | Server overload | Cloudflare WAF + rate limiting + Turnstile |
| Ticket hoarding (scalper) | User tidak bisa beli | Maks 1 hold/event, 3 hold total per user |
| Data breach | Legal & reputasi | Enkripsi at-rest, audit log, PCI compliance via gateway |
| Event cancel saat ribuan booking | Chaos operasional | Runbook refund massal + worker otomatis (Fase 2) |

---

## 21. Checklist Sebelum Mulai Coding

- [x] Dokumen rancangan (`plan.md`)
- [ ] Definisikan nama domain & brand platform
- [ ] Daftar akun payment gateway (sandbox)
- [ ] Daftar akun email provider
- [ ] Setup repositori Git (GitHub/GitLab)
- [ ] Inisialisasi project backend (Go modules)
- [ ] Inisialisasi project frontend (Next.js)
- [ ] `docker-compose.yml` untuk development
- [ ] `.env.example` dengan semua variabel
- [ ] Migration database pertama
- [ ] CI pipeline (lint + test + build)
- [ ] README dengan instruksi setup lokal
- [ ] Tulis OpenAPI spec awal di `docs/api/`
- [ ] Siapkan template email (konfirmasi, e-ticket, reset password)
- [ ] Definisikan halaman `/terms` dan `/privacy`

---

## 22. Referensi

- [PostgreSQL Locking](https://www.postgresql.org/docs/current/explicit-locking.html)
- [Redis Distributed Locks](https://redis.io/docs/manual/patterns/distributed-locks/)
- [sqlc Documentation](https://docs.sqlc.dev/)
- [Next.js Data Fetching](https://nextjs.org/docs/app/building-your-application/data-fetching)
- [Midtrans API Docs](https://docs.midtrans.com/)
- [k6 Load Testing](https://k6.io/docs/)
- [OpenTelemetry Go](https://opentelemetry.io/docs/languages/go/)

---

*Dokumen ini akan diperbarui seiring perkembangan proyek. Setiap perubahan arsitektur signifikan harus dicatat di `docs/adr/`.*
