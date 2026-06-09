export const eventStatusLabel: Record<string, string> = {
  draft: "Draft",
  published: "Dipublikasi",
  cancelled: "Dibatalkan",
  completed: "Selesai",
};

export const eventStatusTone: Record<string, string> = {
  draft: "bg-stone-100 text-stone-700",
  published: "bg-(--success-soft) text-(--success)",
  cancelled: "bg-(--danger-soft) text-(--danger)",
  completed: "bg-blue-50 text-blue-800",
};

export const adminBookingStatusLabel: Record<string, string> = {
  held: "Ditahan",
  pending_payment: "Menunggu bayar",
  confirmed: "Lunas",
  cancelled: "Dibatalkan",
  expired: "Kedaluwarsa",
};

export const adminBookingStatusTone: Record<string, string> = {
  held: "bg-(--warning-soft) text-(--warning)",
  pending_payment: "bg-(--accent-soft) text-(--accent)",
  confirmed: "bg-(--success-soft) text-(--success)",
  cancelled: "bg-stone-100 text-stone-600",
  expired: "bg-(--danger-soft) text-(--danger)",
};
