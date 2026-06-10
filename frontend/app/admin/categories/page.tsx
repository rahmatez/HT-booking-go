"use client";

import { FormEvent, useEffect, useState } from "react";
import { TableLoading } from "@/components/admin/data-table";
import { SimpleTable } from "@/components/admin/simple-table";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, EventCategory } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export default function AdminCategoriesPage() {
  const { accessToken } = useAuthStore();
  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);

  function load() {
    if (!accessToken) return;
    api.adminListCategories(accessToken).then(setCategories).catch(() => setCategories([])).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [accessToken]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    if (editId) {
      await api.adminUpdateCategory(accessToken, editId, { slug: slug.toLowerCase(), name });
    } else {
      await api.adminCreateCategory(accessToken, { slug: slug.toLowerCase(), name });
    }
    setSlug("");
    setName("");
    setEditId(null);
    load();
  }

  return (
    <div>
      <PageHeader title="Kategori Event" description="Kelola kategori untuk filter & kurasi homepage" />
      <form onSubmit={handleSubmit} className="mb-6 flex flex-wrap gap-3 rounded-2xl border border-(--border) bg-white p-4">
        <Input placeholder="slug (musik)" value={slug} onChange={(e) => setSlug(e.target.value)} required className="w-40" />
        <Input placeholder="Nama kategori" value={name} onChange={(e) => setName(e.target.value)} required />
        <Button type="submit">{editId ? "Simpan" : "Tambah"}</Button>
        {editId && (
          <Button type="button" variant="secondary" onClick={() => { setEditId(null); setSlug(""); setName(""); }}>
            Batal
          </Button>
        )}
      </form>
      {loading ? (
        <TableLoading label="Memuat kategori..." />
      ) : (
        <SimpleTable
          headers={["Slug", "Nama", ""]}
          rows={categories.map((c) => [
            c.slug,
            c.name,
            <span key={c.id} className="flex gap-2">
              <button type="button" className="text-sm text-(--accent)" onClick={() => { setEditId(c.id); setSlug(c.slug); setName(c.name); }}>
                Edit
              </button>
              <button
                type="button"
                className="text-sm text-red-600"
                onClick={() => accessToken && api.adminDeleteCategory(accessToken, c.id).then(load)}
              >
                Hapus
              </button>
            </span>,
          ])}
          emptyTitle="Belum ada kategori"
        />
      )}
    </div>
  );
}
