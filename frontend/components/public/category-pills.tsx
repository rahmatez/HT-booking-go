import Link from "next/link";
import { AllCategoriesIcon, getCategoryIcon } from "@/components/public/public-icons";

export type Category = {
  id: string;
  slug: string;
  name: string;
};

type Props = {
  categories: Category[];
  activeSlug?: string;
  baseHref?: string;
};

export function CategoryPills({ categories, activeSlug, baseHref = "/events" }: Props) {
  if (categories.length === 0) return null;

  return (
    <div className="border-b border-(--border) bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="hide-scrollbar flex gap-2 overflow-x-auto py-4">
          <Link
            href={baseHref}
            className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
              !activeSlug
                ? "bg-(--accent) text-white shadow-sm"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <AllCategoriesIcon className="h-4 w-4 shrink-0" aria-hidden />
            Semua
          </Link>
          {categories.map((cat) => {
            const href =
              baseHref === "/events"
                ? `/events?category=${cat.slug}`
                : `${baseHref}&category=${cat.slug}`;
            const active = activeSlug === cat.slug;
            const Icon = getCategoryIcon(cat.slug);
            return (
              <Link
                key={cat.id}
                href={href}
                className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-(--accent) text-white shadow-sm"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {cat.name}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
