"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { SimpleTable } from "@/components/admin/simple-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, OrganizerUser, SettlementRow, formatIDR } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export default function AdminSettlementsPage() {
  const { accessToken } = useAuthStore();
  const [rows, setRows] = useState<SettlementRow[]>([]);
  const [orgs, setOrgs] = useState<OrganizerUser[]>([]);
  const [organizerId, setOrganizerId] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [feePercent, setFeePercent] = useState("10");
  const [dlqSize, setDlqSize] = useState(0);

  function load() {
    if (!accessToken) return;
    api.adminListSettlements(accessToken).then(setRows).catch(() => setRows([]));
    api.adminListOrganizers(accessToken).then(setOrgs).catch(() => setOrgs([]));
    api.adminQueueDLQStats(accessToken).then((s) => setDlqSize(s.dlq_size)).catch(() => {});
  }

  useEffect(() => { load(); }, [accessToken]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    await api.adminCreateSettlement(accessToken, {
      organizer_id: organizerId,
      period_start: periodStart,
      period_end: periodEnd,
      fee_percent: Number(feePercent),
    });
    load();
  }

  return (
    <div>
      <PageHeader title="Settlement" description="Rekonsiliasi payout ke organizer" />
      {dlqSize > 0 && (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {dlqSize} job gagal di dead-letter queue — periksa log backend.
        </p>
      )}
      <form onSubmit={handleCreate} className="mb-6 grid gap-3 rounded-2xl border border-(--border) bg-white p-4 sm:grid-cols-2">
        <select className="h-11 rounded-(--radius) border px-3 text-sm" value={organizerId} onChange={(e) => setOrganizerId(e.target.value)} required>
          <option value="">Organizer</option>
          {orgs.map((o) => <option key={o.id} value={o.id}>{o.full_name}</option>)}
        </select>
        <Input type="number" placeholder="Fee platform %" value={feePercent} onChange={(e) => setFeePercent(e.target.value)} />
        <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} required />
        <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} required />
        <div className="sm:col-span-2"><Button type="submit">Generate Settlement</Button></div>
      </form>
      <SimpleTable
        headers={["Organizer", "Periode", "Gross", "Net", "Status", ""]}
        rows={rows.map((s) => [
          s.organizer_name,
          `${s.period_start} – ${s.period_end}`,
          formatIDR(s.gross_revenue),
          formatIDR(s.net_payout),
          s.status,
          s.status === "pending" ? (
            <button key={s.id} type="button" className="text-sm text-(--accent)" onClick={() => accessToken && api.adminMarkSettlementPaid(accessToken, s.id).then(load)}>
              Tandai dibayar
            </button>
          ) : "—",
        ])}
        emptyTitle="Belum ada settlement"
      />
    </div>
  );
}
