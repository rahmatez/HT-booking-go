"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BRAND_NAME } from "@/lib/brand";
import { filterNavForRole } from "@/lib/admin-nav";
import { useAuthStore } from "@/lib/auth-store";

type Props = {
  open?: boolean;
  onNavigate?: () => void;
};

export function AdminSidebar({ open = false, onNavigate }: Props) {
  const pathname = usePathname();
  const role = useAuthStore((s) => s.user?.role);
  const sections = filterNavForRole(role);

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-stone-800 bg-stone-950 text-stone-300 transition-transform duration-200 lg:static lg:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="border-b border-stone-800 px-5 py-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-400">
          Admin Panel
        </p>
        <p className="mt-1 text-sm font-semibold text-white">{BRAND_NAME}</p>
      </div>
      <nav className="flex-1 overflow-y-auto p-3">
        {sections.map((section) => (
          <div key={section.title} className="mb-4">
            <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-stone-600">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map((link) => {
                const active = link.exact
                  ? pathname === link.href
                  : pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={onNavigate}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                      active
                        ? "bg-stone-800 text-white ring-1 ring-stone-700"
                        : "text-stone-400 hover:bg-stone-900 hover:text-stone-200"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-stone-800 p-3">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-500 transition hover:bg-stone-900 hover:text-stone-300"
        >
          ← Kembali ke situs
        </Link>
      </div>
    </aside>
  );
}
