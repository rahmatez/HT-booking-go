"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHero } from "@/components/public/page-hero";
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
    <>
      <PageHero
        title="Tiket Saya"
        subtitle="Semua pembelian dan e-ticket kamu ada di sini."
      />

      <div className="py-10 sm:py-12">
        <Container narrow>
          {error && (
            <div className="mb-6 rounded-(--radius) bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

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
                  className="group flex overflow-hidden rounded-lg border border-(--border) bg-white shadow-(--shadow-sm) transition hover:border-blue-200 hover:shadow-(--shadow-md)"
                >
                  <div className="flex w-2 shrink-0 bg-(--accent)" />
                  <div className="flex flex-1 flex-col p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold text-slate-900 group-hover:text-(--accent)">
                          {b.event_title}
                        </h2>
                        <Badge tone={bookingStatusTone[b.status] || "neutral"}>
                          {bookingStatusLabel[b.status] || b.status}
                        </Badge>
                      </div>
                      {b.event_starts_at && (
                        <p className="mt-1.5 text-sm text-slate-500">
                          {formatDate(b.event_starts_at)}
                        </p>
                      )}
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-4 sm:mt-0 sm:flex-col sm:items-end">
                      <p className="text-lg font-bold text-slate-900">{formatIDR(b.total_amount)}</p>
                      <span className="text-sm font-medium text-(--accent)">Detail →</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Container>
      </div>
    </>
  );
}
