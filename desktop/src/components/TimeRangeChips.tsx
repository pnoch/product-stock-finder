const ranges = [
  { key: "1w", label: "1W" },
  { key: "1m", label: "1M" },
  { key: "3m", label: "3M" },
  { key: "all", label: "All" },
];

export function TimeRangeChips({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (r: string) => void;
}) {
  return (
    <div className="flex gap-1">
      {ranges.map((r) => (
        <button
          key={r.key}
          onClick={() => onSelect(r.key)}
          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
            selected === r.key
              ? "bg-brand-600 text-white"
              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
