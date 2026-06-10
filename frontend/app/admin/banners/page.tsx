"use client";

import { FormEvent, useEffect, useState } from "react";
import { TableLoading } from "@/components/admin/data-table";
import { SimpleTable } from "@/components/admin/simple-table";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, HomepageBanner } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export default function AdminBannersPage() {
  const { accessToken } = useAuthStore();
  const [banners, setBanners] = useState<HomepageBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [active, setActive] = useState(true);

  function load() {
    if (!accessToken) return;
    api.adminListBanners(accessToken).then(setBanners).catch(() => setBanners([])).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [accessToken]);

  function resetForm() {
    setEditId(null);
    setTitle("");
    setSubtitle("");
    setImageUrl("");
    setLinkUrl("");
    setActive(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    const data = { title, subtitle, image_url: imageUrl || undefined, link_url: linkUrl || undefined, active };
    if (editId) {
      await api.adminUpdateBanner(accessToken, editId, data);
    } else {
      await api.adminCreateBanner(accessToken, data);
    }
    resetForm();
    load();
  }

  return (
    <div>
      <PageHeader title="Banner Homepage" description="Hero banner di halaman utama" />
      <form onSubmit={handleSubmit} className="mb-6 grid gap-3 rounded-2xl border border-(--border) bg-white p-4 sm:grid-cols-2">
        <Input placeholder="Judul" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <Input placeholder="Subjudul" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
        <Input placeholder="URL gambar" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
        <Input placeholder="Link tujuan (/events)" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Aktif
        </label>
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit">{editId ? "Simpan" : "Tambah Banner"}</Button>
          {editId && <Button type="button" variant="secondary" onClick={resetForm}>Batal</Button>}
        </div>
      </form>
      {loading ? (
        <TableLoading label="Memuat banner..." />
      ) : (
        <SimpleTable
          headers={["Judul", "Aktif", "Link", ""]}
          rows={banners.map((b) => [
            b.title,
            b.active ? "Ya" : "Tidak",
            b.link_url || "—",
            <span key={b.id} className="flex gap-2">
              <button
                type="button"
                className="text-sm text-(--accent)"
                onClick={() => {
                  setEditId(b.id);
                  setTitle(b.title);
                  setSubtitle(b.subtitle || "");
                  setImageUrl(b.image_url || "");
                  setLinkUrl(b.link_url || "");
                  setActive(b.active !== false);
                }}
              >
                Edit
              </button>
              <button
                type="button"
                className="text-sm text-red-600"
                onClick={() => accessToken && api.adminDeleteBanner(accessToken, b.id).then(load)}
              >
                Hapus
              </button>
            </span>,
          ])}
          emptyTitle="Belum ada banner"
        />
      )}
    </div>
  );
}
