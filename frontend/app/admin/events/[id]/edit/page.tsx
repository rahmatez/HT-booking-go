"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { EventForm } from "@/components/admin/event-form";
import { PageHeader } from "@/components/admin/page-header";
import { Spinner } from "@/components/ui/spinner";
import { api, AdminEventDetail, AdminTicketType } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export default function AdminEditEventPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken } = useAuthStore();
  const [event, setEvent] = useState<AdminEventDetail | null>(null);
  const [ticketTypes, setTicketTypes] = useState<AdminTicketType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!accessToken || !id) return;
    api
      .adminGetEvent(accessToken, id)
      .then((res) => {
        setEvent(res.event);
        setTicketTypes(res.ticket_types);
      })
      .catch(() => setLoadError("Gagal memuat event"))
      .finally(() => setLoading(false));
  }, [accessToken, id]);

  if (!accessToken) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-stone-500">
        <Spinner />
        <span className="text-sm">Memuat event...</span>
      </div>
    );
  }

  if (loadError || !event) {
    return (
      <p className="rounded-xl border border-red-200 bg-(--danger-soft) px-4 py-3 text-sm text-red-700">
        {loadError || "Event tidak ditemukan"}
      </p>
    );
  }

  return (
    <div>
      <Link
        href="/admin/events"
        className="text-sm font-medium text-stone-500 hover:text-(--accent)"
      >
        ← Kembali ke daftar event
      </Link>
      <PageHeader
        title="Edit Event"
        description={event.title}
        action={
          event.slug ? (
            <Link
              href={`/events/${event.slug}`}
              target="_blank"
              className="text-sm font-semibold text-(--accent) hover:underline"
            >
              Lihat di situs →
            </Link>
          ) : undefined
        }
      />
      <EventForm
        token={accessToken}
        eventId={id}
        initialEvent={event}
        initialTicketTypes={ticketTypes}
        onSaved={() => {
          api.adminGetEvent(accessToken, id).then((res) => {
            setEvent(res.event);
            setTicketTypes(res.ticket_types);
          });
        }}
      />
    </div>
  );
}
