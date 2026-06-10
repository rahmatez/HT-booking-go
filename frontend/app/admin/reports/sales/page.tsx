"use client";

import { useEffect, useState } from "react";
import { TableLoading } from "@/components/admin/data-table";
import { SimpleTable } from "@/components/admin/simple-table";
import { PageHeader } from "@/components/admin/page-header";
import { api, formatIDR, SalesReportRow } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export default function AdminSalesReportPage() {
  const { accessToken } = useAuthStore();
  const [rows, setRows] = useState<SalesReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    api
      .adminSalesReport(accessToken)
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [accessToken]);

  return (
    <div>
      <PageHeader title="Laporan Penjualan" description="Revenue per event" />
      {loading ? (
        <TableLoading label="Memuat laporan..." />
      ) : (
        <SimpleTable
          headers={["Event", "Tiket terjual", "Booking", "Revenue"]}
          rows={rows.map((r) => [
            r.event_title,
            String(r.tickets_sold),
            String(r.booking_count),
            formatIDR(r.revenue),
          ])}
          emptyTitle="Belum ada data penjualan"
        />
      )}
    </div>
  );
}
