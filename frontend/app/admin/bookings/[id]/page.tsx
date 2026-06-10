"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { StatusPill } from "@/components/admin/status-pill";
import { Spinner } from "@/components/ui/spinner";
import {
  adminBookingStatusLabel,
  adminBookingStatusTone,
} from "@/lib/admin-labels";
import { api, AdminBookingDetail, formatDate, formatIDR } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export default function AdminBookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken } = useAuthStore();
  const [booking, setBooking] = useState<AdminBookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!accessToken || !id) return;
    api
      .adminGetBooking(accessToken, id)
      .then(setBooking)
      .catch(() => setError("Booking tidak ditemukan"))
      .finally(() => setLoading(false));
  }, [accessToken, id]);

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-stone-500">
        <Spinner />
        <span className="text-sm">Memuat booking...</span>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div>
        <Link
          href="/admin/bookings"
          className="text-sm font-medium text-stone-500 hover:text-(--accent)"
        >
          ← Kembali ke daftar booking
        </Link>
        <p className="mt-6 rounded-xl border border-red-200 bg-(--danger-soft) px-4 py-3 text-sm text-red-700">
          {error || "Booking tidak ditemukan"}
        </p>
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/admin/bookings"
        className="text-sm font-medium text-stone-500 hover:text-(--accent)"
      >
        ← Semua Booking
      </Link>

      <PageHeader
        title="Detail Booking"
        description={booking.event_title}
        action={
          booking.event_slug ? (
            <Link
              href={`/events/${booking.event_slug}`}
              target="_blank"
              className="text-sm font-semibold text-(--accent) hover:underline"
            >
              Lihat event →
            </Link>
          ) : undefined
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-2xl border border-(--border) bg-white p-6 shadow-(--shadow-sm)">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400">
              Item Tiket
            </h2>
            <ul className="mt-4 space-y-3">
              {booking.items?.map((item, i) => (
                <li
                  key={`${item.ticket_type_name}-${i}`}
                  className="flex items-center justify-between rounded-xl border border-(--border) bg-stone-50/50 px-4 py-3 text-sm"
                >
                  <span className="font-medium text-stone-900">
                    {item.ticket_type_name} × {item.quantity}
                  </span>
                  <span className="text-stone-600">
                    {formatIDR(item.unit_price * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-center justify-between border-t border-(--border) pt-4">
              <span className="font-semibold text-stone-900">Total</span>
              <span className="text-xl font-bold text-stone-900">
                {formatIDR(booking.total_amount)}
              </span>
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border border-(--border) bg-white p-6 shadow-(--shadow-sm)">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400">Status</h2>
            <div className="mt-3">
              <StatusPill
                label={adminBookingStatusLabel[booking.status] || booking.status}
                toneClass={adminBookingStatusTone[booking.status]}
              />
            </div>
            <p className="mt-4 text-sm text-stone-500">
              Dibuat {formatDate(booking.created_at)}
            </p>
          </section>

          <section className="rounded-2xl border border-(--border) bg-white p-6 shadow-(--shadow-sm)">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400">Pembeli</h2>
            <p className="mt-3 font-semibold text-stone-900">{booking.user_name}</p>
            <p className="mt-1 text-sm text-stone-500">{booking.user_email}</p>
          </section>

          <section className="rounded-2xl border border-(--border) bg-white p-6 shadow-(--shadow-sm)">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400">Pembayaran</h2>
            {booking.payments && booking.payments.length > 0 ? (
              <ul className="mt-4 space-y-3">
                {booking.payments.map((p) => (
                  <li key={p.id} className="rounded-xl border border-(--border) bg-stone-50/50 px-4 py-3 text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium capitalize">{p.status}</span>
                      <span>{formatIDR(p.amount)}</span>
                    </div>
                    <p className="mt-1 text-xs text-stone-500">{p.gateway} · {formatDate(p.created_at)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-stone-500">Belum ada riwayat pembayaran.</p>
            )}
          </section>

          <section className="rounded-2xl border border-(--border) bg-white p-6 shadow-(--shadow-sm)">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400">Referensi</h2>
            <p className="mt-3 break-all font-mono text-xs text-stone-500">{booking.id}</p>
          </section>
        </div>
      </div>
    </div>
  );
}
