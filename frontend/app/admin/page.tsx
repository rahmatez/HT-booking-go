"use client";

import { useEffect, useState } from "react";
import { StatCard } from "@/components/admin/stat-card";
import { Spinner } from "@/components/ui/spinner";
import { api, AdminStats, formatIDR } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export default function AdminDashboardPage() {
  const { accessToken } = useAuthStore();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!accessToken) return;
    api
      .adminStats(accessToken)
      .then(setStats)
      .catch(() => setError("Gagal memuat statistik"));
  }, [accessToken]);

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">Dashboard</h1>
        <p className="mt-1 text-sm text-stone-500">Ringkasan aktivitas platform tiket Anda</p>
      </header>

      {error && (
        <p className="mb-4 rounded-xl border border-red-200 bg-(--danger-soft) px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Total Event" value={stats.total_events} hint={`${stats.published_events} published`} />
          <StatCard label="Total Booking" value={stats.total_bookings} hint={`${stats.confirmed_bookings} confirmed`} />
          <StatCard label="Pendapatan" value={formatIDR(stats.total_revenue)} />
          <StatCard label="Tiket Terjual" value={stats.tickets_sold} />
        </div>
      ) : (
        !error && (
          <div className="flex items-center gap-3 text-stone-500">
            <Spinner />
            <span className="text-sm">Memuat statistik...</span>
          </div>
        )
      )}
    </div>
  );
}
