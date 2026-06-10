"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { SimpleTable } from "@/components/admin/simple-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, AdminEvent, EventStaffRow, OrganizerUser } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export default function AdminStaffPage() {
  const { accessToken } = useAuthStore();
  const [staff, setStaff] = useState<EventStaffRow[]>([]);
  const [gateStaff, setGateStaff] = useState<OrganizerUser[]>([]);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [eventId, setEventId] = useState("");
  const [userId, setUserId] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");

  function load() {
    if (!accessToken) return;
    api.adminListStaff(accessToken).then(setStaff).catch(() => setStaff([]));
    api.adminListGateStaff(accessToken).then(setGateStaff).catch(() => setGateStaff([]));
    api.adminListEvents(accessToken).then((r) => setEvents(r.data)).catch(() => setEvents([]));
  }

  useEffect(() => { load(); }, [accessToken]);

  async function assign(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || !eventId || !userId) return;
    await api.adminAssignStaff(accessToken, eventId, userId);
    load();
  }

  async function createGateStaff(e: FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    await api.adminCreateGateStaff(accessToken, { email: newEmail, full_name: newName, password: newPassword });
    setNewEmail("");
    setNewName("");
    setNewPassword("");
    load();
  }

  return (
    <div className="space-y-10">
      <div>
        <PageHeader title="Gate Staff" description="Akun scanner + penugasan per event" />
        <form onSubmit={createGateStaff} className="mb-4 grid gap-3 rounded-2xl border border-(--border) bg-white p-4 sm:grid-cols-3">
          <Input placeholder="Email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
          <Input placeholder="Nama" value={newName} onChange={(e) => setNewName(e.target.value)} required />
          <Input placeholder="Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          <div className="sm:col-span-3"><Button type="submit">Buat Gate Staff</Button></div>
        </form>
        <SimpleTable
          headers={["Nama", "Email"]}
          rows={gateStaff.map((g) => [g.full_name, g.email])}
          emptyTitle="Belum ada gate staff"
        />
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold">Penugasan Event</h2>
        <form onSubmit={assign} className="mb-4 flex flex-wrap gap-3 rounded-2xl border border-(--border) bg-white p-4">
          <select className="h-11 rounded-(--radius) border px-3 text-sm" value={eventId} onChange={(e) => setEventId(e.target.value)} required>
            <option value="">Pilih event</option>
            {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
          </select>
          <select className="h-11 rounded-(--radius) border px-3 text-sm" value={userId} onChange={(e) => setUserId(e.target.value)} required>
            <option value="">Pilih gate staff</option>
            {gateStaff.map((g) => <option key={g.id} value={g.id}>{g.full_name}</option>)}
          </select>
          <Button type="submit">Assign</Button>
        </form>
        <SimpleTable
          headers={["Event", "Staff", "Email", ""]}
          rows={staff.map((s) => [
            s.event_title,
            s.user_name,
            s.user_email,
            <button key={s.id} type="button" className="text-red-600 text-sm" onClick={() => accessToken && api.adminRemoveStaff(accessToken, s.id).then(load)}>Hapus</button>,
          ])}
          emptyTitle="Belum ada penugasan"
        />
      </div>
    </div>
  );
}
