"use client";

import { FormEvent, useState } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiClientError, CheckInResult } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export default function AdminCheckInPage() {
  const { accessToken } = useAuthStore();
  const [code, setCode] = useState("");
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || !code.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await api.adminCheckIn(accessToken, code.trim());
      setResult(res);
      setCode("");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Scan gagal");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader title="Check-in Scanner" description="Scan QR / masukkan kode tiket" />
      <form onSubmit={handleSubmit} className="max-w-md space-y-4 rounded-2xl border border-(--border) bg-white p-6">
        <Input
          label="Kode tiket"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="EVT-XXXX-XXXX"
          autoFocus
        />
        <Button type="submit" disabled={loading} fullWidth>
          {loading ? "Memvalidasi..." : "Validasi Tiket"}
        </Button>
      </form>
      {error && (
        <div className="mt-4 rounded-xl bg-(--danger-soft) px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {result && (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-4 text-sm text-green-800">
          <p className="font-semibold">{result.message}</p>
          <p className="mt-1">{result.holder_name} · {result.event_title}</p>
          <p className="font-mono text-xs">{result.ticket_code}</p>
        </div>
      )}
    </div>
  );
}
