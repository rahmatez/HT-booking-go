# Roadmap Production — Eventra

> Dokumen ini melanjutkan [plan.md](./plan.md) (arsitektur & MVP Fase 1).  
> Fokus: apa yang dibutuhkan agar platform setara aplikasi tiket dunia nyata (contoh: **Loket.com**, **Tiket.com**) dan siap deploy production.

## Daftar Isi

1. [Posisi Saat Ini](#1-posisi-saat-ini)
2. [Gap vs Platform Tiket Besar](#2-gap-vs-platform-tiket-besar)
3. [Struktur Menu Admin Panel](#3-struktur-menu-admin-panel)
4. [Fase A — Deploy Aman](#4-fase-a--deploy-aman)
5. [Fase B — Produk Tiket Sungguhan](#5-fase-b--produk-tiket-sungguhan)
6. [Fase C — Event Besar & Flash Sale](#6-fase-c--event-besar--flash-sale)
7. [Arsitektur Target (High Traffic)](#7-arsitektur-target-high-traffic)
8. [Checklist Deploy Production](#8-checklist-deploy-production)
9. [Prioritas & Estimasi](#9-prioritas--estimasi)

---

## 1. Posisi Saat Ini

### Sudah ada (MVP fungsional)

| Area | Status | Catatan |
|------|--------|---------|
| Auth JWT + refresh + logout | ✅ | Frontend auto-refresh token |
| Event catalog + availability | ✅ | Redis cache |
| Hold booking + distributed lock | ✅ | Integration test race condition |
| Rate limiting | ✅ | Login, hold, checkout |
| Midtrans Snap + webhook + sync | ✅ | Sandbox; sync untuk dev lokal |
| E-ticket + QR code | ✅ | Halaman `/bookings/[id]` |
| Batalkan booking | ✅ | Status `held` / `pending_payment` |
| Admin panel | ✅ | Event, venue, booking, dashboard |
| Hold expiry worker | ✅ | Background job 30s |
| Terms & privacy | ✅ | Halaman dasar |

### Belum ada / belum production-ready

| Area | Status |
|------|--------|
| Email konfirmasi & PDF e-ticket | ❌ Config `EMAIL_*` ada, belum di-wire |
| Verifikasi email | ❌ Kolom DB ada, flow belum |
| Lupa / reset password | ❌ |
| Refund | ❌ Status `refunded` di DB, flow belum |
| Promo / voucher | ❌ |
| Scanner check-in di venue | ❌ |
| Waiting room (antrean virtual) | ❌ |
| Seat map | ❌ |
| Multi-organizer + settlement | ❌ Partial (`organizer` role) |
| Laporan penjualan & export | ❌ |
| Observability production | ❌ |
| CI/CD + staging | ❌ |

---

## 2. Gap vs Platform Tiket Besar

Perbandingan singkat dengan pola **Loket.com** / **Tiket.com**:

### Pembelian & inventory

| Fitur | Eventra | Loket / Tiket.com |
|-------|------------|-------------------|
| Kuota per tipe tiket | ✅ | ✅ |
| Seat map / pilih kursi | ❌ | ✅ (konser besar) |
| Early bird / tiered pricing | ❌ | ✅ |
| Kode promo / voucher | ❌ | ✅ |
| Batas tiket per user / event | Partial | ✅ Ketat |
| Waiting room sebelum on-sale | ❌ | ✅ |
| Notify me / wishlist | ❌ | ✅ |

### Tiket & venue

| Fitur | Eventra | Loket / Tiket.com |
|-------|------------|-------------------|
| QR e-ticket di web | ✅ | ✅ |
| PDF downloadable | ❌ | ✅ |
| Email otomatis setelah bayar | ❌ | ✅ |
| Scanner check-in (gate staff) | ❌ | ✅ |
| Transfer / resale tiket | ❌ | ✅ (tergantung event) |
| Multi-gate / multi-day pass | ❌ | ✅ |

### Organizer & marketplace

| Fitur | Eventra | Loket / Tiket.com |
|-------|------------|-------------------|
| Admin panel dasar | ✅ | ✅ |
| Self-service buat event + moderasi | ❌ | ✅ |
| Laporan & export penjualan | ❌ | ✅ |
| Settlement / payout ke organizer | ❌ | ✅ |
| Homepage kurasi (kategori, kota, trending) | Minimal | ✅ |

### Keamanan & kepatuhan

| Fitur | Eventra | Loket / Tiket.com |
|-------|------------|-------------------|
| CAPTCHA / anti-bot | ❌ | ✅ |
| Verifikasi email | ❌ | ✅ |
| Kebijakan refund tertulis | Partial | ✅ |
| Kepatuhan UU PDP | Partial | ✅ |

---

## 3. Struktur Menu Admin Panel

Rancangan navigasi admin mengikuti pola **Loket.com** / **Tiket.com**: organizer fokus ke event & penjualan, admin platform mengelola seluruh ekosistem.

### 3.1 Menu yang sudah ada (MVP)

| Menu | Route | Fungsi |
|------|-------|--------|
| Dashboard | `/admin` | Ringkasan statistik & booking terbaru |
| Event | `/admin/events` | CRUD event, filter status, pencarian |
| Booking | `/admin/bookings` | Daftar transaksi, filter status, detail |
| Venue | `/admin/venues` | Tambah & daftar lokasi event |

Sub-halaman existing:

| Route | Fungsi |
|-------|--------|
| `/admin/events/new` | Form buat event |
| `/admin/events/[id]/edit` | Edit event + tipe tiket |
| `/admin/bookings/[id]` | Detail booking (pembeli, item, status) |

### 3.2 Menu yang direkomendasikan (target lengkap)

Sidebar dikelompokkan per **section** agar tidak ramai saat fitur bertambah.

#### Utama

| Menu | Route | Deskripsi | Role | Fase |
|------|-------|-----------|------|------|
| Dashboard | `/admin` | KPI: revenue, tiket terjual, conversion, grafik trend | Admin, Organizer | ✅ MVP |
| Notifikasi | `/admin/notifications` | In-app alert: pembayaran gagal, event hampir sold out | Admin, Organizer | B |

#### Katalog & konten

| Menu | Route | Deskripsi | Role | Fase |
|------|-------|-----------|------|------|
| Event | `/admin/events` | Kelola event, status publish, duplikasi event | Admin, Organizer | ✅ MVP |
| Venue | `/admin/venues` | Master data lokasi | Admin, Organizer | ✅ MVP |
| Kategori | `/admin/categories` | Kategori event (Musik, Olahraga, Workshop, dll.) | Admin | B |
| Banner & kurasi | `/admin/banners` | Hero homepage, event pilihan, urutan tampil | Admin | B |
| Seat map | `/admin/events/[id]/seats` | Editor denah kursi per event | Admin, Organizer | C |

#### Transaksi & pembayaran

| Menu | Route | Deskripsi | Role | Fase |
|------|-------|-----------|------|------|
| Booking | `/admin/bookings` | Semua pemesanan, filter event/status/tanggal | Admin, Organizer | ✅ MVP |
| Pembayaran | `/admin/payments` | Daftar transaksi gateway, status Midtrans, retry sync | Admin, Organizer | A |
| Refund | `/admin/refunds` | Ajukan & pantau refund, riwayat status | Admin, Organizer | B |
| Promo & voucher | `/admin/promos` | Kode diskon, kuota, periode, per event | Admin, Organizer | B |

#### Operasional venue (hari-H)

| Menu | Route | Deskripsi | Role | Fase |
|------|-------|-----------|------|------|
| Check-in / Scanner | `/admin/check-in` | Scan QR tiket, validasi masuk, cegah double scan | Admin, Organizer, Gate Staff | B |
| Laporan check-in | `/admin/check-in/reports` | Rekap kehadiran per event / gate / sesi | Admin, Organizer | B |
| Daftar tamu | `/admin/events/[id]/attendees` | Export nama pemegang tiket confirmed | Admin, Organizer | B |

#### Laporan & analitik

| Menu | Route | Deskripsi | Role | Fase |
|------|-------|-----------|------|------|
| Laporan penjualan | `/admin/reports/sales` | Revenue per event, per tipe tiket, per periode | Admin, Organizer | B |
| Laporan konversi | `/admin/reports/funnel` | View → hold → bayar → confirmed | Admin | B |
| Export data | `/admin/reports/exports` | Unduh CSV/Excel booking & penjualan | Admin, Organizer | B |

#### Pengguna & multi-organizer

| Menu | Route | Deskripsi | Role | Fase |
|------|-------|-----------|------|------|
| Pengguna | `/admin/users` | Daftar user, blokir, reset password | Admin | A |
| Organizer | `/admin/organizers` | Onboard penyelenggara, approve/reject | Admin | B |
| Moderasi event | `/admin/moderation` | Antrian event draft menunggu publish | Admin | B |
| Gate staff | `/admin/staff` | Akun scanner terbatas per event | Admin, Organizer | B |

#### Keuangan platform

| Menu | Route | Deskripsi | Role | Fase |
|------|-------|-----------|------|------|
| Settlement | `/admin/settlements` | Rekonsiliasi & payout ke organizer per periode | Admin | C |
| Fee & komisi | `/admin/settings/fees` | Persentase fee platform per kategori/event | Admin | C |
| Rekening payout | `/admin/organizers/[id]/bank` | Data rekening organizer | Admin, Organizer | C |

#### Sistem & keamanan

| Menu | Route | Deskripsi | Role | Fase |
|------|-------|-----------|------|------|
| Pengaturan | `/admin/settings` | Branding, hold TTL, batas tiket, maintenance mode | Admin | A |
| Template email | `/admin/settings/emails` | Preview & edit template notifikasi | Admin | A |
| Integrasi | `/admin/settings/integrations` | Midtrans keys, webhook status, email provider | Admin | A |
| Audit log | `/admin/audit` | Jejak aksi admin (ubah event, refund, dll.) | Admin | A |
| Waiting room | `/admin/settings/queue` | Konfigurasi antrean virtual per event on-sale | Admin | C |

### 3.3 Matriks role

| Role | Akses utama |
|------|-------------|
| **Admin platform** | Semua menu; moderasi, user, settlement, pengaturan global |
| **Organizer** | Event, venue, booking & laporan **milik sendiri**; check-in event sendiri; promo sendiri |
| **Gate staff** | Hanya check-in / scanner untuk event yang ditugaskan (tanpa akses finansial) |

Organizer **tidak** melihat: user global, settlement platform, fee global, moderasi organizer lain.

### 3.4 Layout sidebar (wireframe)

```
┌─────────────────────────┐
│  Eventra · Admin     │
├─────────────────────────┤
│  UTAMA                  │
│    ◫ Dashboard          │
│    🔔 Notifikasi    [B] │
├─────────────────────────┤
│  KATALOG                │
│    ◎ Event          [✅]│
│    ⌂ Venue          [✅]│
│    ▤ Kategori       [B] │
│    🖼 Banner          [B] │
├─────────────────────────┤
│  TRANSAKSI              │
│    ☰ Booking        [✅]│
│    💳 Pembayaran    [A] │
│    ↩ Refund         [B] │
│    🏷 Promo          [B] │
├─────────────────────────┤
│  VENUE (hari-H)         │
│    📷 Check-in        [B] │
│    📋 Tamu hadir      [B] │
├─────────────────────────┤
│  LAPORAN                │
│    📊 Penjualan       [B] │
│    📥 Export          [B] │
├─────────────────────────┤
│  PLATFORM (admin saja)  │
│    👤 Pengguna        [A] │
│    🏢 Organizer       [B] │
│    ✓ Moderasi         [B] │
│    💰 Settlement      [C] │
├─────────────────────────┤
│  SISTEM                 │
│    ⚙ Pengaturan       [A] │
│    📜 Audit log       [A] │
├─────────────────────────┤
│  ← Kembali ke situs     │
└─────────────────────────┘

[✅] = sudah ada   [A/B/C] = fase implementasi
```

### 3.5 Prioritas penambahan menu (urutan dev)

| Urutan | Menu | Alasan |
|--------|------|--------|
| 1 | Pembayaran | Operasional harian; lacak transaksi & webhook |
| 2 | Pengaturan + Template email | Go-live butuh konfigurasi production |
| 3 | Pengguna + Audit log | Keamanan & support pelanggan |
| 4 | Check-in / Scanner | Wajib untuk event fisik (inti produk tiket) |
| 5 | Laporan penjualan + Export | Organizer butuh data penjualan |
| 6 | Promo & Refund | Monetisasi & kebijakan bisnis |
| 7 | Kategori + Banner | Discovery homepage seperti Loket/Tiket |
| 8 | Organizer + Moderasi | Multi-tenant marketplace |
| 9 | Settlement + Waiting room | Scale & marketplace matang |

### 3.6 Checklist implementasi menu

- [ ] Sidebar section grouping (Utama, Katalog, Transaksi, …)
- [ ] Role-based menu visibility (admin vs organizer vs gate staff)
- [ ] Breadcrumb konsisten di setiap halaman
- [ ] Menu aktif + mobile drawer (sudah ada di MVP)
- [ ] Halaman `/admin/payments` (Fase A)
- [ ] Halaman `/admin/users` + `/admin/settings` (Fase A)
- [ ] Halaman `/admin/check-in` (Fase B)
- [ ] Halaman `/admin/reports/*` (Fase B)
- [ ] Halaman `/admin/promos` + `/admin/refunds` (Fase B)
- [ ] Halaman `/admin/organizers` + `/admin/moderation` (Fase B)
- [ ] Halaman `/admin/settlements` + `/admin/settings/queue` (Fase C)

---

## 4. Fase A — Deploy Aman

**Tujuan:** Bisa dibuka ke pengguna nyata dengan risiko operasional terkendali.  
**Estimasi:** 2–4 minggu.

### A.1 Notifikasi & komunikasi

- [ ] Integrasi email provider (Resend / SendGrid / SES)
- [ ] Template email: konfirmasi pembayaran
- [ ] Template email: e-ticket (link + lampiran PDF)
- [ ] Template email: reminder hold akan kedaluwarsa
- [ ] Template email: pembatalan booking
- [ ] Worker async untuk kirim email (jangan blocking HTTP request)
- [ ] (Opsional) SMS / WhatsApp untuk OTP atau reminder

### A.2 Keamanan akun

- [ ] Flow verifikasi email (kirim link → konfirmasi → set `email_verified_at`)
- [ ] Lupa password (request token → reset via email)
- [ ] CAPTCHA di login, register, dan checkout (Cloudflare Turnstile)
- [ ] Audit log aksi admin (siapa ubah event, refund, dll.)
- [ ] Review rate limit & lockout setelah N percobaan login gagal

### A.3 Pembayaran production-grade

- [ ] Webhook Midtrans di URL publik HTTPS
- [ ] Idempotency kuat pada webhook (cegah double-confirm)
- [ ] Payment reconcile worker terjadwal (backup jika webhook gagal)
- [ ] Matikan `POST /payments/simulate` di `APP_ENV=production` (sudah ada — verifikasi)
- [ ] Dokumentasi kartu uji vs production keys
- [ ] Flow refund dasar (admin trigger → update booking + payment status)
- [ ] Dukungan metode bayar tambahan via Midtrans (VA, QRIS, e-wallet) — uji end-to-end

### A.4 Operasional & observability

- [ ] Structured logging (request ID, user ID, booking ID)
- [ ] Error tracking (Sentry atau sejenisnya)
- [ ] Metrics: request rate, latency, error rate, hold success/fail
- [ ] Health check mendalam: PostgreSQL, Redis, koneksi Midtrans
- [ ] Alerting (Slack/email) untuk error rate & payment failure spike
- [ ] Backup PostgreSQL otomatis + uji restore
- [ ] Environment staging terpisah dari production

### A.5 Legal & kepercayaan

- [ ] Review & finalisasi halaman Terms of Service
- [ ] Review & finalisasi halaman Privacy Policy (UU PDP)
- [ ] Kebijakan refund & pembatalan event (publik)
- [ ] Consent checkbox saat registrasi
- [ ] Kontak support yang jelas di footer

### Deliverable Fase A

Platform bisa menerima pembayaran nyata, mengirim e-ticket, dan dioperasikan dengan monitoring dasar.

---

## 5. Fase B — Produk Tiket Sungguhan

**Tujuan:** Pengalaman setara marketplace tiket menengah — operasi venue & organizer lebih lengkap.  
**Estimasi:** 4–8 minggu.

### B.1 Tiket & check-in

- [ ] Generate PDF e-ticket (logo event, QR, kode, syarat masuk)
- [ ] Download PDF dari halaman booking
- [ ] **Scanner check-in** — PWA atau halaman admin khusus gate staff
- [ ] API validasi tiket: scan QR → cek status → tandai `checked_in_at`
- [ ] Cegah double scan (tiket sudah dipakai)
- [ ] Dashboard check-in real-time per event (berapa sudah masuk)

### B.2 Promo & pricing

- [ ] Model `promo_codes` (persen / nominal, kuota, per event / global)
- [ ] Validasi promo saat checkout
- [ ] Early bird / multiple ticket tiers per event
- [ ] Batas pembelian per user per event (enforce di backend)

### B.3 Refund & pembatalan

- [ ] Refund penuh / sebagian via Midtrans
- [ ] Kebijakan refund otomatis berdasarkan status & waktu
- [ ] Admin: batalkan event → trigger refund massal atau notifikasi
- [ ] Riwayat status pembayaran di detail booking

### B.4 Admin & laporan

- [ ] Laporan penjualan per event (revenue, tiket terjual, conversion)
- [ ] Export CSV / Excel booking & penjualan
- [ ] Grafik dashboard (trend harian)
- [ ] Filter booking per event di admin
- [ ] Moderasi event (approve / reject draft organizer)

### B.5 UX publik

- [ ] Homepage kurasi: event trending, kategori, kota
- [ ] Pencarian & filter advanced (tanggal, kota, kategori, harga)
- [ ] Halaman kategori event
- [ ] SEO: meta tag per event, sitemap, Open Graph
- [ ] PWA (installable, offline minimal untuk e-ticket)
- [ ] (Opsional) Social login Google / Apple

### B.6 Multi-organizer (dasar)

- [ ] Organizer hanya lihat event & booking miliknya
- [ ] Admin platform approve event sebelum publish
- [ ] Pemisahan data per `organizer_id`

### Deliverable Fase B

Organizer bisa mengoperasikan event sendiri; gate staff bisa scan tiket; admin punya laporan penjualan.

---

## 6. Fase C — Event Besar & Flash Sale

**Tujuan:** Tahan traffic on-sale tinggi (ribuan–puluh ribu concurrent) tanpa double booking.  
**Estimasi:** 8–12 minggu.

### C.1 Virtual waiting room

- [ ] Antrean sebelum masuk halaman event on-sale
- [ ] Token queue dengan TTL — user dapat slot checkout
- [ ] Halaman status antrean (posisi, estimasi waktu)
- [ ] Integrasi dengan rate limit & hold lock existing

### C.2 Infrastruktur scale

- [ ] Message queue (NATS / RabbitMQ) untuk email, PDF, webhook, ticket gen
- [ ] Worker terpisah dari API process
- [ ] PgBouncer connection pooling
- [ ] PostgreSQL read replica untuk catalog & list event
- [ ] Redis Sentinel atau cluster (bukan single instance)
- [ ] CDN untuk static assets & ISR halaman event
- [ ] Horizontal scaling API (stateless, multiple instances)

### C.3 Seat map (opsional — jika target konser)

- [ ] Model seat / section / row
- [ ] Seat map interaktif (SVG/Canvas)
- [ ] Lock seat individual saat hold
- [ ] Konflik resolution seat vs kuota

### C.4 Load & chaos testing

- [ ] Load test k6: target 5K–10K concurrent users
- [ ] Skenario: 1 kuota tersisa, N user hold bersamaan → tepat 1 sukses
- [ ] Chaos test: Redis down, DB lambat, webhook delay
- [ ] Runbook insiden (playbook double booking, payment stuck)

### C.5 Marketplace lanjutan

- [ ] Settlement / payout ke organizer (rekonsiliasi periode)
- [ ] Fee platform (komisi per tiket)
- [ ] Multi-bahasa (ID / EN)
- [ ] (Opsional) Transfer tiket antar user
- [ ] (Opsional) Resale marketplace

### Deliverable Fase C

Platform siap event populer dengan waiting room, async processing, dan infrastruktur yang bisa diskalakan.

---

## 7. Arsitektur Target (High Traffic)

Alur target saat traffic tinggi:

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Waiting Room   │ ──► │  Hold + Redis    │ ──► │    Payment      │
│  (queue token)  │     │  Lock + DB txn   │     │  Midtrans Snap  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                        │                         │
         ▼                        ▼                         ▼
    CDN + ISR              Message Queue            Webhook Worker
    Read Replica           (email, PDF,             Payment Reconcile
                           ticket gen)              Email Worker
```

### Komponen yang perlu ditambahkan

| Komponen | Fungsi | Fase |
|----------|--------|------|
| Email worker | Kirim konfirmasi & e-ticket async | A |
| Payment reconcile worker | Poll / retry webhook gagal | A |
| PDF generator | E-ticket attachment | B |
| Scanner API + PWA | Check-in di venue | B |
| Message queue | Decouple proses berat dari API | C |
| Waiting room service | Antrean sebelum on-sale | C |
| PgBouncer | Pool koneksi DB | C |
| Read replica | Offload query baca | C |

---

## 8. Checklist Deploy Production

Gunakan checklist ini sebelum go-live (Fase A minimum).

### Infrastruktur

- [ ] Domain + SSL (HTTPS wajib)
- [ ] `APP_ENV=production` di backend
- [ ] `MIDTRANS_IS_PRODUCTION=true` + production keys
- [ ] Webhook URL terdaftar di Midtrans Dashboard
- [ ] PostgreSQL managed (bukan Docker lokal)
- [ ] Redis managed dengan persistence
- [ ] Secret di vault / env manager (bukan commit `.env`)
- [ ] Backup DB terjadwal + uji restore

### Aplikasi

- [ ] `NEXT_PUBLIC_API_URL` mengarah ke API production
- [ ] CORS dikonfigurasi untuk domain production saja
- [ ] Simulate payment disabled di production
- [ ] JWT secret kuat & unik per environment
- [ ] Email `FROM` domain terverifikasi (SPF, DKIM)

### Midtrans

- [ ] Server Key & Client Key production
- [ ] Webhook: `POST https://{domain}/api/v1/payments/webhook/midtrans`
- [ ] Uji bayar real amount kecil → konfirmasi booking → e-ticket
- [ ] Uji skenario gagal bayar / expire

### Monitoring

- [ ] Health endpoint dimonitor uptime
- [ ] Alert jika error rate > threshold
- [ ] Log terpusat (bisa query by booking ID)

### Legal

- [ ] Terms & Privacy final
- [ ] Kebijakan refund publik
- [ ] Email support / kontak CS

---

## 9. Prioritas & Estimasi

| Fase | Fokus | Estimasi | Kapan mulai |
|------|-------|----------|-------------|
| **A** | Deploy aman | 2–4 minggu | Sebelum go-live pertama |
| **B** | Produk lengkap | 4–8 minggu | Setelah ada user & event nyata |
| **C** | Scale & flash sale | 8–12 minggu | Sebelum event besar / on-sale |

### Urutan implementasi yang disarankan (Fase A)

1. Email konfirmasi + PDF e-ticket  
2. Webhook production + payment reconcile worker  
3. Verifikasi email + lupa password  
4. CAPTCHA + hardening  
5. Monitoring + backup + staging  
6. Legal final + checklist deploy  

### Ringkasan

**Eventra hari ini** = toko tiket kecil end-to-end yang sudah jalan.  
**Target Loket/Tiket.com** = Fase A (wajib) + Fase B (produk) + Fase C (scale).  

Yang paling membedakan dari sekadar MVP: **notifikasi email, pembayaran production, scanner check-in, anti-bot/waiting room, dan laporan operasional**.

---

## Referensi

- [plan.md](./plan.md) — Arsitektur, database, API, roadmap MVP Fase 1  
- [README.md](./README.md) — Quick start & perintah development  
- [Midtrans Docs](https://docs.midtrans.com/) — Snap, webhook, refund  
- Benchmark produk: [Loket.com](https://www.loket.com), [Tiket.com](https://www.tiket.com)
