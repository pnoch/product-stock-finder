import { formatPrice } from "@shared/currency";

export function PriceSparkline({ history, currency }: { history: { price: number }[]; currency: string }) {
  if (history.length < 2) {
    return <div className="h-8 w-24 bg-gray-100 dark:bg-gray-800 rounded" />;
  }

  const prices = history.map((h) => h.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const w = 96;
  const h = 32;
  const padding = 2;

  const points = prices
    .map((p, i) => {
      const x = padding + (i / (prices.length - 1)) * (w - padding * 2);
      const y = h - padding - ((p - min) / range) * (h - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const isDown = prices[prices.length - 1] < prices[0];
  const strokeColor = isDown ? "#10b981" : "#ef4444";
  const firstPrice = prices[0];
  const lastPrice = prices[prices.length - 1];
  const trend = lastPrice < firstPrice ? "down" : lastPrice > firstPrice ? "up" : "flat";
  const sparklineLabel = `Price sparkline, trending ${trend}, ${formatPrice(firstPrice, currency)} to ${formatPrice(lastPrice, currency)}`;

  return (
    <svg width={w} height={h} className="shrink-0" role="img" aria-label={sparklineLabel}>
      <polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

