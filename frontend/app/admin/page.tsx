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
import { DashboardTrendChart } from "@/components/admin/dashboard-trend-chart";
import { api, AdminBooking, AdminStats, formatIDR } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export default function AdminDashboardPage() {
  const { accessToken, user } = useAuthStore();
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

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Selamat pagi";
    if (h < 17) return "Selamat siang";
    return "Selamat malam";
  };

  return (
    <div>
      <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-brand-500">
              {greeting()}, {user?.full_name?.split(" ")[0] || "Admin"}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">Dashboard</h1>
            <p className="mt-2 max-w-lg text-sm text-gray-500">
              Ringkasan aktivitas platform tiket Anda
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/events/new">
              <Button
                size="sm"
                className="bg-brand-500! text-white! shadow-sm hover:bg-brand-600!"
              >
                + Buat Event
              </Button>
            </Link>
            <Link href="/admin/bookings">
              <Button size="sm" variant="secondary" className="border-gray-200! text-gray-700!">
                Lihat Booking
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-error-50 bg-error-50 px-4 py-3 text-sm text-error-500">
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
          <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-6 py-10 text-gray-500">
            <Spinner className="border-gray-200 border-t-brand-500" />
            <span className="text-sm">Memuat statistik...</span>
          </div>
        )
      )}

      <DashboardTrendChart />

      <section className="mt-8">
        <PageHeader
          title="Booking Terbaru"
          description="Transaksi terakhir dari platform Anda"
          action={
            <Link
              href="/admin/bookings"
              className="text-sm font-semibold text-brand-500 transition hover:text-brand-600"
            >
              Lihat semua →
            </Link>
          }
        />

        {recentBookings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
            <p className="text-sm font-medium text-gray-700">Belum ada transaksi</p>
            <p className="mt-1 text-xs text-gray-400">
              Booking akan muncul di sini setelah ada pembelian.
            </p>
          </div>
        ) : (
          <DataTable>
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Pembeli
                  </th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Event
                  </th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Status
                  </th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Total
                  </th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentBookings.map((b) => (
                  <tr key={b.id} className="transition hover:bg-brand-50/40">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-gray-900">{b.user_name}</p>
                      <p className="text-xs text-gray-400">{b.user_email}</p>
                    </td>
                    <td className="px-5 py-4 text-gray-700">{b.event_title}</td>
                    <td className="px-5 py-4">
                      <StatusPill
                        label={adminBookingStatusLabel[b.status] || b.status}
                        toneClass={adminBookingStatusTone[b.status]}
                      />
                    </td>
                    <td className="px-5 py-4 font-bold text-gray-900">
                      {formatIDR(b.total_amount)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/admin/bookings/${b.id}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-500 transition hover:bg-brand-100"
                      >
                        Detail →
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
