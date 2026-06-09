"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DataTable, TableLoading } from "@/components/admin/data-table";
import { FilterTabs } from "@/components/admin/filter-tabs";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { StatusPill } from "@/components/admin/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import {
  adminBookingStatusLabel,
  adminBookingStatusTone,
} from "@/lib/admin-labels";
import { api, AdminBooking, formatDate, formatIDR } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

const PER_PAGE = 20;

const statusFilters = [
  { value: "", label: "Semua" },
  { value: "held", label: "Ditahan" },
  { value: "pending_payment", label: "Menunggu bayar" },
  { value: "confirmed", label: "Lunas" },
  { value: "cancelled", label: "Dibatalkan" },
  { value: "expired", label: "Kedaluwarsa" },
];

export default function AdminBookingsPage() {
  const { accessToken } = useAuthStore();
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    api
      .adminListBookings(accessToken, { status: statusFilter || undefined, page })
      .then((res) => {
        setBookings(res.data);
        setTotal(res.meta?.total ?? res.data.length);
      })
      .catch(() => {
        setBookings([]);
        setTotal(0);
        setError("Gagal memuat daftar booking");
      })
      .finally(() => setLoading(false));
  }, [accessToken, statusFilter, page]);

  return (
    <div>
      <PageHeader
        title="Semua Booking"
        description="Pantau transaksi dan status pembayaran"
      />

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
        <TableLoading label="Memuat booking..." />
      ) : bookings.length === 0 ? (
        <EmptyState
          title="Tidak ada booking"
          description="Tidak ada transaksi untuk filter yang dipilih."
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
                <th className="px-4 py-3 font-semibold text-stone-600">Pembeli</th>
                <th className="px-4 py-3 font-semibold text-stone-600">Event</th>
                <th className="px-4 py-3 font-semibold text-stone-600">Status</th>
                <th className="px-4 py-3 font-semibold text-stone-600">Total</th>
                <th className="px-4 py-3 font-semibold text-stone-600">Tanggal</th>
                <th className="px-4 py-3 font-semibold text-stone-600"></th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
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
                  <td className="px-4 py-3.5 text-stone-500">{formatDate(b.created_at)}</td>
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
    </div>
  );
}
