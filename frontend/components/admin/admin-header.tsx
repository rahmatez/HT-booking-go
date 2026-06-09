"use client";

import Link from "next/link";
import { logoutUser } from "@/lib/auth-client";
import { useAuthStore } from "@/lib/auth-store";
import { BRAND_NAME } from "@/lib/brand";

type Props = {
  onMenuOpen?: () => void;
};

export function AdminHeader({ onMenuOpen }: Props) {
  const { user } = useAuthStore();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-stone-200 bg-white px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuOpen}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-(--border) text-stone-600 lg:hidden"
          aria-label="Buka menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <p className="text-sm text-stone-500">
          Panel penyelenggara ·{" "}
          <Link href="/admin" className="font-medium text-stone-700 hover:text-(--accent)">
            {BRAND_NAME}
          </Link>
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden max-w-[140px] truncate text-sm text-stone-600 sm:inline">
          {user?.full_name}
        </span>
        <button
          type="button"
          onClick={() => void logoutUser()}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
        >
          Keluar
        </button>
      </div>
    </header>
  );
}
