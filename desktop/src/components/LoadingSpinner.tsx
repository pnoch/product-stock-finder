export function LoadingSpinner({ size = "small", label }: { size?: "small" | "large"; label?: string }) {
  const spinnerSize = size === "large" ? "w-8 h-8 border-[3px]" : "w-5 h-5 border-2";
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className={`${spinnerSize} border-brand-600 border-t-transparent rounded-full animate-spin`} />
      {label && <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>}
    </div>
  );
}
