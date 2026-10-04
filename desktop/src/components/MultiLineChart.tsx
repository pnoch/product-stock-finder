import { useEffect, useRef, useState } from "react";
import { useTheme } from "../hooks/use-theme";

const HEIGHT = 400;
const PAD_L = 56;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 48;

interface Props {
  data: Record<string, string | number>[];
  distributors: string[];
  colors: string[];
  currencySymbol?: string;
}

export function MultiLineChart({ data, distributors, colors, currencySymbol = "$" }: Props) {
  // Theme-aware, matching PriceHistoryChart: the earlier recharts version
  // hardcoded light-mode greys, so in dark mode the axes/legend/tooltip were
  // low-contrast (and the legend rendered as white chips on a dark page).
  const { isDark } = useTheme();
  const gridStroke = isDark ? "#374151" : "#e5e7eb";
  const axisStroke = isDark ? "#4b5563" : "#d1d5db";
  const tickFill = isDark ? "#9ca3af" : "#6b7280";
  const fallbackColor = isDark ? "#3B7DD8" : "#0F52BA";
  const colorFor = (i: number) => (colors.length > 0 ? colors[i % colors.length] : fallbackColor);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [measured, setMeasured] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
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

  const values: number[] = [];
  for (const row of data) {
    for (const d of distributors) {
      const v = row[d];
      if (typeof v === "number" && Number.isFinite(v)) values.push(v);
    }
  }
  if (data.length === 0 || values.length === 0) {
    return <div className="text-center text-sm text-gray-400 py-8">No data</div>;
  }

  const width = measured === null ? 720 : Math.min(1100, Math.max(320, Math.floor(measured)));
  const usableW = width - PAD_L - PAD_R;
  const usableH = HEIGHT - PAD_T - PAD_B;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const xFor = (i: number) =>
    data.length === 1 ? PAD_L + usableW / 2 : PAD_L + (i / (data.length - 1)) * usableW;
  const yFor = (v: number) => PAD_T + (1 - (v - min) / range) * usableH;

  const tickIdxs = Array.from(
    new Set([0, Math.floor((data.length - 1) / 2), data.length - 1]),
  );

  const series = distributors.map((d, i) => ({
    name: d,
    color: colorFor(i),
    coords: data
      .map((row, idx) => {
        const v = row[d];
        if (typeof v !== "number" || !Number.isFinite(v)) return null;
        return { x: xFor(idx), y: yFor(v), idx, value: v };
      })
      .filter((c): c is { x: number; y: number; idx: number; value: number } => c !== null),
  }));

  return (
    <div>
      <div ref={wrapRef} className="w-full">
        <div className="relative mx-auto" style={{ width, height: HEIGHT }}>
          <svg
            width={width}
            height={HEIGHT}
            className="block"
            role="img"
            aria-label={`Price history, ${distributors.length} distributor${distributors.length === 1 ? "" : "s"}`}
            onMouseMove={(e) => {
              const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
              const mx = e.clientX - rect.left;
              let best = 0;
              let bestDist = Infinity;
              for (let i = 0; i < data.length; i += 1) {
                const d = Math.abs(xFor(i) - mx);
                if (d < bestDist) {
                  bestDist = d;
                  best = i;
                }
              }
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
                    {currencySymbol}
                    {Math.round(min + t * range)}
                  </text>
                </g>
              );
            })}
            {series.map((s) => (
              <g key={s.name}>
                <polyline
                  points={s.coords.map((c) => `${c.x},${c.y}`).join(" ")}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {s.coords.map((c) => (
                  <circle
                    key={c.idx}
                    cx={c.x}
                    cy={c.y}
                    r={hover === c.idx ? 5 : 3}
                    fill={s.color}
                    stroke={isDark ? "#111827" : "#fff"}
                    strokeWidth={1}
                  />
                ))}
              </g>
            ))}
            {hover !== null && (
              <line
                x1={xFor(hover)}
                y1={PAD_T}
                x2={xFor(hover)}
                y2={HEIGHT - PAD_B}
                stroke={fallbackColor}
                strokeDasharray="4 4"
                strokeOpacity={0.35}
              />
            )}
            <line
              x1={PAD_L}
              y1={PAD_T + usableH}
              x2={width - PAD_R}
              y2={PAD_T + usableH}
              stroke={axisStroke}
            />
            {tickIdxs.map((i) => (
              <text
                key={i}
                x={xFor(i)}
                y={HEIGHT - 24}
                fontSize={11}
                fill={tickFill}
                textAnchor="middle"
              >
                {String(data[i].date)}
              </text>
            ))}
            <text x={width / 2} y={HEIGHT - 4} fontSize={11} fill={tickFill} textAnchor="middle">
              Date
            </text>
            <text
              x={12}
              y={PAD_T + usableH / 2}
              fontSize={11}
              fill={tickFill}
              textAnchor="middle"
              transform={`rotate(-90, 12, ${PAD_T + usableH / 2})`}
            >
              Price
            </text>
          </svg>
          {hover !== null && (
            <div
              className="absolute z-10 rounded-xl border bg-white dark:bg-gray-800 dark:border-gray-700 shadow-lg px-3 py-2 text-xs pointer-events-none"
              style={{
                borderColor: gridStroke,
                left: Math.min(Math.max(xFor(hover) + 12, 8), width - 180),
                top: 12,
              }}
            >
              <p className="font-semibold text-gray-700 dark:text-gray-200 mb-1">
                {String(data[hover].date)}
              </p>
              {series.map(
                (s) =>
                  s.coords.some((c) => c.idx === hover) &&
                  (() => {
                    const point = s.coords.find((c) => c.idx === hover);
                    if (!point) return null;
                    return (
                      <p key={s.name} className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: s.color }}
                        />
                        <span className="text-gray-500 dark:text-gray-400 truncate max-w-[110px]">
                          {s.name}
                        </span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100 ml-auto">
                          {currencySymbol}
                          {point.value.toFixed(2)}
                        </span>
                      </p>
                    );
                  })(),
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mt-3 justify-center">
        {distributors.map((d, i) => (
          <span
            key={d}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-white dark:bg-gray-800 shadow-sm border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: colorFor(i) }}
            />
            {d}
          </span>
        ))}
      </div>
    </div>
  );
}
