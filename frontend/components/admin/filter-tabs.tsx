type Option = {
  value: string;
  label: string;
};

type Props = {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
};

export function FilterTabs({ options, value, onChange }: Props) {
  return (
    <div className="mb-5 flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value || "all"}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            value === opt.value
              ? "bg-(--accent) text-white shadow-sm"
              : "border border-(--border-strong) bg-white text-stone-600 hover:bg-stone-50"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
