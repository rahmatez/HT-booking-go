export type IconName =
  | "dashboard"
  | "events"
  | "venues"
  | "categories"
  | "banners"
  | "moderation"
  | "bookings"
  | "payments"
  | "refunds"
  | "promos"
  | "checkin"
  | "reports"
  | "sales"
  | "exports"
  | "users"
  | "organizers"
  | "staff"
  | "settings"
  | "audit"
  | "settlements"
  | "external";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: IconName;
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
      { href: "/admin", label: "Dashboard", icon: "dashboard", exact: true, roles: ["admin", "organizer"] },
    ],
  },
  {
    title: "Katalog",
    items: [
      { href: "/admin/events", label: "Event", icon: "events", roles: ["admin", "organizer"] },
      { href: "/admin/venues", label: "Venue", icon: "venues", roles: ["admin", "organizer"] },
      { href: "/admin/categories", label: "Kategori", icon: "categories", roles: ["admin"], phase: "b" },
      { href: "/admin/banners", label: "Banner", icon: "banners", roles: ["admin"], phase: "b" },
      { href: "/admin/moderation", label: "Moderasi", icon: "moderation", roles: ["admin"], phase: "b" },
    ],
  },
  {
    title: "Transaksi",
    items: [
      { href: "/admin/bookings", label: "Booking", icon: "bookings", roles: ["admin", "organizer"] },
      { href: "/admin/payments", label: "Pembayaran", icon: "payments", roles: ["admin", "organizer"], phase: "a" },
      { href: "/admin/refunds", label: "Refund", icon: "refunds", roles: ["admin", "organizer"], phase: "b" },
      { href: "/admin/promos", label: "Promo", icon: "promos", roles: ["admin", "organizer"], phase: "b" },
    ],
  },
  {
    title: "Venue (hari-H)",
    items: [
      { href: "/admin/check-in", label: "Check-in", icon: "checkin", roles: ["admin", "organizer", "gate_staff"], phase: "b" },
      { href: "/admin/check-in/reports", label: "Laporan check-in", icon: "reports", roles: ["admin", "organizer"], phase: "b" },
    ],
  },
  {
    title: "Laporan",
    items: [
      { href: "/admin/reports/sales", label: "Penjualan", icon: "sales", roles: ["admin", "organizer"], phase: "b" },
      { href: "/admin/reports/exports", label: "Export", icon: "exports", roles: ["admin", "organizer"], phase: "b" },
    ],
  },
  {
    title: "Platform",
    items: [
      { href: "/admin/users", label: "Pengguna", icon: "users", roles: ["admin"], phase: "a" },
      { href: "/admin/organizers", label: "Organizer", icon: "organizers", roles: ["admin"], phase: "b" },
      { href: "/admin/staff", label: "Gate staff", icon: "staff", roles: ["admin"], phase: "b" },
      { href: "/admin/settings", label: "Pengaturan", icon: "settings", roles: ["admin"], phase: "a" },
      { href: "/admin/audit", label: "Audit log", icon: "audit", roles: ["admin"], phase: "a" },
      { href: "/admin/settlements", label: "Settlement", icon: "settlements", roles: ["admin"], phase: "c" },
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
