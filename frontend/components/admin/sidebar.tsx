"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "Dashboard", exact: true, icon: "◫" },
  { href: "/admin/events", label: "Event", icon: "◎" },
  { href: "/admin/bookings", label: "Booking", icon: "☰" },
  { href: "/admin/venues", label: "Venue", icon: "⌂" },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-stone-800 bg-stone-950 text-stone-300">
      <div className="border-b border-stone-800 px-5 py-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-400">
          Admin Panel
        </p>
        <p className="mt-1 text-sm font-semibold text-white">HTB Ticket</p>
      </div>
      <nav className="flex-1 space-y-0.5 p-3">
        {links.map((link) => {
          const active = link.exact
            ? pathname === link.href
            : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-stone-800 text-white"
                  : "text-stone-400 hover:bg-stone-900 hover:text-stone-200"
              }`}
            >
              <span className="text-xs opacity-70" aria-hidden>
                {link.icon}
              </span>
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-stone-800 p-3">
        <Link
          href="/"
          className="block rounded-lg px-3 py-2 text-sm text-stone-500 transition hover:bg-stone-900 hover:text-stone-300"
        >
          ← Kembali ke situs
        </Link>
      </div>
    </aside>
  );
}
