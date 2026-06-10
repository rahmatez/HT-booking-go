import Link from "next/link";

type Props = {
  title: string;
  subtitle?: string;
  href?: string;
  linkLabel?: string;
};

export function SectionHeader({ title, subtitle, href, linkLabel = "Lihat semua" }: Props) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4 sm:mb-8">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {href && (
        <Link
          href={href}
          className="shrink-0 text-sm font-semibold text-(--accent) transition hover:text-(--accent-hover)"
        >
          {linkLabel} →
        </Link>
      )}
    </div>
  );
}
