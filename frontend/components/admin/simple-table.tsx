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
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            {headers.map((h) => (
              <th
                key={h}
                className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-500"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, i) => (
            <tr key={i} className="transition hover:bg-brand-50/40">
              {row.map((cell, j) => (
                <td key={j} className="px-5 py-4 text-gray-700">
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
