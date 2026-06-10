"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { SimpleTable } from "@/components/admin/simple-table";
import { api, AdminEvent } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export default function CheckInReportsPage() {
  const { accessToken } = useAuthStore();
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [stats, setStats] = useState<Record<string, { checked_in: number; total: number }>>({});

  useEffect(() => {
    if (!accessToken) return;
    api.adminListEvents(accessToken, { status: "published" }).then(async (res) => {
      setEvents(res.data);
      const next: Record<string, { checked_in: number; total: number }> = {};
      await Promise.all(
        res.data.map(async (e) => {
          try {
            const s = await api.adminCheckInStats(accessToken, e.id);
            next[e.id] = s;
          } catch { /* skip */ }
        })
      );
      setStats(next);
    });
  }, [accessToken]);

  return (
    <div>
      <PageHeader title="Laporan Check-in" description="Kehadiran per event" />
      <SimpleTable
        headers={["Event", "Sudah masuk", "Total tiket", "Persentase"]}
        rows={events.map((e) => {
          const s = stats[e.id];
          const pct = s && s.total > 0 ? Math.round((s.checked_in / s.total) * 100) : 0;
          return [
            e.title,
            s ? String(s.checked_in) : "—",
            s ? String(s.total) : "—",
            s ? `${pct}%` : "—",
          ];
        })}
        emptyTitle="Belum ada event published"
      />
    </div>
  );
}
