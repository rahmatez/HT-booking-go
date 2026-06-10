"use client";

import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { getValidAccessToken } from "@/lib/auth-client";
import { useAuthStore } from "@/lib/auth-store";

export default function AdminExportsPage() {
  const { accessToken } = useAuthStore();

  async function downloadBookings() {
    const token = await getValidAccessToken(accessToken);
    if (!token) return;
    const res = await fetch(api.adminExportBookingsUrl(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bookings-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader title="Export Data" description="Unduh data booking & penjualan" />
      <div className="rounded-2xl border border-(--border) bg-white p-6">
        <h2 className="font-semibold text-stone-900">Booking</h2>
        <p className="mt-1 text-sm text-stone-500">CSV semua pemesanan</p>
        <Button className="mt-4" onClick={downloadBookings}>
          Unduh CSV Booking
        </Button>
      </div>
    </div>
  );
}
