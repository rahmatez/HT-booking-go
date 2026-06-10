"use client";

import { useEffect, useState } from "react";
import { TableLoading } from "@/components/admin/data-table";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { api, AdminEvent, formatDate } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export default function AdminModerationPage() {
  const { accessToken } = useAuthStore();
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  function load() {
    if (!accessToken) return;
    api.adminListModeration(accessToken)
      .then((res) => setEvents(res.data))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [accessToken]);

  async function moderate(id: string, action: "approve" | "reject") {
    if (!accessToken) return;
    setActing(id);
    try {
      await api.adminModerateEvent(accessToken, id, action);
      load();
    } finally {
      setActing(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Moderasi Event"
        description="Setujui atau tolak event draft dari organizer"
      />
      {loading ? (
        <TableLoading label="Memuat event draft..." />
      ) : events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-8 py-16 text-center text-stone-500">
          Tidak ada event menunggu moderasi.
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((e) => (
            <div
              key={e.id}
              className="flex flex-col gap-4 rounded-2xl border border-(--border) bg-white p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <h3 className="font-semibold text-stone-900">{e.title}</h3>
                <p className="mt-1 text-sm text-stone-500">
                  {e.venue_city || "—"} · {formatDate(e.starts_at)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={acting === e.id}
                  onClick={() => moderate(e.id, "approve")}
                >
                  Setujui
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={acting === e.id}
                  onClick={() => moderate(e.id, "reject")}
                >
                  Tolak
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
