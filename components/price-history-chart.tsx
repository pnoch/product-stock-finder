import { useState, useMemo, useEffect } from "react";
import { View, Text } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { PricePoint } from "@/lib/types";
import { formatPrice } from "@shared/currency";
import { indexForLocationX } from "@/lib/price-chart";
import { detectPriceEvents, getEventColor } from "@/lib/price-events";
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
  useEffect(() => setSelectedIndex(null), [data]);
  const points = useMemo(() => {
    if (!data || data.length < 2) return null;
    if (width < 80 || height < 60) return null;
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
    const usableW = Math.max(0, width - padL - padR);
    const usableH = Math.max(0, height - padT - padB);
    const coords = sorted.map((p, i) => {
      const x = padL + (i / (sorted.length - 1)) * usableW;
      const y = padT + (1 - (p.price - minP) / range) * usableH;
      return { x, y, price: p.price, date: p.date, stockStatus: p.stockStatus };
    });
    const polylineStr = coords.map((c) => `${c.x},${c.y}`).join(" ");
    const trend =
      coords[coords.length - 1].price >= coords[0].price ? "up" : "down";
    const events = detectPriceEvents(sorted);
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
      events,
    };
  }, [data, width, height]);

  if (!points) {
    return (
      <View
        style={{
          height: height || 120,
          width: width || "100%",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.border + "33",
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          gap: 6,
        }}
      >
        <IconSymbol name="chart.line.downtrend.xyaxis" size={24} color={colors.muted} />
        <Text style={{ color: colors.muted, fontSize: 12, textAlign: "center" }} numberOfLines={1} ellipsizeMode="tail">
          No price history
        </Text>
      </View>
    );
  }

  const lineColor = points.trend === "down" ? colors.success : colors.error;
  const { coords, polylineStr, minP, maxP, padL, padR, padT, padB, usableH } =
    points;
  const midP = (minP + maxP) / 2;
  const midY = padT + usableH / 2;
  const minY = padT + usableH;
  const maxY = padT;

  return (
    <View
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => {
        const idx = indexForLocationX(
          e.nativeEvent.locationX,
          width,
          padL,
          padR,
          coords.length,
        );
        setSelectedIndex((prev) => (prev === idx ? null : idx));
      }}
      onResponderMove={(e) => {
        setSelectedIndex(
          indexForLocationX(
            e.nativeEvent.locationX,
            width,
            padL,
            padR,
            coords.length,
          ),
        );
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
          {formatPrice(maxP, currency)}
        </SvgText>
        <SvgText
          x={padL - 6}
          y={midY + 4}
          fontSize={10}
          fill={colors.muted}
          textAnchor="end"
        >
          {formatPrice(midP, currency)}
        </SvgText>
        <SvgText
          x={padL - 6}
          y={minY + 4}
          fontSize={10}
          fill={colors.muted}
          textAnchor="end"
        >
          {formatPrice(minP, currency)}
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
        {points.events.map((ev) => {
          const coord = coords[ev.index];
          if (!coord) return null;
          const color = getEventColor(ev.type, colors);
          return (
            <Circle
              key={`event-${ev.type}-${ev.index}`}
              cx={coord.x}
              cy={coord.y}
              r={6}
              fill={color}
              stroke={colors.surface}
              strokeWidth={2}
            />
          );
        })}
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
                fill={colors.success + "33"}
              />
              <SvgText
                x={minCoord.x}
                y={minCoord.y - 5}
                fontSize={9}
                fill={colors.success}
                textAnchor="middle"
                fontWeight="700"
              >
                LOW {formatPrice(minP, currency)}
              </SvgText>
              <Rect
                x={maxCoord.x - 24}
                y={maxCoord.y + 4}
                width={48}
                height={14}
                rx={4}
                fill={colors.error + "33"}
              />
              <SvgText
                x={maxCoord.x}
                y={maxCoord.y + 14}
                fontSize={9}
                fill={colors.error}
                textAnchor="middle"
                fontWeight="700"
              >
                HIGH {formatPrice(maxP, currency)}
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
      {points.events.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8, justifyContent: "center" }}>
          {Array.from(new Set(points.events.map((e) => e.type))).map((type) => (
            <View key={type} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: getEventColor(type as never, colors),
                  borderWidth: 1,
                  borderColor: colors.surface,
                }}
              />
              <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "600", textTransform: "capitalize" }}>
                {type === "restock" ? "Restock" : type === "price_drop" ? "Price drop" : "Price rise"}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
