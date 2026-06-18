import type { IconType } from "react-icons";
import {
  HiOutlineBanknotes,
  HiOutlineCalendarDays,
  HiOutlineChartBar,
  HiOutlineReceiptPercent,
  HiOutlineTicket,
} from "react-icons/hi2";

type Accent = "orange" | "teal" | "blue" | "violet" | "indigo";

const styles: Record<Accent, { Icon: IconType; iconBg: string; iconColor: string }> = {
  orange: {
    Icon: HiOutlineCalendarDays,
    iconBg: "bg-orange-50",
    iconColor: "text-orange-500",
  },
  teal: {
    Icon: HiOutlineBanknotes,
    iconBg: "bg-success-50",
    iconColor: "text-success-500",
  },
  blue: {
    Icon: HiOutlineTicket,
    iconBg: "bg-brand-50",
    iconColor: "text-brand-500",
  },
  violet: {
    Icon: HiOutlineReceiptPercent,
    iconBg: "bg-brand-50",
    iconColor: "text-brand-500",
  },
  indigo: {
    Icon: HiOutlineChartBar,
    iconBg: "bg-brand-50",
    iconColor: "text-brand-500",
  },
};

type Props = {
  label: string;
  value: string | number;
  hint?: string;
  accent?: Accent;
};

export function StatCard({ label, value, hint, accent = "indigo" }: Props) {
  const { Icon, iconBg, iconColor } = styles[accent];

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            {value}
          </p>
          {hint && <p className="mt-1.5 text-xs text-gray-400">{hint}</p>}
        </div>
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${iconBg} ${iconColor}`}
        >
          <Icon className="h-6 w-6" aria-hidden />
        </div>
      </div>
    </div>
  );
}
