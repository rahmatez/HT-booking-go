"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { EventForm } from "@/components/admin/event-form";
import { Spinner } from "@/components/ui/spinner";
import { api, AdminEventDetail, AdminTicketType } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export default function AdminEditEventPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken } = useAuthStore();
  const [event, setEvent] = useState<AdminEventDetail | null>(null);
  const [ticketTypes, setTicketTypes] = useState<AdminTicketType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken || !id) return;
    api
      .adminGetEvent(accessToken, id)
      .then((res) => {
        setEvent(res.event);
        setTicketTypes(res.ticket_types);
      })
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

  if (!event) {
    return (
      <p className="rounded-xl border border-red-200 bg-(--danger-soft) px-4 py-3 text-sm text-red-700">
        Event tidak ditemukan
      </p>
    );
  }

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <header>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Edit Event</h1>
          <p className="mt-1 text-sm text-stone-500">{event.title}</p>
        </header>
        {event.slug && (
          <Link
            href={`/events/${event.slug}`}
            target="_blank"
            className="text-sm font-semibold text-(--accent) hover:underline"
          >
            Lihat di situs →
          </Link>
        )}
      </div>
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
