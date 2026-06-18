"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandWordmark } from "@/components/brand-logo";
import { adminNavIcons } from "@/components/admin/admin-nav-icons";
import { filterNavForRole } from "@/lib/admin-nav";
import { useAuthStore } from "@/lib/auth-store";

type Props = {
  open?: boolean;
  onNavigate?: () => void;
};

const roleLabels: Record<string, string> = {
  admin: "Super Admin",
  organizer: "Organizer",
  gate_staff: "Gate Staff",
};

export function AdminSidebar({ open = false, onNavigate }: Props) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const sections = filterNavForRole(user?.role);
  const ExternalIcon = adminNavIcons.external;

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex h-screen w-[290px] shrink-0 flex-col border-r border-gray-200 bg-white transition-transform duration-300 ease-out lg:static lg:translate-x-0 ${
        open ? "translate-x-0 shadow-xl shadow-gray-900/10" : "-translate-x-full"
      }`}
    >
      <div className="shrink-0 border-b border-gray-200 px-6 py-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-500">
          Admin Panel
        </p>
        <p className="mt-1.5 text-lg font-bold text-gray-900">
          <BrandWordmark className="text-gray-900" accentClassName="text-brand-500" />
        </p>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 scrollbar-thin [scrollbar-color:rgb(228_231_236)_transparent]">
        {sections.map((section) => (
          <div key={section.title} className="mb-6">
            <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
              {section.title}
            </p>
            <div className="space-y-1">
              {section.items.map((link) => {
                const active = link.exact
                  ? pathname === link.href
                  : pathname.startsWith(link.href);
                const Icon = adminNavIcons[link.icon];

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={onNavigate}
                    className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-brand-50 text-brand-500"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                        active
                          ? "text-brand-500"
                          : "text-gray-500 group-hover:text-gray-700"
                      }`}
                    >
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="truncate">{link.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-gray-200 bg-white p-4">
        {user && (
          <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-gray-800">{user.full_name}</p>
            <p className="mt-0.5 text-xs font-medium text-brand-500">
              {roleLabels[user.role] || user.role}
            </p>
          </div>
        )}
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-800"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500">
            <ExternalIcon className="h-5 w-5" aria-hidden />
          </span>
          Kembali ke situs
        </Link>
      </div>
    </aside>
  );
}
