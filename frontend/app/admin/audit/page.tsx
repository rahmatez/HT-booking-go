"use client";

import { useEffect, useState } from "react";
import { TableLoading } from "@/components/admin/data-table";
import { SimpleTable } from "@/components/admin/simple-table";
import { PageHeader } from "@/components/admin/page-header";
import { api, AuditLogEntry, formatDate } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export default function AdminAuditPage() {
  const { accessToken } = useAuthStore();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    api
      .adminListAudit(accessToken)
      .then((res) => setLogs(res.data))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [accessToken]);

  return (
    <div>
      <PageHeader title="Audit Log" description="Jejak aksi admin" />
      {loading ? (
        <TableLoading label="Memuat log..." />
      ) : (
        <SimpleTable
          headers={["Aksi", "Entitas", "Actor", "Waktu"]}
          rows={logs.map((l) => [
            l.action,
            `${l.entity_type} · ${l.entity_id.slice(0, 8)}…`,
            l.actor_id?.slice(0, 8) ?? "—",
            formatDate(l.created_at),
          ])}
          emptyTitle="Belum ada log"
        />
      )}
    </div>
  );
}
