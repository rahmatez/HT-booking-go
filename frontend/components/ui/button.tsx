import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-(--accent) text-white hover:bg-(--accent-hover) shadow-sm active:scale-[0.98]",
  secondary:
    "bg-white text-foreground border border-(--border-strong) hover:bg-stone-50 active:scale-[0.98]",
  ghost: "text-(--fg-muted) hover:text-foreground hover:bg-stone-100/80",
  danger: "bg-(--danger) text-white hover:bg-red-800",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm gap-1.5",
  md: "h-11 px-5 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = "primary", size = "md", fullWidth, className = "", children, ...props }, ref) => (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center rounded-(--radius) font-semibold transition-all duration-150 disabled:pointer-events-none disabled:opacity-45 ${variants[variant]} ${sizes[size]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
);
Button.displayName = "Button";
