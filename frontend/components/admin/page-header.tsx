import { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  action?: ReactNode;
  badge?: string;
};

export function PageHeader({ title, description, action, badge }: Props) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <header className="min-w-0">
        {badge && (
          <span className="mb-2 inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-500">
            {badge}
          </span>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">{title}</h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-gray-500">{description}</p>
        )}
      </header>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}
