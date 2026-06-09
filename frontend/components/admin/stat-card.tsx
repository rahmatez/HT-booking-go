type Props = {
  label: string;
  value: string | number;
  hint?: string;
};

export function StatCard({ label, value, hint }: Props) {
  return (
    <div className="rounded-2xl border border-(--border) bg-white p-5 shadow-(--shadow-sm)">
      <p className="text-sm font-medium text-stone-500">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-stone-900">{value}</p>
      {hint && <p className="mt-1.5 text-xs text-stone-400">{hint}</p>}
    </div>
  );
}
