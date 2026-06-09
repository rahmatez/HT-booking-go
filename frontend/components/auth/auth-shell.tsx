import Link from "next/link";
import { Container } from "@/components/ui/container";
import { BRAND_NAME } from "@/lib/brand";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex flex-1">
      <div className="relative hidden overflow-hidden lg:flex lg:w-1/2 lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-linear-to-br from-stone-900 via-stone-800 to-(--accent)" />
        <div className="texture-grain absolute inset-0" />
        <Container className="relative z-10 flex flex-1 flex-col justify-center py-16">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-300/80">
            {BRAND_NAME}
          </p>
          <h2 className="mt-4 max-w-md text-4xl font-bold leading-tight tracking-tight text-white">
            Satu akun untuk semua tiket event favoritmu.
          </h2>
          <p className="mt-4 max-w-sm text-base leading-relaxed text-stone-300">
            Riwayat pembelian tersimpan, e-ticket mudah diakses, dan proses checkout
            yang cepat bahkan saat antrean panjang.
          </p>
          <ul className="mt-10 space-y-3 text-sm text-stone-300">
            <li className="flex items-center gap-2">
              <span className="text-orange-400">✓</span> Hold tiket 10 menit
            </li>
            <li className="flex items-center gap-2">
              <span className="text-orange-400">✓</span> Pembayaran aman
            </li>
            <li className="flex items-center gap-2">
              <span className="text-orange-400">✓</span> E-ticket langsung setelah bayar
            </li>
          </ul>
        </Container>
        <p className="relative z-10 px-6 pb-8 text-xs text-stone-500">
          Dipercaya penyelenggara event di seluruh Indonesia
        </p>
      </div>

      <div className="flex flex-1 flex-col justify-center bg-stone-50 px-4 py-10 sm:px-6 lg:w-1/2 lg:py-16">
        <Container narrow className="w-full max-w-md">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-2 text-sm text-stone-500 hover:text-(--accent) lg:hidden"
          >
            ← Kembali ke beranda
          </Link>
          <div className="rounded-2xl border border-(--border) bg-white p-8 shadow-(--shadow-lg)">
            <h1 className="text-2xl font-bold tracking-tight text-stone-900">{title}</h1>
            <p className="mt-2 text-sm text-stone-500">{subtitle}</p>
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-6 border-t border-(--border) pt-6">{footer}</div>}
          </div>
        </Container>
      </div>
    </div>
  );
}
