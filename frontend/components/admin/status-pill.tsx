type Props = {
  label: string;
  toneClass?: string;
};

export function StatusPill({ label, toneClass = "bg-gray-100 text-gray-600" }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${toneClass}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
      {label}
    </span>
  );
}
