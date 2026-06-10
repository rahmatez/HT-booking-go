"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { logoutUser } from "@/lib/auth-client";
import { useAuthStore } from "@/lib/auth-store";
import { isAdminRole } from "@/lib/admin-utils";
import { BrandLogo } from "@/components/brand-logo";
import { EventSearchForm } from "@/components/public/event-search-form";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const { user, accessToken } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  const authenticated = mounted && !!accessToken;

  const navLink =
    "rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900";

  return (
    <header className="sticky top-0 z-50 border-b border-(--border) bg-white/95 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex h-(--header-h) items-center gap-3 md:gap-6">
          <BrandLogo
            iconClassName="flex h-8 w-8 items-center justify-center rounded-lg bg-(--accent) text-xs font-black text-white sm:h-9 sm:w-9 sm:text-sm"
            wordmarkClassName="text-base font-bold tracking-tight text-slate-900 sm:text-lg"
            accentClassName="text-(--accent)"
          />

          <div className="hidden min-w-0 flex-1 md:block">
            <EventSearchForm compact />
          </div>

          <nav className="hidden items-center gap-0.5 md:flex">
            <Link href="/events" className={navLink}>
              Event
            </Link>
            {authenticated && (
              <Link href="/bookings" className={navLink}>
                Tiket Saya
              </Link>
            )}
            {authenticated && isAdminRole(user?.role) && (
              <Link href="/admin" className={navLink}>
                Admin
              </Link>
            )}
            {authenticated ? (
              <>
                <div className="mx-1.5 h-5 w-px bg-slate-200" />
                <span className="hidden max-w-[90px] truncate text-sm text-slate-500 lg:inline">
                  {user?.full_name}
                </span>
                <button onClick={() => void logoutUser()} className={`${navLink} text-slate-500`}>
                  Keluar
                </button>
              </>
            ) : (
              <>
                <Link href="/auth/login">
                  <Button variant="ghost" size="sm">
                    Masuk
                  </Button>
                </Link>
                <Link href="/auth/register">
                  <Button size="sm">Daftar</Button>
                </Link>
              </>
            )}
          </nav>

          <button
            type="button"
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg border border-(--border) text-slate-600 md:hidden"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Menu"
            aria-expanded={menuOpen}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {menuOpen ? (
                <path d="M6 6l12 12M18 6L6 18" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" />
              )}
            </svg>
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-(--border) py-4 md:hidden">
            <EventSearchForm compact className="mb-4" />
            <nav className="flex flex-col gap-0.5">
              <Link href="/events" className={navLink} onClick={() => setMenuOpen(false)}>
                Cari Event
              </Link>
              {authenticated ? (
                <>
                  <Link href="/bookings" className={navLink} onClick={() => setMenuOpen(false)}>
                    Tiket Saya
                  </Link>
                  {isAdminRole(user?.role) && (
                    <Link href="/admin" className={navLink} onClick={() => setMenuOpen(false)}>
                      Admin
                    </Link>
                  )}
                  <button
                    onClick={() => {
                      void logoutUser();
                      setMenuOpen(false);
                    }}
                    className={`${navLink} text-left text-slate-500`}
                  >
                    Keluar ({user?.full_name})
                  </button>
                </>
              ) : (
                <div className="mt-2 flex gap-2">
                  <Link href="/auth/login" className="flex-1" onClick={() => setMenuOpen(false)}>
                    <Button variant="secondary" fullWidth size="sm">
                      Masuk
                    </Button>
                  </Link>
                  <Link href="/auth/register" className="flex-1" onClick={() => setMenuOpen(false)}>
                    <Button fullWidth size="sm">
                      Daftar
                    </Button>
                  </Link>
                </div>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
