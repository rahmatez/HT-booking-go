"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { TableLoading } from "@/components/admin/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, Venue, VenueInput } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export default function AdminVenuesPage() {
  const { accessToken } = useAuthStore();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<VenueInput>({
    name: "",
    address: "",
    city: "",
    capacity: 1000,
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = () => {
    if (!accessToken) return;
    setLoading(true);
    api
      .adminListVenues(accessToken)
      .then(setVenues)
      .catch(() => setError("Gagal memuat daftar venue"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [accessToken]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setError("");
    setMessage("");
    setSaving(true);
    try {
      await api.adminCreateVenue(accessToken, form);
      setMessage("Venue berhasil ditambahkan");
      setForm({ name: "", address: "", city: "", capacity: 1000 });
      load();
    } catch {
      setError("Gagal menambah venue");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Kelola Venue"
        description="Tambahkan lokasi untuk event Anda"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-(--border) bg-white p-6 shadow-(--shadow-sm)"
        >
          <h2 className="font-semibold text-stone-900">Tambah Venue</h2>
          <Input
            label="Nama venue"
            placeholder="Gelora Bung Karno"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Input
            label="Alamat"
            placeholder="Jl. ..."
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            required
          />
          <Input
            label="Kota"
            placeholder="Jakarta"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            required
          />
          <Input
            label="Kapasitas"
            type="number"
            value={form.capacity}
            onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
            required
          />
          {message && (
            <p className="rounded-lg bg-(--success-soft) px-3 py-2 text-sm text-(--success)">
              {message}
            </p>
          )}
          {error && (
            <p className="rounded-lg bg-(--danger-soft) px-3 py-2 text-sm text-(--danger)">
              {error}
            </p>
          )}
          <Button type="submit" disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan Venue"}
          </Button>
        </form>

        <div className="rounded-2xl border border-(--border) bg-white p-6 shadow-(--shadow-sm)">
          <h2 className="mb-4 font-semibold text-stone-900">
            Daftar Venue
            {!loading && (
              <span className="ml-2 text-sm font-normal text-stone-400">({venues.length})</span>
            )}
          </h2>
          {loading ? (
            <TableLoading label="Memuat venue..." />
          ) : venues.length === 0 ? (
            <p className="text-sm text-stone-500">
              Belum ada venue. Tambahkan venue pertama di form sebelah kiri.
            </p>
          ) : (
            <ul className="max-h-[480px] space-y-3 overflow-y-auto pr-1">
              {venues.map((v) => (
                <li
                  key={v.id}
                  className="rounded-xl border border-(--border) bg-stone-50/50 p-4 text-sm"
                >
                  <p className="font-semibold text-stone-900">{v.name}</p>
                  <p className="mt-0.5 text-stone-600">
                    {v.address}, {v.city}
                  </p>
                  <p className="mt-1 text-xs text-stone-400">
                    Kapasitas: {v.capacity.toLocaleString("id-ID")} orang
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
