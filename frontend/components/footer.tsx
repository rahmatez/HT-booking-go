import Link from "next/link";
import { BrandWordmark } from "@/components/brand-logo";
import { BRAND_DESCRIPTION } from "@/lib/brand";

const footerLinks = {
  event: [
    { href: "/events", label: "Cari Event" },
    { href: "/events?category=musik", label: "Konser & Musik" },
    { href: "/events?category=festival", label: "Festival" },
    { href: "/bookings", label: "Tiket Saya" },
  ],
  bantuan: [
    { href: "/refund-policy", label: "Kebijakan Refund" },
    { href: "mailto:support@eventra.local", label: "Hubungi Kami" },
    { href: "/terms", label: "Syarat & Ketentuan" },
    { href: "/privacy", label: "Kebijakan Privasi" },
  ],
  tentang: [
    { href: "/events", label: "Jelajahi Event" },
    { href: "/auth/register", label: "Buat Akun" },
    { href: "/admin", label: "Kelola Event" },
  ],
};

export function Footer() {
  return (
    <footer className="mt-auto border-t border-(--border) bg-slate-900 text-slate-300">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <p className="text-xl font-bold text-white">
              <BrandWordmark accentClassName="text-blue-400" />
            </p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-400">
              {BRAND_DESCRIPTION}
            </p>
            <div className="mt-5 flex gap-3">
              {["facebook", "instagram", "twitter"].map((s) => (
                <span
                  key={s}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-xs uppercase text-slate-500"
                  aria-hidden
                >
                  {s[0]}
                </span>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-white">Event</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {footerLinks.event.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="transition hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-white">Bantuan</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {footerLinks.bantuan.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="transition hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-white">Tentang</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {footerLinks.tentang.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="transition hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-slate-800 pt-8 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Eventra. Semua hak dilindungi.</p>
          <div className="flex flex-wrap gap-4">
            <span>Pembayaran aman via Midtrans</span>
            <span>·</span>
            <span>E-ticket instan</span>
            <span>·</span>
            <span>Check-in digital</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
