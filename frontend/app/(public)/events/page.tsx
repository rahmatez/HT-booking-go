import { EventCard } from "@/components/event-card";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { api } from "@/lib/api";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const q = params.q || "";
  const page = Number(params.page) || 1;

  let events: Awaited<ReturnType<typeof api.listEvents>>["data"] = [];
  let total = 0;
  try {
    const res = await api.listEvents({ q, page });
    events = res.data;
    total = res.meta?.total || 0;
  } catch {
    events = [];
  }

  return (
    <div className="py-10 sm:py-14">
      <Container>
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-stone-900">Semua Event</h1>
          <p className="mt-2 text-stone-500">
            {total > 0 ? `${total} event tersedia` : "Cari konser, festival, dan acara lainnya"}
          </p>
        </div>

        <form className="mb-10 flex flex-col gap-3 sm:flex-row">
          <input
            name="q"
            defaultValue={q}
            placeholder="Cari nama event atau kota..."
            className="h-12 flex-1 rounded-(--radius) border border-(--border-strong) bg-white px-4 text-sm outline-none transition focus:border-(--accent) focus:ring-2 focus:ring-(--accent-ring)"
          />
          <button
            type="submit"
            className="h-12 rounded-(--radius) bg-(--accent) px-6 text-sm font-semibold text-white transition hover:bg-(--accent-hover)"
          >
            Cari
          </button>
        </form>

        {events.length === 0 ? (
          <EmptyState
            title="Event tidak ditemukan"
            description={q ? `Tidak ada hasil untuk "${q}". Coba kata kunci lain.` : "Belum ada event yang dipublikasikan."}
            actionLabel="Kembali ke beranda"
            actionHref="/"
          />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </Container>
    </div>
  );
}
