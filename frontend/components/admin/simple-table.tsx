import { ReactNode } from "react";
import { DataTable } from "./data-table";
import { EmptyState } from "@/components/ui/empty-state";

type Props = {
  headers: string[];
  rows: ReactNode[][];
  emptyTitle?: string;
  emptyDescription?: string;
};

export function SimpleTable({ headers, rows, emptyTitle = "Tidak ada data", emptyDescription }: Props) {
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }
  return (
    <DataTable>
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-(--border) bg-stone-50/80">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 font-semibold text-stone-600">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-(--border) last:border-0 hover:bg-stone-50/60">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3.5 text-stone-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </DataTable>
  );
}
