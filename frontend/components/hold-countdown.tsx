"use client";

import { useEffect, useState } from "react";

type Props = {
  expiresAt: string;
  onExpired?: () => void;
};

export function HoldCountdown({ expiresAt, onExpired }: Props) {
  const [remaining, setRemaining] = useState("");
  const [urgent, setUrgent] = useState(false);

  useEffect(() => {
    const tick = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining("00:00");
        setUrgent(true);
        onExpired?.();
        return;
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setRemaining(`${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`);
      setUrgent(diff < 120000);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt, onExpired]);

  return (
    <div
      className={`flex items-center gap-4 rounded-2xl border px-5 py-4 ${
        urgent
          ? "border-red-200 bg-(--danger-soft)"
          : "border-amber-200 bg-(--warning-soft)"
      }`}
    >
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
          urgent ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"
        }`}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      </div>
      <div className="flex-1">
        <p className={`text-sm font-medium ${urgent ? "text-red-800" : "text-amber-900"}`}>
          {urgent ? "Segera selesaikan pembayaran" : "Tiket sedang ditahan untukmu"}
        </p>
        <p className="text-xs text-stone-500">Waktu tersisa sebelum kembali tersedia</p>
      </div>
      <p
        className={`font-mono text-3xl font-bold tabular-nums tracking-tight ${
          urgent ? "text-red-700 animate-pulse-soft" : "text-amber-800"
        }`}
      >
        {remaining}
      </p>
    </div>
  );
}
