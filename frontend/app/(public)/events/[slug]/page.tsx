import { notFound } from "next/navigation";
import { api, formatDate, formatEventDate } from "@/lib/api";
import { EventDetailClient } from "./event-detail-client";
import { Container } from "@/components/ui/container";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let data;
  try {
    data = await api.getEvent(slug);
  } catch {
    notFound();
  }

  const { event, ticket_types } = data;
  const date = formatEventDate(event.starts_at);
  const minPrice = ticket_types.length
    ? Math.min(...ticket_types.map((t) => t.price))
    : undefined;

  return (
    <div className="pb-16">
      <div className="border-b border-(--border) bg-white">
        <Container className="py-10 sm:py-14">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-(--accent)">
                {event.venue_city || "Event"} · {date.weekday}, {date.day} {date.month}
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl lg:text-5xl">
                {event.title}
              </h1>
              {event.venue_name && (
                <p className="mt-4 flex items-center gap-2 text-stone-600">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-stone-400">
                    <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z" />
                    <circle cx="12" cy="10" r="2.5" />
                  </svg>
                  {event.venue_name}
                </p>
              )}
              <p className="mt-2 text-sm text-stone-500">{formatDate(event.starts_at)}</p>
            </div>
            {minPrice !== undefined && (
              <div className="shrink-0 rounded-2xl border border-(--border) bg-background px-6 py-5">
                <p className="text-xs font-medium uppercase tracking-wider text-stone-400">
                  Harga mulai
                </p>
                <p className="mt-1 text-2xl font-bold text-(--accent)">
                  {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(minPrice)}
                </p>
              </div>
            )}
          </div>
        </Container>
      </div>

      <Container className="mt-10">
        <div className="grid gap-10 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {event.description && (
              <div className="mb-10 rounded-2xl border border-(--border) bg-white p-6 sm:p-8">
                <h2 className="text-lg font-semibold text-stone-900">Tentang event</h2>
                <p className="mt-4 leading-relaxed text-stone-600 whitespace-pre-line">
                  {event.description}
                </p>
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-24 rounded-2xl border border-(--border) bg-white p-6 shadow-(--shadow-md)">
              <h2 className="text-lg font-semibold text-stone-900">Pilih tiket</h2>
              <p className="mt-1 text-sm text-stone-500">
                Kuota diperbarui otomatis setiap beberapa detik
              </p>
              <div className="mt-6">
                <EventDetailClient event={event} ticketTypes={ticket_types} slug={slug} />
              </div>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
