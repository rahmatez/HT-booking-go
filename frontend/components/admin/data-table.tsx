import { ReactNode } from "react";

type Props = {
  children: ReactNode;
  footer?: ReactNode;
};

export function DataTable({ children, footer }: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-(--border) bg-white shadow-(--shadow-sm)">
      <div className="overflow-x-auto">{children}</div>
      {footer}
    </div>
  );
}

export function TableLoading({ label = "Memuat data..." }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-(--border) bg-white px-6 py-12 text-stone-500">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-stone-200 border-t-(--accent)" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
