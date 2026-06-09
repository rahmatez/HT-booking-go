"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DataTable, TableLoading } from "@/components/admin/data-table";
import { FilterTabs } from "@/components/admin/filter-tabs";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { StatusPill } from "@/components/admin/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { eventStatusLabel, eventStatusTone } from "@/lib/admin-labels";
import { api, AdminEvent, formatDate } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

const PER_PAGE = 20;

const statusFilters = [
  { value: "", label: "Semua" },
  { value: "draft", label: "Draft" },
  { value: "published", label: "Dipublikasi" },
  { value: "cancelled", label: "Dibatalkan" },
];

export default function AdminEventsPage() {
  const { accessToken } = useAuthStore();
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    api
      .adminListEvents(accessToken, {
        status: statusFilter || undefined,
        q: query || undefined,
        page,
      })
      .then((res) => {
        setEvents(res.data);
        setTotal(res.meta?.total ?? res.data.length);
      })
      .catch(() => setError("Gagal memuat daftar event"))
      .finally(() => setLoading(false));
  }, [accessToken, statusFilter, query, page]);

  return (
    <div>
      <PageHeader
        title="Kelola Event"
        description="Buat, edit, dan publikasikan event"
        action={
          <Link href="/admin/events/new">
            <Button>+ Buat Event</Button>
          </Link>
        }
      />

      <div className="mb-5 max-w-md">
        <Input
          placeholder="Cari judul atau slug event..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <FilterTabs
        options={statusFilters}
        value={statusFilter}
        onChange={(v) => {
          setStatusFilter(v);
          setPage(1);
        }}
      />

      {error && (
        <div className="mb-4 rounded-xl bg-(--danger-soft) px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <TableLoading label="Memuat event..." />
      ) : events.length === 0 ? (
        <EmptyState
          title="Belum ada event"
          description={
            query || statusFilter
              ? "Tidak ada event yang cocok dengan filter."
              : "Mulai dengan membuat event pertama Anda."
          }
          actionLabel={!query && !statusFilter ? "Buat Event" : undefined}
          actionHref={!query && !statusFilter ? "/admin/events/new" : undefined}
        />
      ) : (
        <DataTable
          footer={
            <Pagination
              page={page}
              perPage={PER_PAGE}
              total={total}
              onPageChange={setPage}
            />
          }
        >
          <table className="w-full min-w-[720px] text-left text-sm">
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
                <tr
                  key={e.id}
                  className="border-b border-(--border) last:border-0 hover:bg-stone-50/60"
                >
                  <td className="px-4 py-3.5">
                    <p className="font-medium text-stone-900">{e.title}</p>
                    <p className="text-xs text-stone-500">{e.slug}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusPill
                      label={eventStatusLabel[e.status] || e.status}
                      toneClass={eventStatusTone[e.status]}
                    />
                  </td>
                  <td className="px-4 py-3.5 text-stone-600">{formatDate(e.starts_at)}</td>
                  <td className="px-4 py-3.5 text-stone-600">
                    {e.venue_name || "—"}
                    {e.venue_city && (
                      <span className="block text-xs text-stone-400">{e.venue_city}</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {e.status === "published" && (
                        <Link
                          href={`/events/${e.slug}`}
                          target="_blank"
                          className="text-xs font-medium text-stone-500 hover:text-(--accent)"
                        >
                          Lihat
                        </Link>
                      )}
                      <Link
                        href={`/admin/events/${e.id}/edit`}
                        className="font-semibold text-(--accent) hover:underline"
                      >
                        Edit
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
      )}
    </div>
  );
}
