"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  api,
  AdminEventDetail,
  AdminEventInput,
  AdminTicketType,
  AdminTicketTypeInput,
  Venue,
  formatIDR,
} from "@/lib/api";
import { fromDatetimeLocal, toDatetimeLocal } from "@/lib/admin-utils";

const fieldClass =
  "h-11 w-full rounded-(--radius) border border-(--border-strong) bg-white px-3.5 text-sm text-stone-900 outline-none transition focus:border-(--accent) focus:ring-2 focus:ring-(--accent-ring)";

type Props = {
  token: string;
  eventId?: string;
  initialEvent?: AdminEventDetail;
  initialTicketTypes?: AdminTicketType[];
  onSaved?: (eventId: string) => void;
};

export function EventForm({
  token,
  eventId,
  initialEvent,
  initialTicketTypes = [],
  onSaved,
}: Props) {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [ticketTypes, setTicketTypes] = useState(initialTicketTypes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [form, setForm] = useState<AdminEventInput>({
    slug: initialEvent?.slug || "",
    title: initialEvent?.title || "",
    description: initialEvent?.description || "",
    venue_id: initialEvent?.venue_id || "",
    status: initialEvent?.status || "draft",
    starts_at: initialEvent?.starts_at || new Date().toISOString(),
    ends_at: initialEvent?.ends_at || new Date(Date.now() + 3600000).toISOString(),
  });

  const [newTicket, setNewTicket] = useState<AdminTicketTypeInput>({
    name: "Regular",
    price: 100000,
    total_quota: 100,
    max_per_order: 4,
    sales_start_at: new Date().toISOString(),
    sales_end_at: new Date(Date.now() + 30 * 86400000).toISOString(),
  });

  useEffect(() => {
    api.adminListVenues(token).then(setVenues).catch(() => {});
  }, [token]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload: AdminEventInput = {
        ...form,
        venue_id: form.venue_id || undefined,
      };
      if (eventId) {
        await api.adminUpdateEvent(token, eventId, payload);
        setMessage("Event berhasil diperbarui");
        onSaved?.(eventId);
      } else {
        const created = await api.adminCreateEvent(token, payload);
        setMessage("Event berhasil dibuat");
        onSaved?.(created.id);
      }
    } catch {
      setError("Gagal menyimpan event");
    } finally {
      setSaving(false);
    }
  };

  const handleAddTicketType = async () => {
    if (!eventId) {
      setError("Simpan event terlebih dahulu sebelum menambah tipe tiket");
      return;
    }
    try {
      const tt = await api.adminCreateTicketType(token, eventId, newTicket);
      setTicketTypes((prev) => [...prev, tt]);
      setMessage("Tipe tiket ditambahkan");
    } catch {
      setError("Gagal menambah tipe tiket");
    }
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-2xl border border-(--border) bg-white p-6 shadow-(--shadow-sm)"
      >
        <h2 className="text-lg font-semibold text-stone-900">Informasi Event</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input
              label="Judul"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>
          <Input
            label="Slug"
            hint="Opsional — otomatis dari judul jika kosong"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            placeholder="konser-demo-2026"
          />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-stone-700">Status</label>
            <select
              className={fieldClass}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="cancelled">Cancelled</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="block text-sm font-medium text-stone-700">Deskripsi</label>
            <textarea
              className={`${fieldClass} min-h-[100px] py-2.5`}
              rows={4}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-stone-700">Venue</label>
            <select
              className={fieldClass}
              value={form.venue_id || ""}
              onChange={(e) => setForm({ ...form, venue_id: e.target.value })}
            >
              <option value="">— Pilih venue —</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.city})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-stone-700">Mulai</label>
            <input
              type="datetime-local"
              className={fieldClass}
              value={toDatetimeLocal(form.starts_at)}
              onChange={(e) => setForm({ ...form, starts_at: fromDatetimeLocal(e.target.value) })}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-stone-700">Selesai</label>
            <input
              type="datetime-local"
              className={fieldClass}
              value={toDatetimeLocal(form.ends_at)}
              onChange={(e) => setForm({ ...form, ends_at: fromDatetimeLocal(e.target.value) })}
              required
            />
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-(--danger-soft) px-3 py-2 text-sm text-(--danger)">
            {error}
          </p>
        )}
        {message && (
          <p className="rounded-lg bg-(--success-soft) px-3 py-2 text-sm text-(--success)">
            {message}
          </p>
        )}

        <Button type="submit" disabled={saving}>
          {saving ? "Menyimpan..." : eventId ? "Simpan Perubahan" : "Buat Event"}
        </Button>
      </form>

      {eventId && (
        <div className="rounded-2xl border border-(--border) bg-white p-6 shadow-(--shadow-sm)">
          <h2 className="mb-4 text-lg font-semibold text-stone-900">Tipe Tiket</h2>

          {ticketTypes.length > 0 && (
            <ul className="mb-6 space-y-2">
              {ticketTypes.map((tt) => (
                <li
                  key={tt.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-(--border) bg-stone-50/50 px-4 py-3 text-sm"
                >
                  <span className="font-medium text-stone-900">
                    {tt.name} — {formatIDR(tt.price)}
                  </span>
                  <span className="text-stone-500">
                    Kuota: {tt.available ?? tt.total_quota} / {tt.total_quota ?? "?"}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              placeholder="Nama (VIP, Regular)"
              value={newTicket.name}
              onChange={(e) => setNewTicket({ ...newTicket, name: e.target.value })}
            />
            <Input
              type="number"
              placeholder="Harga (IDR)"
              value={newTicket.price}
              onChange={(e) => setNewTicket({ ...newTicket, price: Number(e.target.value) })}
            />
            <Input
              type="number"
              placeholder="Total kuota"
              value={newTicket.total_quota}
              onChange={(e) => setNewTicket({ ...newTicket, total_quota: Number(e.target.value) })}
            />
            <Input
              type="number"
              placeholder="Maks per order"
              value={newTicket.max_per_order}
              onChange={(e) => setNewTicket({ ...newTicket, max_per_order: Number(e.target.value) })}
            />
          </div>
          <Button type="button" variant="secondary" className="mt-4" onClick={handleAddTicketType}>
            + Tambah Tipe Tiket
          </Button>
        </div>
      )}
    </div>
  );
}
