"use client";

import { useState } from "react";

type Props = {
  q: string;
  category: string;
  city: string;
  dateFrom: string;
  dateTo: string;
  priceMin?: number;
  priceMax?: number;
};

export function EventsFilterPanel({
  q,
  category,
  city,
  dateFrom,
  dateTo,
  priceMin,
  priceMax,
}: Props) {
  const [open, setOpen] = useState(Boolean(dateFrom || dateTo || priceMin || priceMax));

  return (
    <div className="mb-8">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-sm font-medium text-(--accent) hover:underline"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`transition ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
        Filter lanjutan (tanggal & harga)
      </button>

      {open && (
        <form
          method="get"
          action="/events"
          className="mt-4 grid gap-3 rounded-lg border border-(--border) bg-white p-4 sm:grid-cols-2 lg:grid-cols-5"
        >
          <input type="hidden" name="q" value={q} />
          <input type="hidden" name="category" value={category} />
          <input type="hidden" name="city" value={city} />
          <label className="block text-xs font-medium text-slate-500">
            Dari tanggal
            <input
              name="date_from"
              type="date"
              defaultValue={dateFrom}
              className="mt-1 h-10 w-full rounded-(--radius) border border-(--border) px-3 text-sm"
            />
          </label>
          <label className="block text-xs font-medium text-slate-500">
            Sampai tanggal
            <input
              name="date_to"
              type="date"
              defaultValue={dateTo}
              className="mt-1 h-10 w-full rounded-(--radius) border border-(--border) px-3 text-sm"
            />
          </label>
          <label className="block text-xs font-medium text-slate-500">
            Harga min
            <input
              name="price_min"
              type="number"
              defaultValue={priceMin || ""}
              placeholder="0"
              className="mt-1 h-10 w-full rounded-(--radius) border border-(--border) px-3 text-sm"
            />
          </label>
          <label className="block text-xs font-medium text-slate-500">
            Harga max
            <input
              name="price_max"
              type="number"
              defaultValue={priceMax || ""}
              placeholder="∞"
              className="mt-1 h-10 w-full rounded-(--radius) border border-(--border) px-3 text-sm"
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              className="h-10 w-full rounded-(--radius) bg-(--accent) text-sm font-semibold text-white hover:bg-(--accent-hover)"
            >
              Terapkan
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
