import Link from "next/link";
import { BRAND_LOGO_LETTER } from "@/lib/brand";

type Props = {
  href?: string;
  showWordmark?: boolean;
  iconClassName?: string;
  wordmarkClassName?: string;
  accentClassName?: string;
  onClick?: () => void;
};

export function BrandWordmark({
  className = "",
  accentClassName = "text-(--accent)",
}: {
  className?: string;
  accentClassName?: string;
}) {
  return (
    <span className={className}>
      Event<span className={accentClassName}>ra</span>
    </span>
  );
}

export function BrandLogo({
  href = "/",
  showWordmark = true,
  iconClassName = "flex h-9 w-9 items-center justify-center rounded-xl bg-(--accent) text-sm font-black text-white",
  wordmarkClassName = "hidden text-base font-bold tracking-tight text-stone-900 sm:block",
  accentClassName = "text-(--accent)",
  onClick,
}: Props) {
  const content = (
    <>
      <span className={iconClassName}>{BRAND_LOGO_LETTER}</span>
      {showWordmark && (
        <BrandWordmark className={wordmarkClassName} accentClassName={accentClassName} />
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} className="flex items-center gap-2.5" onClick={onClick}>
        {content}
      </Link>
    );
  }

  return <div className="flex items-center gap-2.5">{content}</div>;
}
