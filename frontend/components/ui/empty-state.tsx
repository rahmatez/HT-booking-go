import Link from "next/link";
import { Button } from "./button";

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-stone-300 bg-white px-8 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-100 text-2xl">
        🎫
      </div>
      <h3 className="text-lg font-semibold text-stone-900">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-stone-500">{description}</p>
      )}
      {actionLabel && actionHref && (
        <Link href={actionHref} className="mt-6">
          <Button>{actionLabel}</Button>
        </Link>
      )}
    </div>
  );
}
