import { InputHTMLAttributes, forwardRef } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, Props>(
  ({ label, hint, error, className = "", id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-stone-700">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`h-11 w-full rounded-(--radius) border bg-white px-3.5 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-(--accent) focus:ring-2 focus:ring-(--accent-ring) ${error ? "border-red-400 focus:border-red-500 focus:ring-red-200" : "border-(--border-strong)"} ${className}`}
          {...props}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        {hint && !error && <p className="text-xs text-stone-500">{hint}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";
