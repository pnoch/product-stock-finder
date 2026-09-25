import { TIME_RANGES } from "@shared/compare-utils";

// Derived from the shared list so the chips can't drift from the ranges the
// chart actually supports (the desktop previously hard-coded them and, unlike
// mobile's chips, never exposed which range was selected).
export function TimeRangeChips({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (r: string) => void;
}) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Time range">
      {TIME_RANGES.map((range) => {
        const key = range.toLowerCase();
        return (
          <button
            key={key}
            onClick={() => onSelect(key)}
            role="radio"
            aria-checked={selected === key}
            aria-label={`Select time range: ${range}`}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              selected === key
                ? "bg-brand-600 text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            {range}
          </button>
        );
      })}
    </div>
  );
}
