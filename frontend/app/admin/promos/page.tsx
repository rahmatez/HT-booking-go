"use client";

import { FormEvent, useEffect, useState } from "react";
import { TableLoading } from "@/components/admin/data-table";
import { SimpleTable } from "@/components/admin/simple-table";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, formatDate, PromoCode } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export default function AdminPromosPage() {
  const { accessToken } = useAuthStore();
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [value, setValue] = useState("10");

  function load() {
    if (!accessToken) return;
    api.adminListPromos(accessToken).then(setPromos).catch(() => setPromos([])).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [accessToken]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    const now = new Date();
    const later = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    await api.adminCreatePromo(accessToken, {
      code: code.toUpperCase(),
      discount_type: "percent",
      discount_value: Number(value),
      valid_from: now.toISOString(),
      valid_until: later.toISOString(),
    });
    setCode("");
    load();
  }

  return (
    <div>
      <PageHeader title="Promo & Voucher" description="Kode diskon" />
      <form onSubmit={handleCreate} className="mb-6 flex flex-wrap gap-3 rounded-2xl border border-(--border) bg-white p-4">
        <Input placeholder="Kode promo" value={code} onChange={(e) => setCode(e.target.value)} required />
        <Input placeholder="Diskon %" type="number" value={value} onChange={(e) => setValue(e.target.value)} className="w-28" />
        <Button type="submit">Tambah</Button>
      </form>
      {loading ? (
        <TableLoading label="Memuat promo..." />
      ) : (
        <SimpleTable
          headers={["Kode", "Diskon", "Terpakai", "Berlaku hingga"]}
          rows={promos.map((p) => [
            p.code,
            `${p.discount_value}${p.discount_type === "percent" ? "%" : ""}`,
            `${p.used_count}${p.max_uses ? ` / ${p.max_uses}` : ""}`,
            formatDate(p.valid_until),
          ])}
          emptyTitle="Belum ada promo"
        />
      )}
    </div>
  );
}
