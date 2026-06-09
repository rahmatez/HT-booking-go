type Tone = "default" | "success" | "warning" | "danger" | "neutral";

const tones: Record<Tone, string> = {
  default: "bg-(--accent-soft) text-(--accent)",
  success: "bg-(--success-soft) text-(--success)",
  warning: "bg-(--warning-soft) text-(--warning)",
  danger: "bg-(--danger-soft) text-(--danger)",
  neutral: "bg-stone-100 text-stone-600",
};

export function Badge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
