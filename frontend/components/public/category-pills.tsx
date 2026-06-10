import Link from "next/link";

export type Category = {
  id: string;
  slug: string;
  name: string;
};

const categoryIcons: Record<string, string> = {
  musik: "🎵",
  music: "🎵",
  konser: "🎤",
  festival: "🎪",
  olahraga: "⚽",
  sports: "⚽",
  workshop: "💡",
  seminar: "📚",
  teater: "🎭",
  komedi: "😂",
  default: "🎫",
};

function iconFor(slug: string) {
  const key = slug.toLowerCase();
  for (const [k, icon] of Object.entries(categoryIcons)) {
    if (key.includes(k)) return icon;
  }
  return categoryIcons.default;
}

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
            <span>✨</span>
            Semua
          </Link>
          {categories.map((cat) => {
            const href =
              baseHref === "/events"
                ? `/events?category=${cat.slug}`
                : `${baseHref}&category=${cat.slug}`;
            const active = activeSlug === cat.slug;
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
                <span>{iconFor(cat.slug)}</span>
                {cat.name}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
