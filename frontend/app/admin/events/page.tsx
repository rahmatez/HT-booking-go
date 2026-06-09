"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { api, AdminEvent, formatDate } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

const statusColors: Record<string, string> = {
  draft: "bg-stone-100 text-stone-700",
  published: "bg-(--success-soft) text-(--success)",
  cancelled: "bg-(--danger-soft) text-(--danger)",
  completed: "bg-blue-50 text-blue-800",
};

export default function AdminEventsPage() {
  const { accessToken } = useAuthStore();
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    api
      .adminListEvents(accessToken, { status: statusFilter || undefined })
      .then((res) => setEvents(res.data))
      .finally(() => setLoading(false));
  }, [accessToken, statusFilter]);

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <header>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Kelola Event</h1>
          <p className="mt-1 text-sm text-stone-500">Buat, edit, dan publikasikan event</p>
        </header>
        <Link
          href="/admin/events/new"
          className="inline-flex h-11 items-center rounded-(--radius) bg-(--accent) px-5 text-sm font-semibold text-white transition hover:bg-(--accent-hover)"
        >
          + Buat Event
        </Link>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {["", "draft", "published", "cancelled"].map((s) => (
          <button
            key={s || "all"}
            onClick={() => setStatusFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition ${
              statusFilter === s
                ? "bg-(--accent) text-white"
                : "border border-(--border-strong) bg-white text-stone-600 hover:bg-stone-50"
            }`}
          >
            {s || "Semua"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-stone-500">
          <Spinner />
          <span className="text-sm">Memuat event...</span>
        </div>
      ) : events.length === 0 ? (
        <p className="text-sm text-stone-500">Belum ada event. Mulai dengan membuat event baru.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-(--border) bg-white shadow-(--shadow-sm)">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-(--border) bg-stone-50/80">
                <tr>
                  <th className="px-4 py-3 font-semibold text-stone-600">Event</th>
                  <th className="px-4 py-3 font-semibold text-stone-600">Status</th>
                  <th className="px-4 py-3 font-semibold text-stone-600">Tanggal</th>
                  <th className="px-4 py-3 font-semibold text-stone-600">Venue</th>
                  <th className="px-4 py-3 font-semibold text-stone-600"></th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-b border-(--border) last:border-0">
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-stone-900">{e.title}</p>
                      <p className="text-xs text-stone-500">{e.slug}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${statusColors[e.status] || ""}`}
                      >
                        {e.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-stone-600">{formatDate(e.starts_at)}</td>
                    <td className="px-4 py-3.5 text-stone-600">
                      {e.venue_name || "—"}
                      {e.venue_city && (
                        <span className="block text-xs text-stone-400">{e.venue_city}</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Link
                        href={`/admin/events/${e.id}/edit`}
                        className="font-semibold text-(--accent) hover:underline"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
