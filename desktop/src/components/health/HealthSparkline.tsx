import { useState } from "react";

export function HealthSparkline({ data, color }: { data: number[]; color: string }) {
  const [hover, setHover] = useState<{ idx: number; x: number } | null>(null);
  if (data.length < 2) return null;
  const w = 60;
  const h = 24;
  const pad = 2;
  const usableW = w - pad * 2;
  const usableH = h - pad * 2;
  const points = data
    .map((v, i) => {
      const x = pad + (i / (data.length - 1)) * usableW;
      const y = pad + (1 - v) * usableH;
      return `${x},${y}`;
    })
    .join(" ");
  const coords = data.map((v, i) => ({
    x: pad + (i / (data.length - 1)) * usableW,
    y: pad + (1 - v) * usableH,
  }));
  return (
    <div className="relative">
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={`Uptime sparkline, ${data.length} samples`}
        onMouseMove={(e) => {
          const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
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
          setHover({ idx: best, x: coords[best].x });
        }}
        onMouseLeave={() => setHover(null)}
      >
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {hover && (
          <circle cx={coords[hover.idx].x} cy={coords[hover.idx].y} r="2" fill={color} />
        )}
      </svg>
      {hover && (
        <span className="absolute -top-5 left-0 text-[10px] bg-gray-900 text-white px-1 rounded whitespace-nowrap">
          {Math.round(data[hover.idx] * 100)}%
        </span>
      )}
    </div>
  );
}
