import { EventCard } from "@/components/event-card";
import { CategoryPills } from "@/components/public/category-pills";
import { EventSearchForm } from "@/components/public/event-search-form";
import { EventsFilterPanel } from "@/components/public/events-filter-panel";
import { Pagination } from "@/components/public/pagination";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { api } from "@/lib/api";

const PER_PAGE = 20;

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    city?: string;
    date_from?: string;
    date_to?: string;
    price_min?: string;
    price_max?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const q = params.q || "";
  const category = params.category || "";
  const city = params.city || "";
  const dateFrom = params.date_from || "";
  const dateTo = params.date_to || "";
  const priceMin = params.price_min ? Number(params.price_min) : undefined;
  const priceMax = params.price_max ? Number(params.price_max) : undefined;
  const page = Number(params.page) || 1;

  let events: Awaited<ReturnType<typeof api.listEvents>>["data"] = [];
  let total = 0;
  let categories: Awaited<ReturnType<typeof api.listCategories>> = [];

  try {
    const [res, cats] = await Promise.all([
      api.listEvents({
        q,
        category,
        city,
        date_from: dateFrom,
        date_to: dateTo,
        price_min: priceMin,
        price_max: priceMax,
        page,
      }),
      api.listCategories().catch(() => []),
    ]);
    events = res.data;
    total = res.meta?.total || 0;
    categories = cats;
  } catch {
    events = [];
  }

  const baseParams: Record<string, string> = {};
  if (q) baseParams.q = q;
  if (category) baseParams.category = category;
  if (city) baseParams.city = city;
  if (dateFrom) baseParams.date_from = dateFrom;
  if (dateTo) baseParams.date_to = dateTo;
  if (priceMin) baseParams.price_min = String(priceMin);
  if (priceMax) baseParams.price_max = String(priceMax);

  return (
    <>
      <div className="border-b border-(--border) bg-white py-8 sm:py-10">
        <Container wide>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Cari Event</h1>
          <p className="mt-2 text-sm text-slate-500">
            {total > 0
              ? `${total} event ditemukan`
              : "Temukan konser, festival, workshop, dan acara menarik lainnya"}
          </p>
          <div className="mt-6">
            <EventSearchForm defaultQ={q} defaultCity={city} />
          </div>
        </Container>
      </div>

      <CategoryPills categories={categories} activeSlug={category || undefined} />

      <div className="py-10 sm:py-12">
        <Container wide>
          <EventsFilterPanel
            q={q}
            category={category}
            city={city}
            dateFrom={dateFrom}
            dateTo={dateTo}
            priceMin={priceMin}
            priceMax={priceMax}
          />

          {events.length === 0 ? (
            <EmptyState
              title="Event tidak ditemukan"
              description={
                q || category || city
                  ? "Tidak ada hasil untuk filter ini. Coba kata kunci lain."
                  : "Belum ada event yang dipublikasikan."
              }
              actionLabel="Kembali ke beranda"
              actionHref="/"
            />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {events.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
              <Pagination
                page={page}
                perPage={PER_PAGE}
                total={total}
                baseParams={baseParams}
              />
            </>
          )}
        </Container>
      </div>
    </>
  );
}
