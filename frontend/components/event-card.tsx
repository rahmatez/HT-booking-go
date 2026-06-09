import Link from "next/link";
import { Event, formatEventDate, formatIDR } from "@/lib/api";

type Props = {
  event: Event;
  minPrice?: number;
};

const coverGradients = [
  "from-stone-800 via-stone-700 to-orange-900",
  "from-teal-900 via-teal-800 to-emerald-800",
  "from-amber-900 via-orange-800 to-red-900",
  "from-rose-950 via-rose-900 to-orange-950",
];

function pickGradient(slug: string) {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) hash = slug.charCodeAt(i) + ((hash << 5) - hash);
  return coverGradients[Math.abs(hash) % coverGradients.length];
}

export function EventCard({ event, minPrice }: Props) {
  const date = formatEventDate(event.starts_at);
  const gradient = pickGradient(event.slug);

  return (
    <Link
      href={`/events/${event.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-(--border) bg-white shadow-(--shadow-sm) transition duration-300 hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-(--shadow-md)"
    >
      <div className={`relative flex min-h-[168px] flex-col justify-between bg-linear-to-br ${gradient} p-5 text-white`}>
        <div className="flex items-start justify-between gap-3">
          <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold backdrop-blur-sm">
            {event.venue_city || "Indonesia"}
          </span>
          <div className="shrink-0 rounded-xl bg-white/15 px-3 py-2 text-center backdrop-blur-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wider opacity-90">
              {date.month}
            </p>
            <p className="text-2xl font-bold leading-none">{date.day}</p>
          </div>
        </div>
        <h3 className="mt-4 text-lg font-bold leading-snug tracking-tight group-hover:underline decoration-white/40 underline-offset-4">
          {event.title}
        </h3>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="space-y-1 text-sm">
          <p className="font-medium text-stone-800">
            {date.weekday}, {date.time} WIB
          </p>
          {event.venue_name && (
            <p className="line-clamp-1 text-stone-500">{event.venue_name}</p>
          )}
        </div>
        <div className="mt-auto flex items-center justify-between border-t border-(--border) pt-4">
          {minPrice !== undefined ? (
            <div>
              <p className="text-xs text-stone-400">Mulai dari</p>
              <p className="font-bold text-(--accent)">{formatIDR(minPrice)}</p>
            </div>
          ) : (
            <p className="text-sm font-medium text-stone-500">Lihat detail</p>
          )}
          <span className="text-sm font-semibold text-stone-400 transition group-hover:translate-x-0.5 group-hover:text-(--accent)">
            →
          </span>
        </div>
      </div>
    </Link>
  );
}
