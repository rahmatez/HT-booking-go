import Link from "next/link";

export const metadata = {
  title: "Akun — HTB Ticket",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-stone-950" data-shell="auth">
      <header className="relative z-10 border-b border-white/10 px-4 py-4 sm:px-6">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-(--accent) text-sm font-black text-white">
            H
          </span>
          <span className="text-base font-bold tracking-tight text-white">
            HTB<span className="text-orange-400">Ticket</span>
          </span>
        </Link>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
