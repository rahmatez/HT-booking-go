"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { logoutUser } from "@/lib/auth-client";
import { useAuthStore } from "@/lib/auth-store";
import { isAdminRole } from "@/lib/admin-utils";
import { BrandLogo } from "@/components/brand-logo";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const { user, accessToken } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  const authenticated = mounted && !!accessToken;

  const navLink =
    "rounded-lg px-3 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900";

  return (
    <header className="sticky top-0 z-50 border-b border-(--border) bg-white/90 backdrop-blur-md">
      <Container>
        <div className="flex h-16 items-center justify-between gap-4">
          <BrandLogo />

          <nav className="hidden items-center gap-1 md:flex">
            <Link href="/events" className={navLink}>
              Event
            </Link>
            {authenticated ? (
              <>
                {isAdminRole(user?.role) && (
                  <Link href="/admin" className={navLink}>
                    Admin
                  </Link>
                )}
                <Link href="/bookings" className={navLink}>
                  Tiket Saya
                </Link>
                <span className="mx-2 h-4 w-px bg-stone-200" />
                <span className="max-w-[120px] truncate text-sm text-stone-500">
                  {user?.full_name}
                </span>
                <button onClick={() => void logoutUser()} className={`${navLink} text-stone-500`}>
                  Keluar
                </button>
              </>
            ) : (
              <>
                <Link href="/auth/login" className={navLink}>
                  Masuk
                </Link>
                <Link href="/auth/register">
                  <Button size="sm">Daftar</Button>
                </Link>
              </>
            )}
          </nav>

          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-(--border) md:hidden"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {menuOpen ? (
                <path d="M6 6l12 12M18 6L6 18" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" />
              )}
            </svg>
          </button>
        </div>

        {menuOpen && (
          <nav className="flex flex-col gap-1 border-t border-(--border) py-3 md:hidden">
            <Link href="/events" className={navLink} onClick={() => setMenuOpen(false)}>
              Event
            </Link>
            {authenticated ? (
              <>
                {isAdminRole(user?.role) && (
                  <Link href="/admin" className={navLink} onClick={() => setMenuOpen(false)}>
                    Admin
                  </Link>
                )}
                <Link href="/bookings" className={navLink} onClick={() => setMenuOpen(false)}>
                  Tiket Saya
                </Link>
                <button
                  onClick={() => {
                    void logoutUser();
                    setMenuOpen(false);
                  }}
                  className={`${navLink} text-left`}
                >
                  Keluar
                </button>
              </>
            ) : (
              <>
                <Link href="/auth/login" className={navLink} onClick={() => setMenuOpen(false)}>
                  Masuk
                </Link>
                <Link href="/auth/register" className={navLink} onClick={() => setMenuOpen(false)}>
                  Daftar
                </Link>
              </>
            )}
          </nav>
        )}
      </Container>
    </header>
  );
}
