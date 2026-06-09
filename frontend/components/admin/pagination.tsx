import { Button } from "@/components/ui/button";

type Props = {
  page: number;
  perPage: number;
  total: number;
  onPageChange: (page: number) => void;
};

export function Pagination({ page, perPage, total, onPageChange }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  if (total <= perPage) return null;

  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-(--border) bg-stone-50/50 px-4 py-3">
      <p className="text-sm text-stone-500">
        Menampilkan {from}–{to} dari {total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Sebelumnya
        </Button>
        <span className="min-w-[4.5rem] text-center text-sm text-stone-600">
          {page} / {totalPages}
        </span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Berikutnya
        </Button>
      </div>
    </div>
  );
}
