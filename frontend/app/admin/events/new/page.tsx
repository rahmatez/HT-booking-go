"use client";

import { useRouter } from "next/navigation";
import { EventForm } from "@/components/admin/event-form";
import { useAuthStore } from "@/lib/auth-store";

export default function AdminNewEventPage() {
  const router = useRouter();
  const { accessToken } = useAuthStore();

  if (!accessToken) return null;

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">Buat Event Baru</h1>
        <p className="mt-1 text-sm text-stone-500">Isi detail event, lalu tambahkan tipe tiket</p>
      </header>
      <EventForm
        token={accessToken}
        onSaved={(id) => router.push(`/admin/events/${id}/edit`)}
      />
    </div>
  );
}
