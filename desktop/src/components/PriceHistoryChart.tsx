import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "../hooks/use-theme";
import { convertPrice } from "@/lib/currency";
import { CURRENCY_SYMBOLS } from "@shared/currency";
import type { PricePoint } from "../../../lib/types";

const HEIGHT = 300;
const PAD_L = 56;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 32;

function lineColor(isDark: boolean): string {
  return isDark ? "#3B7DD8" : "#0F52BA";
}

export function PriceHistoryChart({
  history,
  displayCurrency,
}: {
  history: PricePoint[];
  displayCurrency: string;
}) {
  // Theme-aware: the axis/grid/tooltip colours follow the app scheme.
  const { isDark } = useTheme();
  const gridStroke = isDark ? "#374151" : "#e5e7eb";
  const tickFill = isDark ? "#9ca3af" : "#6b7280";

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [measured, setMeasured] = useState<number | null>(null);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (typeof w === "number" && Number.isFinite(w)) setMeasured(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [hover, setHover] = useState<number | null>(null);

  const points = useMemo(
    () =>
      history
        .map((p) => {
          // Skip unconvertible points rather than plotting the raw price, which
          // would mix currencies on a chart labelled in the display currency.
          const price = convertPrice(p.price, p.currency, displayCurrency);
          if (price === null || !Number.isFinite(price)) return null;
          return {
            date: new Date(p.date).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            }),
            price,
          };
        })
        .filter((pt): pt is { date: string; price: number } => pt !== null),
    [history, displayCurrency],
  );

  if (points.length === 0)
    return <div className="text-center text-sm text-gray-400 py-8">No data</div>;

  const width = measured === null ? 640 : Math.min(960, Math.max(320, Math.floor(measured)));
  const usableW = width - PAD_L - PAD_R;
  const usableH = HEIGHT - PAD_T - PAD_B;
  const prices = points.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const symbol = CURRENCY_SYMBOLS[displayCurrency] ?? displayCurrency;
  const stroke = lineColor(isDark);

  const xFor = (i: number) =>
    points.length === 1 ? PAD_L + usableW / 2 : PAD_L + (i / (points.length - 1)) * usableW;
  const yFor = (price: number) => PAD_T + (1 - (price - min) / range) * usableH;
  const coords = points.map((p, i) => ({ x: xFor(i), y: yFor(p.price) }));

  const tickIdxs = Array.from(
    new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]),
  );

  return (
    <div ref={wrapRef} className="w-full">
      <div className="relative mx-auto" style={{ width, height: HEIGHT }}>
        <svg
          width={width}
          height={HEIGHT}
          className="block"
          role="img"
          aria-label={`Price history, ${points.length} point${points.length === 1 ? "" : "s"}`}
          onMouseMove={(e) => {
            const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const mx = e.clientX - rect.left;
            let best = 0;
            let bestDist = Infinity;
            coords.forEach((c, i) => {
              const d = Math.abs(c.x - mx);
              if (d < bestDist) {
                bestDist = d;
                best = i;
              }
            });
            setHover(best);
          }}
          onMouseLeave={() => setHover(null)}
        >
          {[0, 0.5, 1].map((t) => {
            const y = PAD_T + (1 - t) * usableH;
            return (
              <g key={t}>
                <line
                  x1={PAD_L}
                  y1={y}
                  x2={width - PAD_R}
                  y2={y}
                  stroke={gridStroke}
                  strokeDasharray="4,4"
                  strokeWidth={0.5}
                />
                <text x={PAD_L - 6} y={y + 3} fontSize={9} fill={tickFill} textAnchor="end">
                  {symbol}
                  {(min + t * range).toFixed(0)}
                </text>
              </g>
            );
          })}
          <polyline
            points={coords.map((c) => `${c.x},${c.y}`).join(" ")}
            fill="none"
            stroke={stroke}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {coords.map((c, i) => (
            <circle key={i} cx={c.x} cy={c.y} r={hover === i ? 4 : 2} fill={stroke} />
          ))}
          {hover !== null && (
            <line
              x1={coords[hover].x}
              y1={PAD_T}
              x2={coords[hover].x}
              y2={HEIGHT - PAD_B}
              stroke={stroke}
              strokeDasharray="4 4"
              strokeOpacity={0.35}
            />
          )}
          {tickIdxs.map((i) => (
            <text
              key={i}
              x={coords[i].x}
              y={HEIGHT - 8}
              fontSize={9}
              fill={tickFill}
              textAnchor="middle"
            >
              {points[i].date}
            </text>
          ))}
        </svg>
        {hover !== null && (
          <div
            className="absolute z-10 rounded-xl border bg-white dark:bg-gray-800 dark:border-gray-700 shadow-lg px-3 py-2 text-xs pointer-events-none"
            style={{
              borderColor: gridStroke,
              left: Math.min(Math.max(coords[hover].x + 12, 8), width - 140),
              top: 12,
            }}
          >
            <p className="font-semibold text-gray-700 dark:text-gray-200 mb-1">
              {points[hover].date}
            </p>
            <p className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: stroke }}
              />
              <span className="text-gray-500 dark:text-gray-400">Price:</span>
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {symbol}
                {points[hover].price.toFixed(2)}
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
