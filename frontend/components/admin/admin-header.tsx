"use client";

import { useAuthStore } from "@/lib/auth-store";

export function AdminHeader() {
  const { user, logout } = useAuthStore();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-stone-200 bg-white px-6">
      <p className="text-sm text-stone-500">
        Panel penyelenggara · <span className="font-medium text-stone-700">HTB Ticket</span>
      </p>
      <div className="flex items-center gap-3">
        <span className="hidden text-sm text-stone-600 sm:inline">{user?.full_name}</span>
        <button
          type="button"
          onClick={logout}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
        >
          Keluar
        </button>
      </div>
    </header>
  );
}
