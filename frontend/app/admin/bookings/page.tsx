"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { api, AdminBooking, formatDate, formatIDR } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

const statusColors: Record<string, string> = {
  held: "bg-(--warning-soft) text-(--warning)",
  pending_payment: "bg-(--accent-soft) text-(--accent)",
  confirmed: "bg-(--success-soft) text-(--success)",
  cancelled: "bg-stone-100 text-stone-600",
  expired: "bg-(--danger-soft) text-(--danger)",
};

const filters = ["", "held", "pending_payment", "confirmed", "cancelled", "expired"];

export default function AdminBookingsPage() {
  const { accessToken } = useAuthStore();
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    api
      .adminListBookings(accessToken, { status: statusFilter || undefined })
      .then((res) => setBookings(res.data))
      .finally(() => setLoading(false));
  }, [accessToken, statusFilter]);

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">Semua Booking</h1>
        <p className="mt-1 text-sm text-stone-500">Pantau transaksi dan status pembayaran</p>
      </header>

      <div className="mb-5 flex flex-wrap gap-2">
        {filters.map((s) => (
          <button
            key={s || "all"}
            onClick={() => setStatusFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              statusFilter === s
                ? "bg-(--accent) text-white"
                : "border border-(--border-strong) bg-white text-stone-600 hover:bg-stone-50"
            }`}
          >
            {s ? s.replace("_", " ") : "Semua"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-stone-500">
          <Spinner />
          <span className="text-sm">Memuat booking...</span>
        </div>
      ) : bookings.length === 0 ? (
        <p className="text-sm text-stone-500">Tidak ada booking untuk filter ini.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-(--border) bg-white shadow-(--shadow-sm)">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-(--border) bg-stone-50/80">
                <tr>
                  <th className="px-4 py-3 font-semibold text-stone-600">Pembeli</th>
                  <th className="px-4 py-3 font-semibold text-stone-600">Event</th>
                  <th className="px-4 py-3 font-semibold text-stone-600">Status</th>
                  <th className="px-4 py-3 font-semibold text-stone-600">Total</th>
                  <th className="px-4 py-3 font-semibold text-stone-600">Tanggal</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id} className="border-b border-(--border) last:border-0">
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-stone-900">{b.user_name}</p>
                      <p className="text-xs text-stone-500">{b.user_email}</p>
                    </td>
                    <td className="px-4 py-3.5 text-stone-700">{b.event_title}</td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${statusColors[b.status] || "bg-stone-100 text-stone-600"}`}
                      >
                        {b.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-stone-900">{formatIDR(b.total_amount)}</td>
                    <td className="px-4 py-3.5 text-stone-500">{formatDate(b.created_at)}</td>
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
