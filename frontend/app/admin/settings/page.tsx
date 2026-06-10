"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export default function AdminSettingsPage() {
  const { accessToken } = useAuthStore();
  const [supportEmail, setSupportEmail] = useState("");
  const [holdMinutes, setHoldMinutes] = useState("10");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    api
      .adminGetSettings(accessToken)
      .then((s) => {
        const g = s.general as Record<string, unknown> | undefined;
        if (g?.support_email) setSupportEmail(String(g.support_email));
        if (g?.hold_ttl_minutes) setHoldMinutes(String(g.hold_ttl_minutes));
      })
      .finally(() => setLoading(false));
  }, [accessToken]);

  async function save() {
    if (!accessToken) return;
    setMessage("");
    try {
      await api.adminUpdateSettings(accessToken, "general", {
        support_email: supportEmail,
        hold_ttl_minutes: Number(holdMinutes),
        brand_name: "Eventra",
        maintenance_mode: false,
      });
      setMessage("Pengaturan disimpan");
    } catch {
      setMessage("Gagal menyimpan");
    }
  }

  if (loading) return <p className="text-stone-500">Memuat...</p>;

  return (
    <div>
      <PageHeader title="Pengaturan" description="Konfigurasi platform" />
      <div className="max-w-lg space-y-4 rounded-2xl border border-(--border) bg-white p-6">
        <Input label="Email support" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} />
        <Input label="Hold TTL (menit)" type="number" value={holdMinutes} onChange={(e) => setHoldMinutes(e.target.value)} />
        {message && <p className="text-sm text-stone-600">{message}</p>}
        <Button onClick={save}>Simpan</Button>
      </div>
    </div>
  );
}
