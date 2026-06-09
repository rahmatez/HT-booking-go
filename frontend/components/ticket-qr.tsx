"use client";

import QRCode from "react-qr-code";

type Props = {
  value: string;
  label?: string;
  size?: number;
};

export function TicketQR({ value, label, size = 160 }: Props) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-stone-200/80">
        <QRCode
          value={value}
          size={size}
          level="M"
          bgColor="#ffffff"
          fgColor="#1c1917"
          aria-label={label || `QR code untuk tiket ${value}`}
        />
      </div>
      {label && <p className="text-xs text-stone-500">{label}</p>}
    </div>
  );
}
