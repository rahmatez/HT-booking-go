"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, Booking, Ticket, formatIDR } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { Container } from "@/components/ui/container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export default function BookingDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { accessToken, isAuthenticated } = useAuthStore();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated() || !accessToken) {
      router.push("/auth/login");
      return;
    }
    Promise.all([
      api.getBooking(accessToken, params.id),
      api.listTickets(accessToken, params.id).catch(() => [] as Ticket[]),
    ])
      .then(([b, t]) => {
        setBooking(b);
        setTickets(t);
      })
      .finally(() => setLoading(false));
  }, [accessToken, isAuthenticated, params.id, router]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!booking) {
    return (
      <Container narrow className="py-16 text-center">
        <p className="text-stone-500">Booking tidak ditemukan</p>
        <Link href="/bookings" className="mt-4 inline-block text-(--accent)">
          Kembali
        </Link>
      </Container>
    );
  }

  return (
    <div className="py-10 sm:py-14">
      <Container narrow>
        <Link href="/bookings" className="text-sm font-medium text-stone-500 hover:text-(--accent)">
          ← Tiket Saya
        </Link>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-stone-900">Detail Pemesanan</h1>
          <Badge tone={booking.status === "confirmed" ? "success" : "warning"}>
            {booking.status}
          </Badge>
        </div>

        <div className="mt-8 rounded-2xl border border-(--border) bg-white p-6 shadow-(--shadow-sm)">
          <p className="text-sm text-stone-400">Total pembayaran</p>
          <p className="mt-1 text-3xl font-bold text-stone-900">{formatIDR(booking.total_amount)}</p>
          {booking.items?.map((item) => (
            <div
              key={item.ticket_type_id}
              className="mt-4 flex justify-between border-t border-(--border) pt-4 text-sm"
            >
              <span className="text-stone-600">
                {item.ticket_type_name} × {item.quantity}
              </span>
              <span className="font-medium">{formatIDR(item.unit_price * item.quantity)}</span>
            </div>
          ))}
        </div>

        {booking.status === "confirmed" && tickets.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-stone-900">E-Ticket kamu</h2>
            <p className="mt-1 text-sm text-stone-500">
              Tunjukkan kode di bawah ini saat masuk venue
            </p>
            <div className="mt-4 space-y-4">
              {tickets.map((t) => (
                <div
                  key={t.id}
                  className="relative overflow-hidden rounded-2xl border-2 border-dashed border-(--accent)/30 bg-(--accent-soft) p-6"
                >
                  <div className="absolute right-4 top-4 text-3xl opacity-20">🎫</div>
                  <p className="text-sm font-medium text-stone-600">{t.ticket_type_name}</p>
                  <p className="mt-2 font-mono text-2xl font-bold tracking-widest text-stone-900">
                    {t.ticket_code}
                  </p>
                  <p className="mt-3 text-xs text-stone-500">Satu kali scan · Jangan dibagikan</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {(booking.status === "held" || booking.status === "pending_payment") && (
          <Link href={`/checkout/${booking.id}`} className="mt-8 block">
            <Button fullWidth size="lg">
              Lanjutkan Pembayaran
            </Button>
          </Link>
        )}
      </Container>
    </div>
  );
}
