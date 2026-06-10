import Link from "next/link";
import { EventCard } from "@/components/event-card";
import { CategoryPills } from "@/components/public/category-pills";
import { EventScrollRow } from "@/components/public/event-scroll-row";
import { EventSearchForm } from "@/components/public/event-search-form";
import { HeroCarousel } from "@/components/public/hero-carousel";
import { SectionHeader } from "@/components/public/section-header";
import { Container } from "@/components/ui/container";
import { api } from "@/lib/api";

export default async function HomePage() {
  let banners: Awaited<ReturnType<typeof api.getHomepage>>["banners"] = [];
  let categories: Awaited<ReturnType<typeof api.getHomepage>>["categories"] = [];
  let events: Awaited<ReturnType<typeof api.getHomepage>>["events"] = [];

  try {
    const data = await api.getHomepage();
    banners = data.banners;
    categories = data.categories;
    events = data.events;
  } catch {
    try {
      const res = await api.listEvents({ page: 1 });
      events = res.data;
    } catch {
      events = [];
    }
  }

  const featured = events.slice(0, 10);
  const trending = events.length > 4 ? events.slice(4, 8) : events.slice(0, Math.min(4, events.length));

  return (
    <>
      <HeroCarousel
        banners={banners.map((b) => ({
          id: b.id,
          title: b.title,
          subtitle: b.subtitle,
          image_url: b.image_url,
          link_url: b.link_url,
        }))}
      />

      <CategoryPills categories={categories} />

      {/* Quick search strip */}
      <section className="border-b border-(--border) bg-white py-6">
        <Container wide>
          <EventSearchForm />
        </Container>
      </section>

      <section className="border-b border-(--border) bg-white py-5">
        <Container wide>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { icon: "🎫", title: "E-Ticket Instan", desc: "Langsung setelah bayar" },
              { icon: "🔒", title: "Pembayaran Aman", desc: "Midtrans terenkripsi" },
              { icon: "⚡", title: "Antrean Cerdas", desc: "Siap traffic tinggi" },
              { icon: "📱", title: "Check-in QR", desc: "Tanpa antre panjang" },
            ].map((item) => (
              <div
                key={item.title}
                className="flex items-start gap-3 rounded-lg border border-(--border) bg-slate-50/80 px-4 py-3"
              >
                <span className="text-xl leading-none">{item.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {featured.length > 0 && (
        <section className="py-8 sm:py-10">
          <Container wide>
            <SectionHeader
              title="Featured Event"
              subtitle="Kurasi event terbaik untuk kamu"
              href="/events"
            />
            <EventScrollRow events={featured} />
          </Container>
        </section>
      )}

      {trending.length > 0 && (
        <section className="border-y border-(--border) bg-white py-10 sm:py-12">
          <Container wide>
            <SectionHeader
              title="Lagi Banyak Dibeli"
              subtitle="Jangan sampai kehabisan tiket"
              href="/events"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              {trending.map((event) => (
                <EventCard key={event.id} event={event} variant="horizontal" />
              ))}
            </div>
          </Container>
        </section>
      )}

      <section className="py-10 sm:py-12">
        <Container wide>
          <div className="relative overflow-hidden rounded-2xl bg-(--accent) px-8 py-10 text-white sm:px-12 sm:py-12">
            <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
            <div className="relative max-w-lg">
              <h2 className="text-2xl font-bold sm:text-3xl">#LoKetagihan Event?</h2>
              <p className="mt-3 text-sm leading-relaxed text-blue-100 sm:text-base">
                Dari workshop hingga konser besar — temukan pengalaman seru dan amankan tiketmu
                sekarang juga.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/events"
                  className="rounded-(--radius) bg-white px-6 py-3 text-sm font-semibold text-(--accent) shadow-sm transition hover:bg-blue-50"
                >
                  Cari Event
                </Link>
                <Link
                  href="/auth/register"
                  className="rounded-(--radius) border border-white/35 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Daftar Gratis
                </Link>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {events.length === 0 && (
        <section className="pb-16">
          <Container wide>
            <div className="rounded-lg border border-dashed border-slate-300 bg-white px-8 py-16 text-center">
              <p className="text-4xl">🎪</p>
              <p className="mt-4 text-lg font-semibold text-slate-800">Belum ada event tersedia</p>
              <p className="mt-2 text-sm text-slate-500">Cek kembali nanti untuk event seru berikutnya.</p>
              <Link
                href="/auth/register"
                className="mt-6 inline-block text-sm font-semibold text-(--accent) hover:underline"
              >
                Buat akun untuk notifikasi event baru →
              </Link>
            </div>
          </Container>
        </section>
      )}
    </>
  );
}
