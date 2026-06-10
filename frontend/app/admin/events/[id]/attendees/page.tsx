"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { SimpleTable } from "@/components/admin/simple-table";
import { Spinner } from "@/components/ui/spinner";
import { api, AttendeeRow, formatDate } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export default function EventAttendeesPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken } = useAuthStore();
  const [rows, setRows] = useState<AttendeeRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken || !id) return;
    api.adminListAttendees(accessToken, id).then(setRows).finally(() => setLoading(false));
  }, [accessToken, id]);

  return (
    <div>
      <Link href={`/admin/events/${id}/edit`} className="text-sm text-stone-500 hover:text-(--accent)">
        ← Kembali ke event
      </Link>
      <PageHeader
        title="Daftar Tamu"
        description="Pemegang tiket confirmed"
        action={
          accessToken ? (
            <a
              href={`${api.adminExportAttendeesUrl(id)}`}
              className="text-sm font-semibold text-(--accent) hover:underline"
              onClick={(e) => {
                e.preventDefault();
                fetch(api.adminExportAttendeesUrl(id), {
                  headers: { Authorization: `Bearer ${accessToken}` },
                }).then((r) => r.blob()).then((blob) => {
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `attendees-${id}.csv`;
                  a.click();
                });
              }}
            >
              Export CSV
            </a>
          ) : undefined
        }
      />
      {loading ? (
        <Spinner />
      ) : (
        <SimpleTable
          headers={["Kode", "Nama", "Email", "Tipe", "Check-in"]}
          rows={rows.map((r) => [
            r.ticket_code,
            r.user_name,
            r.user_email,
            r.ticket_type,
            r.checked_in_at ? formatDate(r.checked_in_at) : "—",
          ])}
          emptyTitle="Belum ada tamu"
        />
      )}
    </div>
  );
}
