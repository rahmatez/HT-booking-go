"use client";

import { useEffect, useState } from "react";
import { api, DailyTrendRow, formatIDR } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export function DashboardTrendChart() {
  const { accessToken } = useAuthStore();
  const [rows, setRows] = useState<DailyTrendRow[]>([]);

  useEffect(() => {
    if (!accessToken) return;
    api.adminDashboardTrend(accessToken, 14).then(setRows).catch(() => setRows([]));
  }, [accessToken]);

  if (rows.length === 0) return null;

  const maxRevenue = Math.max(...rows.map((r) => r.revenue), 1);

  return (
    <section className="mt-10 rounded-2xl border border-(--border) bg-white p-6 shadow-(--shadow-sm)">
      <h2 className="text-lg font-semibold text-stone-900">Trend 14 hari terakhir</h2>
      <p className="mt-1 text-sm text-stone-500">Pendapatan dari booking confirmed</p>
      <div className="mt-6 flex items-end gap-2 overflow-x-auto pb-2">
        {rows.map((r) => (
          <div key={r.day} className="flex min-w-[48px] flex-col items-center gap-2">
            <span className="text-[10px] font-medium text-stone-500">{formatIDR(r.revenue)}</span>
            <div
              className="w-8 rounded-t-md bg-(--accent)"
              style={{ height: `${Math.max(8, (r.revenue / maxRevenue) * 120)}px` }}
              title={`${r.bookings} booking, ${r.tickets} tiket`}
            />
            <span className="text-[10px] text-stone-400">
              {new Date(r.day).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
