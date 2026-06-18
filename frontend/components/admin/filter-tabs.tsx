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
    <div className="mb-5 inline-flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
      {options.map((opt) => (
        <button
          key={opt.value || "all"}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-all ${
            value === opt.value
              ? "bg-white text-brand-500 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
