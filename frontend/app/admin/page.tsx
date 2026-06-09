"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { StatusPill } from "@/components/admin/status-pill";
import { DataTable } from "@/components/admin/data-table";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  adminBookingStatusLabel,
  adminBookingStatusTone,
} from "@/lib/admin-labels";
import { api, AdminBooking, AdminStats, formatDate, formatIDR } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export default function AdminDashboardPage() {
  const { accessToken } = useAuthStore();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recentBookings, setRecentBookings] = useState<AdminBooking[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!accessToken) return;
    Promise.all([
      api.adminStats(accessToken),
      api.adminListBookings(accessToken, { page: 1 }),
    ])
      .then(([s, bookingsRes]) => {
        setStats(s);
        setRecentBookings(bookingsRes.data.slice(0, 5));
      })
      .catch(() => setError("Gagal memuat statistik"));
  }, [accessToken]);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Ringkasan aktivitas platform tiket Anda"
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/events/new">
              <Button size="sm">+ Buat Event</Button>
            </Link>
            <Link href="/admin/bookings">
              <Button size="sm" variant="secondary">
                Lihat Booking
              </Button>
            </Link>
          </div>
        }
      />

      {error && (
        <p className="mb-4 rounded-xl border border-red-200 bg-(--danger-soft) px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {stats ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total Event"
            value={stats.total_events}
            hint={`${stats.published_events} dipublikasi`}
            accent="orange"
          />
          <StatCard
            label="Total Booking"
            value={stats.total_bookings}
            hint={`${stats.confirmed_bookings} lunas`}
            accent="blue"
          />
          <StatCard label="Pendapatan" value={formatIDR(stats.total_revenue)} accent="teal" />
          <StatCard label="Tiket Terjual" value={stats.tickets_sold} accent="violet" />
        </div>
      ) : (
        !error && (
          <div className="flex items-center gap-3 text-stone-500">
            <Spinner />
            <span className="text-sm">Memuat statistik...</span>
          </div>
        )
      )}

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-stone-900">Booking Terbaru</h2>
          <Link
            href="/admin/bookings"
            className="text-sm font-semibold text-(--accent) hover:underline"
          >
            Lihat semua →
          </Link>
        </div>

        {recentBookings.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-10 text-center text-sm text-stone-500">
            Belum ada transaksi.
          </p>
        ) : (
          <DataTable>
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="border-b border-(--border) bg-stone-50/80">
                <tr>
                  <th className="px-4 py-3 font-semibold text-stone-600">Pembeli</th>
                  <th className="px-4 py-3 font-semibold text-stone-600">Event</th>
                  <th className="px-4 py-3 font-semibold text-stone-600">Status</th>
                  <th className="px-4 py-3 font-semibold text-stone-600">Total</th>
                  <th className="px-4 py-3 font-semibold text-stone-600"></th>
                </tr>
              </thead>
              <tbody>
                {recentBookings.map((b) => (
                  <tr
                    key={b.id}
                    className="border-b border-(--border) last:border-0 hover:bg-stone-50/60"
                  >
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-stone-900">{b.user_name}</p>
                      <p className="text-xs text-stone-500">{b.user_email}</p>
                    </td>
                    <td className="px-4 py-3.5 text-stone-700">{b.event_title}</td>
                    <td className="px-4 py-3.5">
                      <StatusPill
                        label={adminBookingStatusLabel[b.status] || b.status}
                        toneClass={adminBookingStatusTone[b.status]}
                      />
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-stone-900">
                      {formatIDR(b.total_amount)}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Link
                        href={`/admin/bookings/${b.id}`}
                        className="font-semibold text-(--accent) hover:underline"
                      >
                        Detail
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>
        )}
      </section>
    </div>
  );
}
