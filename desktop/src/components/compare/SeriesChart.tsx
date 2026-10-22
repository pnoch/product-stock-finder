import { useState, useEffect, useMemo, useRef } from "react";
import { CURRENCY_SYMBOLS } from "@shared/currency";
import { convertPrice } from "@/lib/currency";
import { useTheme } from "../../hooks/use-theme";

export function clampChartWidth(measured: number): number {
  return Math.min(960, Math.max(320, Math.floor(measured)));
}

export function SeriesChart({
  series,
  displayCurrency,
}: {
  series: { label: string; color: string; data: { price: number; currency: string; date: string }[] }[];
  displayCurrency: string;
}) {
  // Theme-aware: the SVG hardcoded light greys, so in dark mode the grid/axis
  // labels were low-contrast (the only chart that still did).
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
  const width = measured === null ? 640 : clampChartWidth(measured);
  const height = 280;
  const padL = 56;
  const padR = 16;
  const padT = 16;
  const padB = 32;
  const usableW = width - padL - padR;
  const usableH = height - padT - padB;

  const allPrices: number[] = [];
  for (const s of series) {
    for (const p of s.data) {
      const c = convertPrice(p.price, p.currency, displayCurrency);
      if (c !== null && Number.isFinite(c)) allPrices.push(c);
    }
  }
  // Hooks must run unconditionally: an early return before useState/useMemo
  // makes React throw "Rendered more hooks than during the previous render"
  // when the chart transitions from empty to non-empty.
  const [hover, setHover] = useState<{ x: number; y: number; idx: number } | null>(null);
  const sortedSeries = series.map((s) => ({
    ...s,
    sorted: [...s.data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
  }));
  const chartA11yLabel = useMemo(() => {
    let up = 0;
    let down = 0;
    for (const s of sortedSeries) {
      if (s.sorted.length < 2) continue;
      const firstPt = s.sorted[0];
      const lastPt = s.sorted[s.sorted.length - 1];
      const firstConv = convertPrice(firstPt.price, firstPt.currency, displayCurrency);
      const lastConv = convertPrice(lastPt.price, lastPt.currency, displayCurrency);
      const first = firstConv ?? firstPt.price;
      const last = lastConv ?? lastPt.price;
      if (last > first) up += 1;
      else if (last < first) down += 1;
    }
    const direction = up > down ? "up" : down > up ? "down" : "mixed";
    const n = sortedSeries.length;
    return `Price history, ${n} distributor${n === 1 ? "" : "s"}, trending ${direction}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, displayCurrency]);

  if (allPrices.length === 0) {
    return <div className="text-center text-sm text-gray-400 py-8">No data</div>;
  }
  const globalMin = Math.min(...allPrices);
  const globalMax = Math.max(...allPrices);
  const range = globalMax - globalMin || 1;
  const allDates: number[] = [];
  for (const s of series)
    for (const p of s.data) {
      // Filter invalid dates: a single NaN makes Math.min/max NaN, which
      // propagates into every x-coordinate and blanks the chart. Mobile's
      // MultiLineChart guards the same way.
      const t = new Date(p.date).getTime();
      if (!Number.isNaN(t)) allDates.push(t);
    }
  if (allDates.length === 0) {
    return <div className="text-center text-sm text-gray-400 py-8">No data</div>;
  }
  const minDate = Math.min(...allDates);
  const maxDate = Math.max(...allDates);
  const dateRange = maxDate - minDate || 1;
  const symbol = CURRENCY_SYMBOLS[displayCurrency] ?? displayCurrency;

  return (
    <div ref={wrapRef} className="w-full">
      <div className="relative mx-auto" style={{ width, height }}>
        <svg
          width={width}
          height={height}
          className="block"
          role="img"
          aria-label={chartA11yLabel}
          onMouseMove={(e) => {
            const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
            const mx = e.clientX - rect.left;
            // find nearest date index from first series
            const firstSorted = sortedSeries[0]?.sorted;
            if (!firstSorted || firstSorted.length === 0) return;
            let bestIdx = 0;
            let bestDist = Infinity;
            firstSorted.forEach((p, i) => {
              const x = padL + ((new Date(p.date).getTime() - minDate) / dateRange) * usableW;
              const d = Math.abs(x - mx);
              if (d < bestDist) { bestDist = d; bestIdx = i; }
            });
            const px = padL + ((new Date(firstSorted[bestIdx].date).getTime() - minDate) / dateRange) * usableW;
            setHover({ x: px, y: padT, idx: bestIdx });
          }}
          onMouseLeave={() => setHover(null)}
        >
          {[0, 0.5, 1].map((t) => {
            const y = padT + (1 - t) * usableH;
            const val = globalMin + t * range;
            return (
              <g key={t}>
                <line x1={padL} y1={y} x2={width - padR} y2={y} stroke={gridStroke} strokeDasharray="4,4" strokeWidth={0.5} />
                <text x={padL - 6} y={y + 3} fontSize={9} fill={tickFill} textAnchor="end">
                  {symbol}
                  {val.toFixed(0)}
                </text>
              </g>
            );
          })}
          {sortedSeries.map((s) => {
            const coords = s.sorted
              .map((p) => {
                const conv = convertPrice(p.price, p.currency, displayCurrency);
                if (conv === null || !Number.isFinite(conv)) return null;
                const t = new Date(p.date).getTime();
                if (Number.isNaN(t)) return null;
                const x = padL + ((t - minDate) / dateRange) * usableW;
                const y = padT + (1 - (conv - globalMin) / range) * usableH;
                return { x, y };
              })
              .filter((c): c is { x: number; y: number } => c !== null);
            if (coords.length < 2) return null;
            const points = coords.map((c) => `${c.x},${c.y}`).join(" ");
            return (
              <g key={s.label}>
                <polyline points={points} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                {coords.map((c, i) => (
                  <circle key={i} cx={c.x} cy={c.y} r={hover?.idx === i ? 4 : 2.5} fill={s.color} stroke={hover?.idx === i ? "#fff" : "none"} strokeWidth={hover?.idx === i ? 1.5 : 0} />
                ))}
              </g>
            );
          })}
          {hover && <line x1={hover.x} y1={padT} x2={hover.x} y2={height - padB} stroke={isDark ? "#3B7DD8" : "#0F52BA"} strokeDasharray="4 4" strokeOpacity={0.35} />}
          {(() => {
            if (sortedSeries[0]?.sorted.length === 0) return null;
            const first = sortedSeries[0]?.sorted ?? [];
            if (first.length === 0) return null;
            const idxs = [0, Math.floor((first.length - 1) / 2), first.length - 1];
            return idxs.map((idx) => {
              const p = first[idx];
              if (!p) return null;
              const x = padL + ((new Date(p.date).getTime() - minDate) / dateRange) * usableW;
              const label = new Date(p.date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
              return (
                <text key={idx} x={x} y={height - 8} fontSize={9} fill={tickFill} textAnchor="middle">
                  {label}
                </text>
              );
            });
          })()}
        </svg>
        {hover && (
          <div
            className="absolute z-10 rounded-xl border bg-white dark:bg-gray-800 dark:border-gray-700 shadow-lg px-3 py-2 text-xs pointer-events-none"
            style={{ left: Math.min(Math.max(hover.x + 12, 8), width - 160), top: 12 }}
          >
            <p className="font-semibold text-gray-700 dark:text-gray-200 mb-1">
              {new Date(sortedSeries[0].sorted[hover.idx]?.date ?? "").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            </p>
            {sortedSeries.map((s, i) => {
              const pt = s.sorted[hover.idx];
              if (!pt) return null;
              const conv = convertPrice(pt.price, pt.currency, displayCurrency);
              if (conv === null) return null;
              return (
                <p key={s.label} className="flex items-center gap-2 animate-fadeIn" style={{ animationDelay: `${i * 55}ms` } as React.CSSProperties}>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                  <span className="text-gray-500 dark:text-gray-400 truncate max-w-[90px]">{s.label}</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100 ml-auto">{symbol}{conv.toFixed(2)}</span>
                </p>
              );
            })}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2 mt-3 justify-center">
        {series.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-white dark:bg-gray-800 shadow-sm border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

