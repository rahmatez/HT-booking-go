"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutUser } from "@/lib/auth-client";
import { useAuthStore } from "@/lib/auth-store";

type Props = {
  onMenuOpen?: () => void;
};

function initials(name?: string) {
  if (!name) return "?";
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function AdminHeader({ onMenuOpen }: Props) {
  const pathname = usePathname();
  const { user } = useAuthStore();

  const crumbs = pathname
    .replace("/admin", "")
    .split("/")
    .filter(Boolean);

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-gray-200 bg-white px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenuOpen}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 lg:hidden"
          aria-label="Buka menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>

        <nav className="hidden min-w-0 items-center gap-1.5 text-sm sm:flex">
          <Link href="/admin" className="font-medium text-gray-500 transition hover:text-brand-500">
            Admin
          </Link>
          {crumbs.map((crumb, i) => (
            <span key={crumb} className="flex items-center gap-1.5">
              <span className="text-gray-300">/</span>
              <span
                className={
                  i === crumbs.length - 1
                    ? "truncate font-semibold capitalize text-gray-800"
                    : "truncate capitalize text-gray-500"
                }
              >
                {crumb.replace(/-/g, " ")}
              </span>
            </span>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <Link
          href="/"
          className="hidden rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 transition hover:border-brand-100 hover:text-brand-500 sm:inline-flex"
        >
          Lihat situs
        </Link>

        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white py-1.5 pl-1.5 pr-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
            {initials(user?.full_name)}
          </span>
          <div className="hidden min-w-0 sm:block">
            <p className="max-w-[120px] truncate text-xs font-semibold text-gray-800">
              {user?.full_name}
            </p>
            <p className="max-w-[120px] truncate text-[10px] text-gray-500">{user?.email}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void logoutUser()}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition hover:border-error-50 hover:bg-error-50 hover:text-error-500"
        >
          Keluar
        </button>
      </div>
    </header>
  );
}
