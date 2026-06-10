"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { SimpleTable } from "@/components/admin/simple-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, OrganizerUser } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export default function AdminOrganizersPage() {
  const { accessToken } = useAuthStore();
  const [orgs, setOrgs] = useState<OrganizerUser[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [payoutOrgId, setPayoutOrgId] = useState<string | null>(null);
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState("");

  function load() {
    if (!accessToken) return;
    api.adminListOrganizers(accessToken).then(setOrgs).catch(() => setOrgs([]));
  }

  useEffect(() => { load(); }, [accessToken]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    await api.adminCreateOrganizer(accessToken, { email, full_name: name, password });
    setEmail("");
    setName("");
    setPassword("");
    load();
  }

  async function openPayout(orgId: string) {
    setPayoutOrgId(orgId);
    if (!accessToken) return;
    const acc = await api.adminGetOrganizerPayout(accessToken, orgId).catch(() => ({
      bank_name: "",
      account_number: "",
      account_holder: "",
    }));
    setBankName(acc.bank_name || "");
    setAccountNumber(acc.account_number || "");
    setAccountHolder(acc.account_holder || "");
  }

  async function savePayout(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || !payoutOrgId) return;
    await api.adminUpsertOrganizerPayout(accessToken, payoutOrgId, {
      bank_name: bankName,
      account_number: accountNumber,
      account_holder: accountHolder,
    });
    setPayoutOrgId(null);
  }

  return (
    <div>
      <PageHeader title="Organizer" description="Kelola penyelenggara event & rekening payout" />
      <form onSubmit={handleCreate} className="mb-6 grid gap-3 rounded-2xl border border-(--border) bg-white p-4 sm:grid-cols-3">
        <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input placeholder="Nama" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <div className="sm:col-span-3"><Button type="submit">Tambah Organizer</Button></div>
      </form>

      {payoutOrgId && (
        <form onSubmit={savePayout} className="mb-6 grid gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:grid-cols-3">
          <p className="sm:col-span-3 text-sm font-semibold text-amber-900">Rekening payout</p>
          <Input placeholder="Nama bank" value={bankName} onChange={(e) => setBankName(e.target.value)} required />
          <Input placeholder="No. rekening" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} required />
          <Input placeholder="Atas nama" value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} required />
          <div className="flex gap-2 sm:col-span-3">
            <Button type="submit">Simpan Rekening</Button>
            <Button type="button" variant="secondary" onClick={() => setPayoutOrgId(null)}>Batal</Button>
          </div>
        </form>
      )}

      <SimpleTable
        headers={["Nama", "Email", "Event", ""]}
        rows={orgs.map((o) => [
          o.full_name,
          o.email,
          String(o.event_count ?? 0),
          <button key={o.id} type="button" className="text-sm text-(--accent)" onClick={() => openPayout(o.id)}>
            Rekening
          </button>,
        ])}
        emptyTitle="Belum ada organizer"
      />
    </div>
  );
}
