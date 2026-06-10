"use client";

import { EventCard } from "@/components/event-card";
import { Event } from "@/lib/api";

type Props = {
  events: Event[];
};

export function EventScrollRow({ events }: Props) {
  if (events.length === 0) return null;

  return (
    <>
      {/* Mobile: horizontal scroll, kartu kecil */}
      <div className="hide-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 md:hidden">
        {events.map((event) => (
          <div key={event.id} className="w-[168px] shrink-0">
            <EventCard event={event} />
          </div>
        ))}
      </div>

      {/* Desktop: grid biasa, tidak oversized */}
      <div className="hidden gap-4 md:grid md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {events.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </>
  );
}
