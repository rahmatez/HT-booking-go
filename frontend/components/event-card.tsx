import Link from "next/link";
import { Event, formatEventDate, formatIDR } from "@/lib/api";

type Props = {
  event: Event;
  minPrice?: number;
  variant?: "grid" | "horizontal";
};

const coverGradients = [
  "from-[#0057d9] via-[#0066ff] to-[#00b4d8]",
  "from-indigo-700 via-violet-600 to-purple-600",
  "from-sky-700 via-blue-600 to-cyan-600",
  "from-slate-800 via-slate-700 to-blue-900",
];

function pickGradient(slug: string) {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) hash = slug.charCodeAt(i) + ((hash << 5) - hash);
  return coverGradients[Math.abs(hash) % coverGradients.length];
}

export function EventCard({ event, minPrice, variant = "grid" }: Props) {
  const date = formatEventDate(event.starts_at);
  const gradient = pickGradient(event.slug);

  if (variant === "horizontal") {
    return (
      <Link
        href={`/events/${event.slug}`}
        className="group flex overflow-hidden rounded-(--radius) border border-(--border) bg-white transition hover:border-blue-200 hover:shadow-(--shadow-sm)"
      >
        <div className="relative w-24 shrink-0 sm:w-28">
          {event.cover_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={event.cover_image_url}
              alt={event.title}
              className="h-full min-h-[88px] w-full object-cover"
            />
          ) : (
            <div className={`h-full min-h-[88px] bg-linear-to-br ${gradient}`} />
          )}
          <div className="absolute left-1.5 top-1.5 rounded bg-white/95 px-1.5 py-0.5 text-center shadow-sm">
            <p className="text-[8px] font-bold uppercase leading-none text-(--accent)">{date.month}</p>
            <p className="text-xs font-bold leading-none text-slate-900">{date.day}</p>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center px-3 py-2.5">
          <h3 className="line-clamp-2 text-sm font-semibold text-slate-900 group-hover:text-(--accent)">
            {event.title}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            {date.weekday}, {date.time} · {event.venue_city || "Indonesia"}
          </p>
          {event.venue_name && (
            <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">{event.venue_name}</p>
          )}
          {minPrice !== undefined && minPrice > 0 && (
            <p className="mt-1.5 text-xs font-bold text-(--accent)">{formatIDR(minPrice)}</p>
          )}
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/events/${event.slug}`}
      className="group flex flex-col overflow-hidden rounded-(--radius) border border-(--border) bg-white transition hover:border-blue-200 hover:shadow-(--shadow-sm)"
    >
      {/* Poster landscape — proporsi standar marketplace tiket */}
      <div className="relative aspect-16/10 overflow-hidden bg-slate-100">
        {event.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.cover_image_url}
            alt={event.title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className={`h-full w-full bg-linear-to-br ${gradient}`} />
        )}

        <div className="absolute left-2 top-2 rounded bg-white/95 px-1.5 py-1 text-center shadow-sm">
          <p className="text-[8px] font-bold uppercase leading-none text-(--accent)">{date.month}</p>
          <p className="text-sm font-bold leading-none text-slate-900">{date.day}</p>
        </div>

        {event.venue_city && (
          <span className="absolute bottom-2 right-2 rounded bg-black/45 px-1.5 py-0.5 text-[10px] font-medium text-white">
            {event.venue_city}
          </span>
        )}
      </div>

      <div className="p-2.5 sm:p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900 group-hover:text-(--accent)">
          {event.title}
        </h3>
        <p className="mt-1 line-clamp-1 text-xs text-slate-500">
          {date.weekday}, {date.time} WIB
          {event.venue_name ? ` · ${event.venue_name}` : ""}
        </p>
        <div className="mt-2 flex items-center justify-between">
          {minPrice !== undefined && minPrice > 0 ? (
            <p className="text-xs font-bold text-(--accent)">{formatIDR(minPrice)}</p>
          ) : (
            <p className="text-xs text-slate-400">Lihat detail</p>
          )}
        </div>
      </div>
    </Link>
  );
}
