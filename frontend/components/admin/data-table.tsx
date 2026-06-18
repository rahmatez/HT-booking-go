import { ReactNode } from "react";

type Props = {
  children: ReactNode;
  footer?: ReactNode;
};

export function DataTable({ children, footer }: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">{children}</div>
      {footer}
    </div>
  );
}

export function TableLoading({ label = "Memuat data..." }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-6 py-14 text-gray-500">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-brand-500" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
