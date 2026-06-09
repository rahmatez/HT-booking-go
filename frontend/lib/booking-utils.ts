export const bookingStatusTone: Record<
  string,
  "success" | "warning" | "danger" | "neutral" | "default"
> = {
  confirmed: "success",
  held: "warning",
  pending_payment: "warning",
  cancelled: "neutral",
  expired: "danger",
};

export const bookingStatusLabel: Record<string, string> = {
  confirmed: "Lunas",
  held: "Ditahan",
  pending_payment: "Menunggu bayar",
  cancelled: "Dibatalkan",
  expired: "Kedaluwarsa",
};

export function canCancelBooking(status: string): boolean {
  return status === "held" || status === "pending_payment";
}
