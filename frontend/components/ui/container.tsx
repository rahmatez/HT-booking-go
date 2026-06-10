export function Container({
  children,
  className = "",
  narrow,
  wide,
}: {
  children: React.ReactNode;
  className?: string;
  narrow?: boolean;
  wide?: boolean;
}) {
  const maxW = narrow ? "max-w-3xl" : wide ? "max-w-7xl" : "max-w-6xl";
  return (
    <div className={`mx-auto w-full px-4 sm:px-6 ${maxW} ${className}`}>
      {children}
    </div>
  );
}
