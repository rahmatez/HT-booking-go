"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiClientError, Event, TicketType, formatIDR } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

type Props = {
  event: Event;
  ticketTypes: TicketType[];
  slug: string;
};

export function EventDetailClient({ event, ticketTypes: initialTypes, slug }: Props) {
  const router = useRouter();
  const { accessToken, isAuthenticated } = useAuthStore();
  const [types, setTypes] = useState(initialTypes);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const poll = async () => {
      try {
        const avail = await api.getAvailability(slug);
        setTypes((prev) =>
          prev.map((tt) => {
            const a = avail.find((x) => x.id === tt.id);
            return a ? { ...tt, available: a.available } : tt;
          })
        );
      } catch {
        /* ignore */
      }
    };
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [slug]);

  const setQty = (id: string, qty: number, max: number) => {
    setQuantities((prev) => ({ ...prev, [id]: Math.max(0, Math.min(qty, max)) }));
  };

  const total = types.reduce((sum, tt) => sum + (quantities[tt.id] || 0) * tt.price, 0);
  const hasSelection = Object.values(quantities).some((q) => q > 0);
  const totalQty = Object.values(quantities).reduce((a, b) => a + b, 0);

  const handleBook = async () => {
    if (!isAuthenticated() || !accessToken) {
      router.push("/auth/login?redirect=/events/" + slug);
      return;
    }
    const items = types
      .filter((tt) => (quantities[tt.id] || 0) > 0)
      .map((tt) => ({ ticket_type_id: tt.id, quantity: quantities[tt.id] }));

    if (items.length === 0) return;

    setLoading(true);
    setError("");
    try {
      const booking = await api.holdBooking(accessToken, crypto.randomUUID(), {
        event_id: event.id,
        items,
      });
      router.push(`/checkout/${booking.id}`);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal memesan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  if (types.length === 0) {
    return <p className="text-sm text-stone-500">Tiket belum tersedia untuk event ini.</p>;
  }

  return (
    <div className="space-y-3">
      {types.map((tt) => {
        const max = Math.min(tt.max_per_order, tt.available);
        const soldOut = tt.available <= 0;
        const qty = quantities[tt.id] || 0;

        return (
          <div
            key={tt.id}
            className={`rounded-xl border p-4 transition ${
              soldOut
                ? "border-stone-200 bg-stone-50 opacity-60"
                : qty > 0
                  ? "border-(--accent) bg-(--accent-soft)"
                  : "border-(--border) bg-white"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-stone-900">{tt.name}</p>
                <p className="mt-0.5 text-lg font-bold text-(--accent)">
                  {formatIDR(tt.price)}
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  {soldOut ? (
                    <span className="font-medium text-red-600">Habis</span>
                  ) : (
                    <>
                      <span className="font-medium text-(--success)">{tt.available}</span> tersisa
                      · maks {tt.max_per_order}/pesanan
                    </>
                  )}
                </p>
              </div>

              {!soldOut && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label="Kurangi"
                    onClick={() => setQty(tt.id, qty - 1, max)}
                    disabled={qty <= 0}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-(--border-strong) bg-white text-lg font-medium transition hover:bg-stone-50 disabled:opacity-30"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm font-bold tabular-nums">{qty}</span>
                  <button
                    type="button"
                    aria-label="Tambah"
                    onClick={() => setQty(tt.id, qty + 1, max)}
                    disabled={qty >= max}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-(--border-strong) bg-white text-lg font-medium transition hover:bg-stone-50 disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {error && (
        <div className="rounded-xl border border-red-200 bg-(--danger-soft) px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="border-t border-(--border) pt-4">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-xs text-stone-400">
              {totalQty > 0 ? `${totalQty} tiket dipilih` : "Belum ada tiket dipilih"}
            </p>
            <p className="text-2xl font-bold tracking-tight text-stone-900">
              {formatIDR(total)}
            </p>
          </div>
        </div>
        <Button
          onClick={handleBook}
          disabled={!hasSelection || loading}
          fullWidth
          size="lg"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Spinner className="h-4 w-4 border-white/30 border-t-white" />
              Memproses...
            </span>
          ) : (
            "Lanjut ke Pembayaran"
          )}
        </Button>
        <p className="mt-3 text-center text-xs text-stone-400">
          Tiket ditahan 10 menit setelah klik lanjut
        </p>
      </div>
    </div>
  );
}
