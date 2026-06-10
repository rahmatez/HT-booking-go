"use client";

import { useEffect, useState } from "react";
import { TableLoading } from "@/components/admin/data-table";
import { SimpleTable } from "@/components/admin/simple-table";
import { PageHeader } from "@/components/admin/page-header";
import { Input } from "@/components/ui/input";
import { api, AdminUser, formatDate } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export default function AdminUsersPage() {
  const { accessToken } = useAuthStore();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    api
      .adminListUsers(accessToken, { q: query || undefined })
      .then((res) => setUsers(res.data))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, [accessToken, query]);

  return (
    <div>
      <PageHeader title="Pengguna" description="Daftar akun terdaftar" />
      <div className="mb-5 max-w-md">
        <Input placeholder="Cari email atau nama..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {loading ? (
        <TableLoading label="Memuat pengguna..." />
      ) : (
        <SimpleTable
          headers={["Nama", "Email", "Role", "Verifikasi", "Daftar"]}
          rows={users.map((u) => [
            u.full_name,
            u.email,
            u.role,
            u.email_verified_at ? "✓" : "—",
            formatDate(u.created_at),
          ])}
        />
      )}
    </div>
  );
}
