"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { HoldCountdown } from "@/components/hold-countdown";
import { api, Booking, formatIDR } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export default function CheckoutPage() {
  const params = useParams<{ bookingId: string }>();
  const router = useRouter();
  const { accessToken, isAuthenticated } = useAuthStore();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isAuthenticated() || !accessToken) {
      router.push("/auth/login?redirect=/checkout/" + params.bookingId);
      return;
    }
    api
      .getBooking(accessToken, params.bookingId)
      .then(setBooking)
      .catch(() => setError("Pemesanan tidak ditemukan"))
      .finally(() => setLoading(false));
  }, [accessToken, isAuthenticated, params.bookingId, router]);

  const handlePay = async () => {
    if (!accessToken || !booking) return;
    setPaying(true);
    setError("");
    try {
      await api.confirmBooking(accessToken, booking.id);
      await api.simulatePayment(accessToken, booking.id);
      router.push(`/bookings/${booking.id}`);
    } catch {
      setError("Pembayaran gagal. Silakan coba lagi.");
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
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
          <HoldCountdown
            expiresAt={booking.hold_expires_at}
            onExpired={() => setError("Waktu habis. Silakan pesan ulang tiketmu.")}
          />
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
          disabled={paying || booking.status === "expired"}
          fullWidth
          size="lg"
          className="mt-6"
        >
          {paying ? "Memproses pembayaran..." : "Bayar Sekarang"}
        </Button>

        <p className="mt-4 text-center text-xs leading-relaxed text-stone-400">
          Mode pengembangan: pembayaran disimulasikan.
          <br />
          Di production, kamu akan diarahkan ke gateway pembayaran.
        </p>
      </Container>
    </div>
  );
}
