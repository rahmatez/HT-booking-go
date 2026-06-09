import Link from "next/link";
import { EventCard } from "@/components/event-card";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

export default async function HomePage() {
  let events: Awaited<ReturnType<typeof api.listEvents>>["data"] = [];
  try {
    const res = await api.listEvents({ page: 1 });
    events = res.data;
  } catch {
    events = [];
  }

  return (
    <>
      <section className="relative overflow-hidden border-b border-(--border) bg-stone-900 text-white">
        <div className="absolute inset-0 bg-linear-to-br from-stone-900 via-stone-800 to-[#7c2d12]" />
        <div className="texture-grain absolute inset-0" />
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-orange-500/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-teal-500/10 blur-3xl" />

        <Container className="relative z-10 py-20 sm:py-28">
          <div className="max-w-2xl animate-fade-up">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Platform ticketing siap traffic tinggi
            </p>
            <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
              Temukan event.
              <br />
              <span className="text-orange-300">Amankan tiketmu.</span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-stone-300 sm:text-lg">
              Dari konser hingga festival — beli tiket dengan proses yang jelas, hold
              terjamin, dan e-ticket langsung setelah pembayaran.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/events">
                <Button size="lg">Jelajahi Event</Button>
              </Link>
              <Link href="/auth/register">
                <Button size="lg" variant="secondary" className="bg-white/10! text-white! border-white/20! hover:bg-white/20!">
                  Buat Akun Gratis
                </Button>
              </Link>
            </div>
          </div>

          <div className="mt-14 grid grid-cols-3 gap-6 border-t border-white/10 pt-10 sm:max-w-lg">
            {[
              { n: "0", label: "Double booking" },
              { n: "10m", label: "Waktu hold tiket" },
              { n: "24/7", label: "Akses e-ticket" },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-2xl font-bold text-orange-300">{s.n}</p>
                <p className="mt-1 text-xs text-stone-400">{s.label}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="py-14 sm:py-20">
        <Container>
          <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-(--accent)">
                Pilihan terbaru
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
                Event yang sedang dibuka
              </h2>
            </div>
            <Link
              href="/events"
              className="text-sm font-semibold text-stone-600 transition hover:text-(--accent)"
            >
              Lihat semua event →
            </Link>
          </div>

          {events.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-8 py-16 text-center">
              <p className="text-stone-500">Belum ada event tersedia saat ini.</p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((event, i) => (
                <div key={event.id} className="animate-fade-up" style={{ animationDelay: `${i * 80}ms` }}>
                  <EventCard event={event} />
                </div>
              ))}
            </div>
          )}
        </Container>
      </section>
    </>
  );
}
