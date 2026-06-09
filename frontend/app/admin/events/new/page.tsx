"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { EventForm } from "@/components/admin/event-form";
import { PageHeader } from "@/components/admin/page-header";
import { useAuthStore } from "@/lib/auth-store";

export default function AdminNewEventPage() {
  const router = useRouter();
  const { accessToken } = useAuthStore();

  if (!accessToken) return null;

  return (
    <div>
      <Link
        href="/admin/events"
        className="text-sm font-medium text-stone-500 hover:text-(--accent)"
      >
        ← Kembali ke daftar event
      </Link>
      <PageHeader
        title="Buat Event Baru"
        description="Isi detail event, lalu tambahkan tipe tiket"
      />
      <EventForm
        token={accessToken}
        onSaved={(id) => router.push(`/admin/events/${id}/edit`)}
      />
    </div>
  );
}
