type Accent = "orange" | "teal" | "blue" | "violet";

const accents: Record<Accent, string> = {
  orange: "border-l-orange-500",
  teal: "border-l-teal-600",
  blue: "border-l-blue-600",
  violet: "border-l-violet-600",
};

type Props = {
  label: string;
  value: string | number;
  hint?: string;
  accent?: Accent;
};

export function StatCard({ label, value, hint, accent = "orange" }: Props) {
  return (
    <div
      className={`rounded-2xl border border-(--border) border-l-4 bg-white p-5 shadow-(--shadow-sm) ${accents[accent]}`}
    >
      <p className="text-sm font-medium text-stone-500">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">{value}</p>
      {hint && <p className="mt-1.5 text-xs text-stone-400">{hint}</p>}
    </div>
  );
}
