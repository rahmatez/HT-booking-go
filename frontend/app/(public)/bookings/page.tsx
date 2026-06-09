"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, BookingSummary, formatDate, formatIDR } from "@/lib/api";
import { bookingStatusLabel, bookingStatusTone } from "@/lib/booking-utils";
import { useAuthStore } from "@/lib/auth-store";
import { useAuthHydrated } from "@/lib/use-auth-hydrated";
import { Container } from "@/components/ui/container";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";

export default function BookingsPage() {
  const router = useRouter();
  const hydrated = useAuthHydrated();
  const { accessToken, isAuthenticated } = useAuthStore();
  const [bookings, setBookings] = useState<BookingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated() || !accessToken) {
      router.push("/auth/login?redirect=/bookings");
      return;
    }
    api
      .listBookings(accessToken)
      .then(setBookings)
      .catch(() => setError("Gagal memuat daftar tiket"))
      .finally(() => setLoading(false));
  }, [hydrated, accessToken, isAuthenticated, router]);

  return (
    <div className="py-10 sm:py-14">
      <Container narrow>
        <h1 className="text-3xl font-bold tracking-tight text-stone-900">Tiket Saya</h1>
        <p className="mt-2 text-stone-500">Semua pembelian dan e-ticket kamu ada di sini.</p>

        {error && (
          <div className="mt-6 rounded-xl bg-(--danger-soft) px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-10">
          {!hydrated || loading ? (
            <div className="flex justify-center py-20">
              <Spinner className="h-8 w-8" />
            </div>
          ) : bookings.length === 0 ? (
            <EmptyState
              title="Belum ada tiket"
              description="Event favoritmu menunggu. Jelajahi dan amankan tiketmu sekarang."
              actionLabel="Cari Event"
              actionHref="/events"
            />
          ) : (
            <div className="space-y-4">
              {bookings.map((b) => (
                <Link
                  key={b.id}
                  href={`/bookings/${b.id}`}
                  className="group block rounded-2xl border border-(--border) bg-white p-5 shadow-(--shadow-sm) transition hover:border-stone-300 hover:shadow-(--shadow-md)"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold text-stone-900 group-hover:text-(--accent)">
                        {b.event_title}
                      </h2>
                      {b.event_starts_at && (
                        <p className="mt-1 text-sm text-stone-500">{formatDate(b.event_starts_at)}</p>
                      )}
                    </div>
                    <Badge tone={bookingStatusTone[b.status] || "neutral"}>
                      {bookingStatusLabel[b.status] || b.status}
                    </Badge>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-(--border) pt-4">
                    <p className="font-bold text-stone-900">{formatIDR(b.total_amount)}</p>
                    <span className="text-sm font-medium text-stone-400 group-hover:text-(--accent)">
                      Lihat detail →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </Container>
    </div>
  );
}
