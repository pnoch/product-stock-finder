import type { DistributorListing } from "../../../../lib/types";

export function WatchlistRowSparkline({
  listings,
}: {
  listings: DistributorListing[];
}) {
  const history = listings
    .flatMap((l) => l.priceHistory ?? [])
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-10);
  if (history.length < 2) return null;
  const prices = history.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const w = 64,
    h = 24,
    pad = 3;
  const coords = history
    .map((p, i) => {
      const x = pad + (i / (history.length - 1)) * (w - pad * 2);
      const y = pad + (1 - (p.price - min) / range) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");
  const color =
    prices[prices.length - 1]! >= prices[0]!
      ? range === 0
        ? "#9CA3AF"
        : "#EF4444"
      : "#10B981";
  return (
    <svg
      width={w}
      height={h}
      className="mt-1 block"
      role="img"
      aria-label={`Price sparkline ${history.length} point${
        history.length === 1 ? "" : "s"
      }`}
    >
      <polyline
        points={coords}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle
        cx={Number(coords.split(" ").pop()!.split(",")[0])}
        cy={Number(coords.split(" ").pop()!.split(",")[1])}
        r={2.5}
        fill={color}
      />
    </svg>
  );
}
