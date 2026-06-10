"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TableLoading } from "@/components/admin/data-table";
import { SimpleTable } from "@/components/admin/simple-table";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { api, AdminBooking, formatDate, formatIDR } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export default function AdminRefundsPage() {
  const { accessToken } = useAuthStore();
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  function load() {
    if (!accessToken) return;
    api
      .adminListBookings(accessToken, { status: "confirmed" })
      .then((res) => setBookings(res.data))
      .catch(() => setBookings([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [accessToken]);

  async function refund(id: string) {
    if (!accessToken || !confirm("Proses refund untuk booking ini?")) return;
    try {
      await api.adminRefundBooking(accessToken, id);
      setMsg("Refund berhasil");
      load();
    } catch {
      setMsg("Refund gagal");
    }
  }

  return (
    <div>
      <PageHeader title="Refund" description="Pantau & proses refund booking" />
      {msg && <p className="mb-4 text-sm text-stone-600">{msg}</p>}
      {loading ? (
        <TableLoading label="Memuat booking..." />
      ) : (
        <SimpleTable
          headers={["Event", "Pembeli", "Total", "Tanggal", ""]}
          rows={bookings.map((b) => [
            b.event_title,
            b.user_email,
            formatIDR(b.total_amount),
            formatDate(b.created_at),
            <div key={b.id} className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => refund(b.id)}>Refund</Button>
              <Link href={`/admin/bookings/${b.id}`} className="text-sm text-(--accent)">Detail</Link>
            </div>,
          ])}
          emptyTitle="Tidak ada booking confirmed"
        />
      )}
    </div>
  );
}
