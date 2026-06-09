"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { HoldCountdown } from "@/components/hold-countdown";
import { api, ApiClientError, Booking, formatIDR } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useAuthHydrated } from "@/lib/use-auth-hydrated";
import { isMidtransConfigured, loadMidtransSnap, openMidtransSnap } from "@/lib/midtrans";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

const PAYABLE_STATUSES = new Set(["held", "pending_payment"]);

async function waitForConfirmation(token: string, bookingId: string, maxAttempts = 15) {
  for (let i = 0; i < maxAttempts; i++) {
    await api.syncPayment(token, bookingId);
    const booking = await api.getBooking(token, bookingId);
    if (booking.status === "confirmed") return true;
    if (booking.status === "cancelled" || booking.status === "expired") return false;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

export default function CheckoutPage() {
  const params = useParams<{ bookingId: string }>();
  const router = useRouter();
  const hydrated = useAuthHydrated();
  const { accessToken, isAuthenticated } = useAuthStore();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [holdExpired, setHoldExpired] = useState(false);
  const [error, setError] = useState("");
  const midtransReady = isMidtransConfigured();

  const handleHoldExpired = useCallback(() => {
    setHoldExpired(true);
    setError("Waktu habis. Silakan pesan ulang tiketmu.");
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated() || !accessToken) {
      router.push("/auth/login?redirect=/checkout/" + params.bookingId);
      return;
    }
    api
      .getBooking(accessToken, params.bookingId)
      .then((b) => {
        setBooking(b);
        if (!PAYABLE_STATUSES.has(b.status)) {
          setError("Pemesanan tidak dapat dibayar pada status ini.");
        }
      })
      .catch(() => setError("Pemesanan tidak ditemukan"))
      .finally(() => setLoading(false));
  }, [hydrated, accessToken, isAuthenticated, params.bookingId, router]);

  const canPay =
    booking &&
    PAYABLE_STATUSES.has(booking.status) &&
    !holdExpired &&
    !paying;

  const handlePay = async () => {
    if (!accessToken || !booking || !canPay) return;
    setPaying(true);
    setError("");

    try {
      if (midtransReady) {
        await loadMidtransSnap();
        const checkout = await api.paymentCheckout(accessToken, booking.id);

        openMidtransSnap(checkout.snap_token, {
          onSuccess: async () => {
            setPaying(true);
            const ok = await waitForConfirmation(accessToken, booking.id);
            if (ok) {
              router.push(`/bookings/${booking.id}`);
            } else {
              setError("Pembayaran diproses. Cek status di halaman tiket kamu.");
              setPaying(false);
            }
          },
          onPending: async () => {
            setPaying(true);
            const ok = await waitForConfirmation(accessToken, booking.id);
            if (ok) {
              router.push(`/bookings/${booking.id}`);
            } else {
              setError("Pembayaran menunggu konfirmasi. Cek status di halaman tiket kamu.");
              setPaying(false);
            }
          },
          onError: () => {
            setError("Pembayaran gagal atau dibatalkan.");
            setPaying(false);
          },
          onClose: () => {
            setPaying(false);
          },
        });
        return;
      }

      await api.confirmBooking(accessToken, booking.id);
      await api.simulatePayment(accessToken, booking.id);
      router.push(`/bookings/${booking.id}`);
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Pembayaran gagal. Silakan coba lagi.";
      setError(msg);
      setPaying(false);
    }
  };

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
        <p className="text-red-600">{error || "Pemesanan tidak ditemukan"}</p>
        <Link href="/events" className="mt-4 inline-block text-(--accent)">
          Kembali ke event
        </Link>
      </Container>
    );
  }

  return (
    <div className="py-10 sm:py-14">
      <Container narrow>
        <div className="mb-2 text-sm font-medium text-stone-400">Langkah terakhir</div>
        <h1 className="text-3xl font-bold tracking-tight text-stone-900">Checkout</h1>

        <div className="mt-8">
          <HoldCountdown expiresAt={booking.hold_expires_at} onExpired={handleHoldExpired} />
        </div>

        <div className="mt-6 rounded-2xl border border-(--border) bg-white p-6 shadow-(--shadow-md)">
          <h2 className="font-semibold text-stone-900">Ringkasan pesanan</h2>
          <div className="mt-4 space-y-3">
            {booking.items?.map((item) => (
              <div key={item.ticket_type_id} className="flex justify-between text-sm">
                <span className="text-stone-600">
                  {item.ticket_type_name}{" "}
                  <span className="text-stone-400">× {item.quantity}</span>
                </span>
                <span className="font-medium text-stone-900">
                  {formatIDR(item.unit_price * item.quantity)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between border-t border-(--border) pt-5">
            <span className="font-semibold text-stone-900">Total</span>
            <span className="text-2xl font-bold text-(--accent)">
              {formatIDR(booking.total_amount)}
            </span>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl bg-(--danger-soft) px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <Button
          onClick={handlePay}
          disabled={!canPay}
          fullWidth
          size="lg"
          className="mt-6"
        >
          {paying ? "Membuka pembayaran..." : "Bayar Sekarang"}
        </Button>

        <p className="mt-4 text-center text-xs leading-relaxed text-stone-400">
          {midtransReady ? (
            <>
              Pembayaran aman via Midtrans Snap.
              <br />
              Sandbox: gunakan kartu test 4811 1111 1111 1114.
            </>
          ) : (
            "Midtrans belum dikonfigurasi — mode simulasi pembayaran aktif."
          )}
        </p>
      </Container>
    </div>
  );
}
