"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PageHero } from "@/components/public/page-hero";
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
      /* clipboard unavailable */
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
      <>
        <PageHero title="Detail Pemesanan" />
        <Container narrow className="py-16 text-center">
          <p className="text-slate-500">Booking tidak ditemukan</p>
          <Link href="/bookings" className="mt-4 inline-block font-medium text-(--accent)">
            Kembali
          </Link>
        </Container>
      </>
    );
  }

  const cancellable = canCancelBooking(booking.status);

  return (
    <>
      <PageHero
        title="Detail Pemesanan"
        subtitle={
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Badge tone={bookingStatusTone[booking.status] || "neutral"}>
              {bookingStatusLabel[booking.status] || booking.status}
            </Badge>
            <Link
              href="/bookings"
              className="text-sm font-medium text-(--accent) hover:underline"
            >
              ← Kembali ke Tiket Saya
            </Link>
          </div>
        }
      />

      <div className="py-10 sm:py-12">
        <Container narrow>
          {booking.status === "held" && booking.hold_expires_at && (
            <div className="mb-6 rounded-(--radius) bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Tiket ditahan hingga{" "}
              <span className="font-semibold">{formatDate(booking.hold_expires_at)}</span>. Selesaikan
              pembayaran sebelum waktu habis.
            </div>
          )}

          <div className="rounded-lg border border-(--border) bg-white p-6 shadow-(--shadow-sm)">
            <p className="text-sm text-slate-400">Total pembayaran</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{formatIDR(booking.total_amount)}</p>
            {booking.items?.map((item) => (
              <div
                key={item.ticket_type_id}
                className="mt-4 flex justify-between border-t border-(--border) pt-4 text-sm"
              >
                <span className="text-slate-600">
                  {item.ticket_type_name} × {item.quantity}
                </span>
                <span className="font-medium">{formatIDR(item.unit_price * item.quantity)}</span>
              </div>
            ))}
          </div>

          {booking.status === "confirmed" && tickets.length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg font-bold text-slate-900">E-Ticket</h2>
              <p className="mt-1 text-sm text-slate-500">
                Tunjukkan QR code atau kode tiket saat masuk venue
              </p>
              <div className="mt-4 space-y-4">
                {tickets.map((t) => (
                  <div
                    key={t.id}
                    className="overflow-hidden rounded-lg border-2 border-dashed border-(--accent)/30 bg-(--accent-soft)"
                  >
                    <div className="bg-(--accent) px-5 py-3 text-sm font-semibold text-white">
                      Eventra E-Ticket
                    </div>
                    <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-600">{t.ticket_type_name}</p>
                        <p className="mt-2 font-mono text-2xl font-bold tracking-widest text-slate-900 break-all">
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
                          {accessToken && (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => api.downloadTicketPdf(accessToken, booking.id, t.id)}
                            >
                              Unduh PDF
                            </Button>
                          )}
                        </div>
                        <p className="mt-3 text-xs text-slate-500">Satu kali scan · Jangan dibagikan</p>
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
                className="text-(--danger) hover:bg-red-50 hover:text-(--danger)"
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
            <p className="mt-8 rounded-(--radius) bg-slate-100 px-4 py-3 text-sm text-slate-600">
              Pemesanan ini telah dibatalkan. Kuota tiket dikembalikan ke event.
            </p>
          )}

          {booking.status === "expired" && (
            <p className="mt-8 rounded-(--radius) bg-red-50 px-4 py-3 text-sm text-red-800">
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
    </>
  );
}
