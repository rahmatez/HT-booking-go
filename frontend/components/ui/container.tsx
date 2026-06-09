export function Container({
  children,
  className = "",
  narrow,
}: {
  children: React.ReactNode;
  className?: string;
  narrow?: boolean;
}) {
  return (
    <div
      className={`mx-auto w-full px-4 sm:px-6 ${narrow ? "max-w-3xl" : "max-w-6xl"} ${className}`}
    >
      {children}
    </div>
  );
}
