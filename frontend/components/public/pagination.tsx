import Link from "next/link";

type Props = {
  page: number;
  perPage: number;
  total: number;
  baseParams: Record<string, string>;
};

export function Pagination({ page, perPage, total, baseParams }: Props) {
  const totalPages = Math.ceil(total / perPage);
  if (totalPages <= 1) return null;

  function hrefFor(p: number) {
    const qs = new URLSearchParams(baseParams);
    qs.set("page", String(p));
    return `/events?${qs}`;
  }

  return (
    <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Pagination">
      {page > 1 && (
        <Link
          href={hrefFor(page - 1)}
          className="rounded-(--radius) border border-(--border) bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          ← Sebelumnya
        </Link>
      )}
      <span className="px-3 text-sm text-slate-500">
        Halaman {page} dari {totalPages}
      </span>
      {page < totalPages && (
        <Link
          href={hrefFor(page + 1)}
          className="rounded-(--radius) border border-(--border) bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Selanjutnya →
        </Link>
      )}
    </nav>
  );
}
