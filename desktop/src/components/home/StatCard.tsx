export function StatCard({
  icon,
  label,
  value,
  delay = 0,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  delay?: number;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      </div>
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-4 p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-brand-200 dark:hover:border-brand-700 transition-colors duration-150 animate-fadeIn cursor-pointer text-left w-full motion-reduce:animate-none"
        style={{ animationDelay: `${delay}ms` }}
        aria-label={label}
      >
        {content}
      </button>
    );
  }
  return (
    <div
      className="flex items-center gap-4 p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-brand-200 dark:hover:border-brand-700 transition-colors duration-150 animate-fadeIn motion-reduce:animate-none"
      style={{ animationDelay: `${delay}ms` }}
    >
      {content}
    </div>
  );
}
