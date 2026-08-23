import { useState, useMemo } from "react";
import { Pressable } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { PricePoint } from "@/lib/types";
import { formatPrice } from "@/lib/currency";
import { findNearestIndex } from "@/lib/price-chart";
import Svg, {
  Polyline,
  Circle,
  Line,
  Text as SvgText,
  Rect,
} from "react-native-svg";

// ─── Full-Screen Price History Chart ─────────────────────────────────────────
export function PriceHistoryChart({
  data,
  currency,
  width,
  height,
}: {
  data: PricePoint[];
  currency: string;
  width: number;
  height: number;
}) {
  const colors = useColors();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const points = useMemo(() => {
    if (!data || data.length < 2) return null;
    const sorted = [...data].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    const prices = sorted.map((p) => p.price);
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const range = maxP - minP || 1;
    const padL = 52,
      padR = 16,
      padT = 24,
      padB = 44;
    const usableW = width - padL - padR;
    const usableH = height - padT - padB;
    const coords = sorted.map((p, i) => {
      const x = padL + (i / (sorted.length - 1)) * usableW;
      const y = padT + (1 - (p.price - minP) / range) * usableH;
      return { x, y, price: p.price, date: p.date };
    });
    const polylineStr = coords.map((c) => `${c.x},${c.y}`).join(" ");
    const trend =
      coords[coords.length - 1].price >= coords[0].price ? "up" : "down";
    return {
      coords,
      polylineStr,
      trend,
      minP,
      maxP,
      padL,
      padR,
      padT,
      padB,
      usableH,
    };
  }, [data, width, height]);

  if (!points) return null;

  const lineColor = points.trend === "down" ? colors.success : colors.error;
  const { coords, polylineStr, minP, maxP, padL, padR, padT, padB, usableH } =
    points;
  const midP = (minP + maxP) / 2;
  const midY = padT + usableH / 2;
  const minY = padT + usableH;
  const maxY = padT;

  return (
    <Pressable
      onPress={(e) => {
        const x = e.nativeEvent.locationX;
        const idx = findNearestIndex(
          ((x - padL) / (width - padL - padR)) * 100,
          coords.length,
        );
        setSelectedIndex((prev) => (prev === idx ? null : idx));
      }}
    >
      <Svg width={width} height={height}>
        {[maxY, midY, minY].map((y, i) => (
          <Line
            key={i}
            x1={padL}
            y1={y}
            x2={width - 16}
            y2={y}
            stroke={colors.border}
            strokeWidth={0.5}
            strokeDasharray="4,4"
          />
        ))}
        <SvgText
          x={padL - 6}
          y={maxY + 4}
          fontSize={10}
          fill={colors.muted}
          textAnchor="end"
        >
          {maxP.toFixed(0)}
        </SvgText>
        <SvgText
          x={padL - 6}
          y={midY + 4}
          fontSize={10}
          fill={colors.muted}
          textAnchor="end"
        >
          {midP.toFixed(0)}
        </SvgText>
        <SvgText
          x={padL - 6}
          y={minY + 4}
          fontSize={10}
          fill={colors.muted}
          textAnchor="end"
        >
          {minP.toFixed(0)}
        </SvgText>
        <Polyline
          points={polylineStr}
          fill="none"
          stroke={lineColor}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {coords.map((c, i) => (
          <Circle key={i} cx={c.x} cy={c.y} r={3} fill={lineColor} />
        ))}
        {[0, Math.floor((coords.length - 1) / 2), coords.length - 1].map(
          (idx) => {
            const c = coords[idx];
            const label = new Date(c.date).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            });
            return (
              <SvgText
                key={idx}
                x={c.x}
                y={height - padB + 16}
                fontSize={10}
                fill={colors.muted}
                textAnchor="middle"
              >
                {label}
              </SvgText>
            );
          },
        )}
        {(() => {
          const minCoord = coords.reduce((a, b) => (b.price < a.price ? b : a));
          const maxCoord = coords.reduce((a, b) => (b.price > a.price ? b : a));
          return (
            <>
              <Rect
                x={minCoord.x - 22}
                y={minCoord.y - 16}
                width={44}
                height={14}
                rx={4}
                fill={colors.error + "33"}
              />
              <SvgText
                x={minCoord.x}
                y={minCoord.y - 5}
                fontSize={9}
                fill={colors.error}
                textAnchor="middle"
                fontWeight="700"
              >
                LOW {minP.toFixed(0)}
              </SvgText>
              <Rect
                x={maxCoord.x - 24}
                y={maxCoord.y + 4}
                width={48}
                height={14}
                rx={4}
                fill={colors.success + "33"}
              />
              <SvgText
                x={maxCoord.x}
                y={maxCoord.y + 14}
                fontSize={9}
                fill={colors.success}
                textAnchor="middle"
                fontWeight="700"
              >
                HIGH {maxP.toFixed(0)}
              </SvgText>
            </>
          );
        })()}
        {selectedIndex != null && coords[selectedIndex] && (
          <>
            <Line
              x1={coords[selectedIndex].x}
              y1={padT}
              x2={coords[selectedIndex].x}
              y2={padT + usableH}
              stroke={colors.muted}
              strokeWidth={1}
              strokeDasharray="3,3"
            />
            <Rect
              x={Math.min(coords[selectedIndex].x - 40, width - 90)}
              y={padT - 2}
              width={80}
              height={22}
              rx={6}
              fill={colors.surface}
              stroke={colors.border}
              strokeWidth={1}
            />
            <SvgText
              x={Math.min(coords[selectedIndex].x, width - 50)}
              y={padT + 8}
              fontSize={10}
              fill={colors.foreground}
              textAnchor="middle"
              fontWeight="700"
            >
              {formatPrice(coords[selectedIndex].price, currency)}
            </SvgText>
            <SvgText
              x={Math.min(coords[selectedIndex].x, width - 50)}
              y={padT + 18}
              fontSize={8}
              fill={colors.muted}
              textAnchor="middle"
            >
              {new Date(coords[selectedIndex].date).toLocaleDateString(
                undefined,
                {
                  month: "short",
                  day: "numeric",
                },
              )}
            </SvgText>
          </>
        )}
      </Svg>
    </Pressable>
  );
}
