"use client";

import { useEffect, useState } from "react";
import { TableLoading } from "@/components/admin/data-table";
import { SimpleTable } from "@/components/admin/simple-table";
import { FilterTabs } from "@/components/admin/filter-tabs";
import { PageHeader } from "@/components/admin/page-header";
import { StatusPill } from "@/components/admin/status-pill";
import { api, AdminPayment, formatDate, formatIDR } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

const filters = [
  { value: "", label: "Semua" },
  { value: "pending", label: "Pending" },
  { value: "success", label: "Sukses" },
  { value: "failed", label: "Gagal" },
  { value: "refunded", label: "Refund" },
];

export default function AdminPaymentsPage() {
  const { accessToken } = useAuthStore();
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    api
      .adminListPayments(accessToken, { status: status || undefined })
      .then((res) => setPayments(res.data))
      .catch(() => setPayments([]))
      .finally(() => setLoading(false));
  }, [accessToken, status]);

  return (
    <div>
      <PageHeader title="Pembayaran" description="Transaksi gateway & status Midtrans" />
      <FilterTabs options={filters} value={status} onChange={setStatus} />
      {loading ? (
        <TableLoading label="Memuat pembayaran..." />
      ) : (
        <SimpleTable
          headers={["Event", "Pembeli", "Jumlah", "Status", "Tanggal"]}
          rows={payments.map((p) => [
            p.event_title,
            p.user_email,
            formatIDR(p.amount),
            <StatusPill key={p.id} label={p.status} toneClass={p.status === "success" ? "bg-green-100 text-green-800" : p.status === "failed" ? "bg-red-100 text-red-800" : "bg-stone-100 text-stone-600"} />,
            formatDate(p.created_at),
          ])}
          emptyTitle="Belum ada transaksi"
        />
      )}
    </div>
  );
}
