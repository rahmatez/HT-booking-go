"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { TicketQR } from "@/components/ticket-qr";
import { api, ApiClientError, Booking, Ticket, formatDate, formatIDR } from "@/lib/api";
import { bookingStatusLabel, bookingStatusTone, canCancelBooking } from "@/lib/booking-utils";
import { useAuthStore } from "@/lib/auth-store";
import { useAuthHydrated } from "@/lib/use-auth-hydrated";
import { Container } from "@/components/ui/container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Spinner } from "@/components/ui/spinner";

export default function BookingDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const hydrated = useAuthHydrated();
  const { accessToken, isAuthenticated } = useAuthStore();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const loadBooking = useCallback(async () => {
    if (!accessToken) return;
    const [b, t] = await Promise.all([
      api.getBooking(accessToken, params.id),
      api.listTickets(accessToken, params.id).catch(() => [] as Ticket[]),
    ]);
    setBooking(b);
    setTickets(t);
  }, [accessToken, params.id]);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated() || !accessToken) {
      router.push(`/auth/login?redirect=/bookings/${params.id}`);
      return;
    }
    loadBooking()
      .catch(() => setCancelError("Gagal memuat detail pemesanan"))
      .finally(() => setLoading(false));
  }, [hydrated, accessToken, isAuthenticated, loadBooking, params.id, router]);

  async function handleCancel() {
    if (!accessToken || !booking) return;
    setCancelling(true);
    setCancelError(null);
    try {
      await api.cancelBooking(accessToken, booking.id);
      setShowCancel(false);
      router.push("/bookings");
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : "Gagal membatalkan pemesanan. Coba lagi.";
      setCancelError(message);
    } finally {
      setCancelling(false);
    }
  }

  async function copyTicketCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      // Clipboard may be unavailable in some browsers.
    }
  }

  if (!hydrated || loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!booking) {
    return (
      <Container narrow className="py-16 text-center">
        <p className="text-stone-500">Booking tidak ditemukan</p>
        <Link href="/bookings" className="mt-4 inline-block text-(--accent)">
          Kembali
        </Link>
      </Container>
    );
  }

  const cancellable = canCancelBooking(booking.status);

  return (
    <div className="py-10 sm:py-14">
      <Container narrow>
        <Link href="/bookings" className="text-sm font-medium text-stone-500 hover:text-(--accent)">
          ← Tiket Saya
        </Link>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-stone-900">Detail Pemesanan</h1>
          <Badge tone={bookingStatusTone[booking.status] || "neutral"}>
            {bookingStatusLabel[booking.status] || booking.status}
          </Badge>
        </div>

        {booking.status === "held" && booking.hold_expires_at && (
          <p className="mt-4 rounded-xl bg-(--warning-soft) px-4 py-3 text-sm text-amber-900">
            Tiket ditahan hingga{" "}
            <span className="font-semibold">{formatDate(booking.hold_expires_at)}</span>. Selesaikan
            pembayaran sebelum waktu habis.
          </p>
        )}

        <div className="mt-8 rounded-2xl border border-(--border) bg-white p-6 shadow-(--shadow-sm)">
          <p className="text-sm text-stone-400">Total pembayaran</p>
          <p className="mt-1 text-3xl font-bold text-stone-900">{formatIDR(booking.total_amount)}</p>
          {booking.items?.map((item) => (
            <div
              key={item.ticket_type_id}
              className="mt-4 flex justify-between border-t border-(--border) pt-4 text-sm"
            >
              <span className="text-stone-600">
                {item.ticket_type_name} × {item.quantity}
              </span>
              <span className="font-medium">{formatIDR(item.unit_price * item.quantity)}</span>
            </div>
          ))}
        </div>

        {booking.status === "confirmed" && tickets.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-stone-900">E-Ticket kamu</h2>
            <p className="mt-1 text-sm text-stone-500">
              Tunjukkan QR code atau kode tiket saat masuk venue
            </p>
            <div className="mt-4 space-y-4">
              {tickets.map((t) => (
                <div
                  key={t.id}
                  className="relative overflow-hidden rounded-2xl border-2 border-dashed border-(--accent)/30 bg-(--accent-soft) p-6"
                >
                  <div className="absolute right-4 top-4 text-3xl opacity-20">🎫</div>
                  <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-stone-600">{t.ticket_type_name}</p>
                      <p className="mt-2 font-mono text-2xl font-bold tracking-widest text-stone-900 break-all">
                        {t.ticket_code}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => copyTicketCode(t.ticket_code)}
                        >
                          {copiedCode === t.ticket_code ? "Tersalin!" : "Salin kode"}
                        </Button>
                      </div>
                      <p className="mt-3 text-xs text-stone-500">Satu kali scan · Jangan dibagikan</p>
                    </div>
                    <TicketQR value={t.ticket_code} label="Scan di pintu masuk" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {cancellable && (
          <div className="mt-8 space-y-3">
            <Link href={`/checkout/${booking.id}`} className="block">
              <Button fullWidth size="lg">
                Lanjutkan Pembayaran
              </Button>
            </Link>
            <Button
              type="button"
              variant="ghost"
              fullWidth
              className="text-(--danger) hover:bg-(--danger-soft) hover:text-(--danger)"
              onClick={() => {
                setCancelError(null);
                setShowCancel(true);
              }}
            >
              Batalkan Pemesanan
            </Button>
          </div>
        )}

        {booking.status === "cancelled" && (
          <p className="mt-8 rounded-xl bg-stone-100 px-4 py-3 text-sm text-stone-600">
            Pemesanan ini telah dibatalkan. Kuota tiket dikembalikan ke event.
          </p>
        )}

        {booking.status === "expired" && (
          <p className="mt-8 rounded-xl bg-(--danger-soft) px-4 py-3 text-sm text-red-800">
            Waktu pembayaran habis. Pemesanan kedaluwarsa dan tidak dapat dilanjutkan.
          </p>
        )}

        <ConfirmDialog
          open={showCancel}
          title="Batalkan pemesanan?"
          description="Tiket yang ditahan akan dilepas dan kuota dikembalikan. Tindakan ini tidak dapat dibatalkan."
          confirmLabel="Ya, batalkan"
          loading={cancelling}
          onConfirm={() => void handleCancel()}
          onCancel={() => {
            if (!cancelling) setShowCancel(false);
          }}
        />

        {cancelError && (
          <p className="mt-4 text-center text-sm text-(--danger)" role="alert">
            {cancelError}
          </p>
        )}
      </Container>
    </div>
  );
}
