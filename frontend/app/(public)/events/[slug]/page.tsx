import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api, formatDate, formatEventDate, formatIDR } from "@/lib/api";
import { EventDetailClient } from "./event-detail-client";
import { Container } from "@/components/ui/container";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const data = await api.getEvent(slug);
    const desc = data.event.description?.slice(0, 160) || `Beli tiket ${data.event.title} di Eventra`;
    return {
      title: `${data.event.title} | Eventra`,
      description: desc,
      openGraph: {
        title: data.event.title,
        description: desc,
        type: "website",
      },
    };
  } catch {
    return { title: "Event tidak ditemukan | Eventra" };
  }
}

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
    <div className="pb-20 lg:pb-10">
      {/* Hero banner — gaya Loket event page */}
      <div className="relative overflow-hidden bg-slate-900">
        {event.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.cover_image_url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-40"
          />
        ) : (
          <div className="absolute inset-0 bg-linear-to-br from-blue-900 via-blue-800 to-cyan-700" />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-slate-900 via-slate-900/60 to-transparent" />

        <Container wide className="relative py-10 sm:py-14">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              {event.category_name && (
                <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                  {event.category_name}
                </span>
              )}
              <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
                {event.title}
              </h1>
              <div className="mt-5 flex flex-wrap gap-4 text-sm text-slate-200">
                <span className="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <path d="M16 2v4M8 2v4M3 10h18" />
                  </svg>
                  {date.weekday}, {date.day} {date.month} {date.time} WIB
                </span>
                {event.venue_name && (
                  <span className="flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z" />
                      <circle cx="12" cy="10" r="2.5" />
                    </svg>
                    {event.venue_name}
                    {event.venue_city ? `, ${event.venue_city}` : ""}
                  </span>
                )}
              </div>
            </div>
            {minPrice !== undefined && (
              <div className="shrink-0 rounded-lg bg-white px-6 py-4 shadow-lg">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Mulai dari</p>
                <p className="mt-0.5 text-2xl font-bold text-(--accent)">{formatIDR(minPrice)}</p>
              </div>
            )}
          </div>
        </Container>
      </div>

      <Container wide className="mt-8 lg:mt-10">
        <div className="grid gap-8 lg:grid-cols-3 lg:gap-10">
          <div className="lg:col-span-2">
            {event.description && (
              <div className="rounded-lg border border-(--border) bg-white p-6 sm:p-8">
                <h2 className="text-lg font-bold text-slate-900">Deskripsi Event</h2>
                <p className="mt-4 leading-relaxed text-slate-600 whitespace-pre-line">
                  {event.description}
                </p>
              </div>
            )}

            <div className="mt-6 rounded-lg border border-(--border) bg-white p-6">
              <h2 className="text-lg font-bold text-slate-900">Informasi</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between border-b border-(--border) pb-3">
                  <dt className="text-slate-500">Tanggal</dt>
                  <dd className="font-medium text-slate-900">{formatDate(event.starts_at)}</dd>
                </div>
                {event.venue_name && (
                  <div className="flex justify-between border-b border-(--border) pb-3">
                    <dt className="text-slate-500">Lokasi</dt>
                    <dd className="text-right font-medium text-slate-900">
                      {event.venue_name}
                      {event.venue_city && (
                        <span className="block text-slate-500">{event.venue_city}</span>
                      )}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-slate-500">Kebijakan</dt>
                  <dd>
                    <Link href="/refund-policy" className="font-medium text-(--accent) hover:underline">
                      Lihat kebijakan refund
                    </Link>
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-[calc(var(--header-h)+1rem)] rounded-lg border border-(--border) bg-white p-6 shadow-(--shadow-md)">
              <h2 className="text-lg font-bold text-slate-900">Pilih Tiket</h2>
              <p className="mt-1 text-sm text-slate-500">Kuota diperbarui otomatis</p>
              <div className="mt-5">
                <EventDetailClient event={event} ticketTypes={ticket_types} slug={slug} />
              </div>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
