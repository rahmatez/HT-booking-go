import Link from "next/link";
import { Container } from "@/components/ui/container";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-(--border) bg-white">
      <Container className="py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <p className="text-lg font-bold tracking-tight text-stone-900">
              HTB<span className="text-(--accent)">Ticket</span>
            </p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-stone-500">
              Platform tiket event terpercaya. Aman, cepat, dan siap menangani antrean
              ratusan ribu pembeli sekaligus.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">
              Navigasi
            </p>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link href="/events" className="text-stone-600 transition hover:text-(--accent)">
                  Semua Event
                </Link>
              </li>
              <li>
                <Link href="/bookings" className="text-stone-600 transition hover:text-(--accent)">
                  Tiket Saya
                </Link>
              </li>
              <li>
                <Link href="/auth/login" className="text-stone-600 transition hover:text-(--accent)">
                  Masuk
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">
              Legal
            </p>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link href="/terms" className="text-stone-600 transition hover:text-(--accent)">
                  Syarat & Ketentuan
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-stone-600 transition hover:text-(--accent)">
                  Kebijakan Privasi
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-(--border) pt-8 text-xs text-stone-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} HTB Ticket. Semua hak dilindungi.</p>
          <p>Dukungan pembayaran aman · E-ticket instan</p>
        </div>
      </Container>
    </footer>
  );
}
