import { BrandLogo } from "@/components/brand-logo";
import { BRAND_NAME } from "@/lib/brand";

export const metadata = {
  title: `Akun — ${BRAND_NAME}`,
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-stone-950" data-shell="auth">
      <header className="relative z-10 border-b border-white/10 px-4 py-4 sm:px-6">
        <BrandLogo
          wordmarkClassName="text-base font-bold tracking-tight text-white"
          accentClassName="text-orange-400"
        />
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
