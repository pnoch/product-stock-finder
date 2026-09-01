import { StockStatus } from "../../../lib/types";

const config: Record<
  StockStatus,
  { bg: string; text: string; dot: string; label: string }
> = {
  in_stock: {
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
    text: "text-emerald-700 dark:text-emerald-400",
    dot: "bg-emerald-500",
    label: "In Stock",
  },
  back_order: {
    bg: "bg-amber-100 dark:bg-amber-900/30",
    text: "text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
    label: "Back Order",
  },
  out_of_stock: {
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-400",
    dot: "bg-red-500",
    label: "Out of Stock",
  },
  unknown: {
    bg: "bg-gray-100 dark:bg-gray-800",
    text: "text-gray-600 dark:text-gray-400",
    dot: "bg-gray-400",
    label: "Unknown",
  },
};

export function StockBadge({
  status,
  expectedDate,
}: {
  status: StockStatus;
  expectedDate?: string;
}) {
  const c = config[status] ?? config.unknown;
  const formattedDate = expectedDate
    ? new Date(expectedDate).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
      {formattedDate ? ` · ${formattedDate}` : ""}
    </span>
  );
}
