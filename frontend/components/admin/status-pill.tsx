type Props = {
  label: string;
  toneClass?: string;
};

export function StatusPill({ label, toneClass = "bg-stone-100 text-stone-600" }: Props) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${toneClass}`}
    >
      {label}
    </span>
  );
}
