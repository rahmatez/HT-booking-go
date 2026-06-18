"use client";

import { useEffect, useState } from "react";
import { api, DailyTrendRow, formatIDR } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export function DashboardTrendChart() {
  const { accessToken } = useAuthStore();
  const [rows, setRows] = useState<DailyTrendRow[]>([]);
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    api.adminDashboardTrend(accessToken, 14).then(setRows).catch(() => setRows([]));
  }, [accessToken]);

  if (rows.length === 0) return null;

  const maxRevenue = Math.max(...rows.map((r) => r.revenue), 1);
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalBookings = rows.reduce((s, r) => s + r.bookings, 0);

  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Trend 14 hari terakhir</h2>
          <p className="mt-0.5 text-sm text-gray-500">Pendapatan dari booking confirmed</p>
        </div>
        <div className="flex gap-6 text-sm">
          <div>
            <p className="text-xs text-gray-400">Total pendapatan</p>
            <p className="font-bold text-brand-500">{formatIDR(totalRevenue)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Total booking</p>
            <p className="font-bold text-gray-800">{totalBookings}</p>
          </div>
        </div>
      </div>

      <div className="relative px-6 pb-6 pt-8">
        <div className="pointer-events-none absolute inset-x-6 top-8 flex h-[140px] flex-col justify-between">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="border-t border-dashed border-gray-100" />
          ))}
        </div>

        <div className="relative flex items-end gap-1.5 overflow-x-auto pb-1 sm:gap-2">
          {rows.map((r, i) => {
            const height = Math.max(6, (r.revenue / maxRevenue) * 140);
            const active = hovered === i;
            return (
              <div
                key={r.day}
                className="group flex min-w-[44px] flex-1 flex-col items-center gap-2 sm:min-w-[52px]"
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              >
                <div
                  className={`rounded-lg px-1.5 py-0.5 text-[10px] font-semibold transition-all ${
                    active || r.revenue > 0
                      ? "text-brand-500 opacity-100"
                      : "text-gray-300 opacity-0 group-hover:opacity-100"
                  }`}
                >
                  {formatIDR(r.revenue)}
                </div>
                <div
                  className={`relative w-full max-w-[40px] rounded-t-lg bg-brand-500 transition-all duration-300 ${
                    active ? "bg-brand-600 shadow-md shadow-brand-500/25" : ""
                  }`}
                  style={{ height: `${height}px` }}
                  title={`${r.bookings} booking · ${r.tickets} tiket`}
                />
                <span
                  className={`text-[10px] font-medium transition ${
                    active ? "text-brand-500" : "text-gray-400"
                  }`}
                >
                  {new Date(r.day).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
