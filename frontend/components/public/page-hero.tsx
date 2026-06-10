type Props = {
  title: string;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
};

export function PageHero({ title, subtitle, children }: Props) {
  return (
    <div className="border-b border-(--border) bg-white py-8 sm:py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-slate-500">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}
