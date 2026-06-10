"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type Props = {
  defaultQ?: string;
  defaultCity?: string;
  compact?: boolean;
  className?: string;
};

export function EventSearchForm({
  defaultQ = "",
  defaultCity = "",
  compact = false,
  className = "",
}: Props) {
  const router = useRouter();
  const [q, setQ] = useState(defaultQ);
  const [city, setCity] = useState(defaultCity);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (city.trim()) params.set("city", city.trim());
    router.push(`/events${params.toString() ? `?${params}` : ""}`);
  }

  if (compact) {
    return (
      <form onSubmit={onSubmit} className={`flex w-full max-w-xl items-center ${className}`}>
        <div className="flex h-11 w-full items-center overflow-hidden rounded-full border border-(--border) bg-white shadow-(--shadow-sm) focus-within:border-(--accent) focus-within:ring-2 focus-within:ring-(--accent-ring)">
          <span className="pl-4 text-slate-400">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3-3" />
            </svg>
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari event, kota, atau kategori..."
            className="h-full flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-slate-400"
          />
          <button
            type="submit"
            className="mr-1.5 rounded-full bg-(--accent) px-4 py-2 text-xs font-semibold text-white transition hover:bg-(--accent-hover)"
          >
            Cari
          </button>
        </div>
      </form>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className={`rounded-lg border border-(--border) bg-white p-4 shadow-(--shadow-sm) sm:p-5 ${className}`}
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3-3" />
            </svg>
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama event..."
            className="h-12 w-full rounded-(--radius) border border-(--border) bg-slate-50 pl-10 pr-4 text-sm outline-none transition focus:border-(--accent) focus:bg-white focus:ring-2 focus:ring-(--accent-ring)"
          />
        </div>
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Kota"
          className="h-12 rounded-(--radius) border border-(--border) bg-slate-50 px-4 text-sm outline-none transition focus:border-(--accent) focus:bg-white sm:w-40"
        />
        <button
          type="submit"
          className="h-12 rounded-(--radius) bg-(--accent) px-8 text-sm font-semibold text-white transition hover:bg-(--accent-hover)"
        >
          Cari Event
        </button>
      </div>
    </form>
  );
}
