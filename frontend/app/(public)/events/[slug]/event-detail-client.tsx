"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, ApiClientError, Event, TicketType, formatIDR } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { QueueStatus, WaitingRoomGate } from "@/components/waiting-room-gate";

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
  const [promoCode, setPromoCode] = useState("");
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoMsg, setPromoMsg] = useState("");
  const [queueStatus, setQueueStatus] = useState<QueueStatus>("loading");

  const canSelectTickets = queueStatus === "disabled" || queueStatus === "admitted";

  const handleQueueStatus = useCallback((status: QueueStatus) => {
    setQueueStatus(status);
  }, []);

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

  const subtotal = types.reduce((sum, tt) => sum + (quantities[tt.id] || 0) * tt.price, 0);
  const total = Math.max(0, subtotal - promoDiscount);
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
        promo_code: promoCode.trim() || undefined,
        queue_token: sessionStorage.getItem(`wr:${slug}`) || undefined,
      });
      router.push(`/checkout/${booking.id}`);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal memesan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  if (types.length === 0) {
    return <p className="text-sm text-slate-500">Tiket belum tersedia untuk event ini.</p>;
  }

  const ticketPanel = (
    <>
      {canSelectTickets ? (
        <>
          {types.map((tt) => {
            const max = Math.min(tt.max_per_order, tt.available);
            const soldOut = tt.available <= 0;
            const qty = quantities[tt.id] || 0;

            return (
              <div
                key={tt.id}
                className={`rounded-(--radius) border p-4 transition ${
                  soldOut
                    ? "border-slate-200 bg-slate-50 opacity-60"
                    : qty > 0
                      ? "border-(--accent) bg-(--accent-soft)"
                      : "border-(--border) bg-slate-50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">
                      {tt.name}
                      {tt.tier_label && (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                          {tt.tier_label}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-lg font-bold text-(--accent)">{formatIDR(tt.price)}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {soldOut ? (
                        <span className="font-semibold text-red-600">Habis</span>
                      ) : (
                        <>
                          <span className="font-medium text-emerald-600">{tt.available}</span> tersisa ·
                          maks {tt.max_per_order}/pesanan
                        </>
                      )}
                    </p>
                  </div>

                  {!soldOut && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label="Kurangi"
                        onClick={() => setQty(tt.id, qty - 1, max)}
                        disabled={qty <= 0}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-(--border) bg-white text-lg font-medium transition hover:bg-slate-100 disabled:opacity-30"
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-sm font-bold tabular-nums">{qty}</span>
                      <button
                        type="button"
                        aria-label="Tambah"
                        onClick={() => setQty(tt.id, qty + 1, max)}
                        disabled={qty >= max}
                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-(--accent) text-lg font-medium text-white transition hover:bg-(--accent-hover) disabled:opacity-30"
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <div className="rounded-(--radius) border border-(--border) bg-white p-4">
            <label className="text-sm font-medium text-slate-700">Kode promo</label>
            <div className="mt-2 flex gap-2">
              <input
                className="flex-1 rounded-lg border border-(--border) px-3 py-2 text-sm outline-none focus:border-(--accent) focus:ring-2 focus:ring-(--accent-ring)"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                placeholder="PROMO2026"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!promoCode.trim() || subtotal <= 0}
                onClick={async () => {
                  setPromoMsg("");
                  try {
                    const res = await api.validatePromo({
                      code: promoCode.trim(),
                      event_id: event.id,
                      subtotal,
                    });
                    setPromoDiscount(res.discount_amount);
                    setPromoMsg(`Diskon ${formatIDR(res.discount_amount)} diterapkan`);
                  } catch (e) {
                    setPromoDiscount(0);
                    setPromoMsg(e instanceof ApiClientError ? e.message : "Promo tidak valid");
                  }
                }}
              >
                Terapkan
              </Button>
            </div>
            {promoMsg && <p className="mt-2 text-xs text-slate-500">{promoMsg}</p>}
          </div>

          <div className="hidden border-t border-(--border) pt-4 lg:block">
            <SummaryFooter
              totalQty={totalQty}
              subtotal={subtotal}
              promoDiscount={promoDiscount}
              total={total}
              hasSelection={hasSelection}
              loading={loading}
              onBook={handleBook}
            />
          </div>
        </>
      ) : queueStatus === "loading" ? (
        <div className="flex justify-center py-8">
          <Spinner className="h-6 w-6" />
        </div>
      ) : null}

      {error && (
        <div className="rounded-(--radius) border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </>
  );

  return (
    <>
      <div className="space-y-3">
        <WaitingRoomGate slug={slug} onStatusChange={handleQueueStatus} />
        {ticketPanel}
      </div>

      {/* Mobile sticky checkout bar */}
      {canSelectTickets && hasSelection && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-(--border) bg-white p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] lg:hidden">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-xs text-slate-500">{totalQty} tiket</p>
              <p className="text-xl font-bold text-(--accent)">{formatIDR(total)}</p>
            </div>
            <Button onClick={handleBook} disabled={loading} size="lg" className="min-w-[140px]">
              {loading ? "Memproses…" : "Beli Tiket"}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function SummaryFooter({
  totalQty,
  subtotal,
  promoDiscount,
  total,
  hasSelection,
  loading,
  onBook,
}: {
  totalQty: number;
  subtotal: number;
  promoDiscount: number;
  total: number;
  hasSelection: boolean;
  loading: boolean;
  onBook: () => void;
}) {
  return (
    <>
      <div className="mb-4">
        <p className="text-xs text-slate-400">
          {totalQty > 0 ? `${totalQty} tiket dipilih` : "Belum ada tiket dipilih"}
        </p>
        {promoDiscount > 0 && (
          <p className="text-sm text-slate-400 line-through">{formatIDR(subtotal)}</p>
        )}
        <p className="text-2xl font-bold text-slate-900">{formatIDR(total)}</p>
      </div>
      <Button onClick={onBook} disabled={!hasSelection || loading} fullWidth size="lg">
        {loading ? (
          <span className="flex items-center gap-2">
            <Spinner className="h-4 w-4 border-white/30 border-t-white" />
            Memproses…
          </span>
        ) : (
          "Beli Tiket"
        )}
      </Button>
      <p className="mt-3 text-center text-xs text-slate-400">Tiket ditahan 10 menit setelah klik beli</p>
    </>
  );
}
