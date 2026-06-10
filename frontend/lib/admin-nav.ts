export type AdminNavItem = {
  href: string;
  label: string;
  exact?: boolean;
  roles: ("admin" | "organizer" | "gate_staff")[];
  phase?: "mvp" | "a" | "b" | "c";
};

export type AdminNavSection = {
  title: string;
  items: AdminNavItem[];
};

export const adminNavSections: AdminNavSection[] = [
  {
    title: "Utama",
    items: [
      { href: "/admin", label: "Dashboard", exact: true, roles: ["admin", "organizer"] },
    ],
  },
  {
    title: "Katalog",
    items: [
      { href: "/admin/events", label: "Event", roles: ["admin", "organizer"] },
      { href: "/admin/venues", label: "Venue", roles: ["admin", "organizer"] },
      { href: "/admin/categories", label: "Kategori", roles: ["admin"], phase: "b" },
      { href: "/admin/banners", label: "Banner", roles: ["admin"], phase: "b" },
      { href: "/admin/moderation", label: "Moderasi", roles: ["admin"], phase: "b" },
    ],
  },
  {
    title: "Transaksi",
    items: [
      { href: "/admin/bookings", label: "Booking", roles: ["admin", "organizer"] },
      { href: "/admin/payments", label: "Pembayaran", roles: ["admin", "organizer"], phase: "a" },
      { href: "/admin/refunds", label: "Refund", roles: ["admin", "organizer"], phase: "b" },
      { href: "/admin/promos", label: "Promo", roles: ["admin", "organizer"], phase: "b" },
    ],
  },
  {
    title: "Venue (hari-H)",
    items: [
      { href: "/admin/check-in", label: "Check-in", roles: ["admin", "organizer", "gate_staff"], phase: "b" },
      { href: "/admin/check-in/reports", label: "Laporan check-in", roles: ["admin", "organizer"], phase: "b" },
    ],
  },
  {
    title: "Laporan",
    items: [
      { href: "/admin/reports/sales", label: "Penjualan", roles: ["admin", "organizer"], phase: "b" },
      { href: "/admin/reports/exports", label: "Export", roles: ["admin", "organizer"], phase: "b" },
    ],
  },
  {
    title: "Platform",
    items: [
      { href: "/admin/users", label: "Pengguna", roles: ["admin"], phase: "a" },
      { href: "/admin/organizers", label: "Organizer", roles: ["admin"], phase: "b" },
      { href: "/admin/staff", label: "Gate staff", roles: ["admin"], phase: "b" },
      { href: "/admin/settings", label: "Pengaturan", roles: ["admin"], phase: "a" },
      { href: "/admin/audit", label: "Audit log", roles: ["admin"], phase: "a" },
      { href: "/admin/settlements", label: "Settlement", roles: ["admin"], phase: "c" },
    ],
  },
];

export function filterNavForRole(role?: string): AdminNavSection[] {
  const r = (role || "user") as AdminNavItem["roles"][number] | "user";
  return adminNavSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.roles.includes(r as AdminNavItem["roles"][number])),
    }))
    .filter((section) => section.items.length > 0);
}
