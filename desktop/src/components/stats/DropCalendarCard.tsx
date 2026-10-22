import { Link } from "react-router";
import { formatPrice } from "@shared/currency";
import { dateKey, type DropCalendarResult } from "../../../../lib/drop-calendar";

export function DropCalendarCard({
  dropCalendar,
  dropCalendarCells,
  selectedKey,
  onSelectKey,
  displayCurrency,
}: {
  dropCalendar: DropCalendarResult;
  dropCalendarCells: (number | null)[];
  selectedKey: string | null;
  onSelectKey: (key: string | null) => void;
  displayCurrency: string;
}) {
  return (
    <div className="p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors duration-150">
      <p className="text-sm text-gray-500 dark:text-gray-400">Drop Calendar</p>
      <p className="text-lg font-bold mt-1">
        {dropCalendar.totalDrops} price drop{dropCalendar.totalDrops === 1 ? "" : "s"} in the last 30 days
      </p>
      <div className="grid grid-cols-7 gap-1 mt-3" role="grid" aria-label="Price drop calendar, last 30 days">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={`hdr-${i}`} className="w-8 h-4 flex items-center justify-center text-[10px] font-medium text-gray-400" aria-hidden>
            {d}
          </div>
        ))}
        {dropCalendarCells.map((ts, i) => {
          if (ts === null) {
            return <div key={`blank-${i}`} className="w-8 h-8" aria-hidden />;
          }
          const key = dateKey(ts);
          const day = dropCalendar.byDay.get(key);
          const dropCount = day?.dropCount ?? 0;
          const hasDrops = dropCount > 0;
          const label = hasDrops
            ? `${key}: ${dropCount} ${dropCount === 1 ? "drop" : "drops"}, biggest ${day?.biggestPct}%`
            : key;
          if (hasDrops) {
            return (
              <button
                key={key}
                type="button"
                role="gridcell"
                title={label}
                aria-label={label}
                aria-pressed={selectedKey === key}
                onClick={() => onSelectKey(selectedKey === key ? null : key)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium ${
                  selectedKey === key
                    ? "bg-brand-600 text-white ring-2 ring-brand-400"
                    : "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                }`}
              >
                {Number(key.slice(8, 10))}
              </button>
            );
          }
          return (
            <div
              key={key}
              title={label}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-400"
            >
              {Number(key.slice(8, 10))}
            </div>
          );
        })}
      </div>
      {selectedKey && dropCalendar.byDay.get(selectedKey) && (
        <div className="mt-2">
          <p>Drops on {selectedKey}</p>
          {dropCalendar.byDay.get(selectedKey)!.drops.map((drop) => (
            <Link key={`${drop.productId}-${drop.distributorId}-${drop.from}-${drop.to}`} to={`/product/${drop.productId}`} className="flex items-center gap-2 py-1 text-sm hover:underline">
              <span className="truncate">{drop.name}</span>
              <span>{formatPrice(drop.from, displayCurrency)} → {formatPrice(drop.to, displayCurrency)}</span>
              <span>{drop.percent.toFixed(0)}%</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
