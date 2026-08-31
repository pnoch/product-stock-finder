import React, { useMemo } from "react";
import { View, Text } from "react-native";
import Svg, { Polyline, Circle } from "react-native-svg";
import { useColors } from "@/hooks/use-colors";
import { PricePoint } from "@/lib/types";

interface PriceSparklineProps {
  data: PricePoint[];
  width?: number;
  height?: number;
  currency?: string;
}

/**
 * A minimal inline sparkline that renders price history as an SVG polyline.
 * Shows up to the last 10 data points. Renders nothing if fewer than 2 points.
 */
export function PriceSparkline({
  data,
  width = 80,
  height = 32,
  currency,
}: PriceSparklineProps) {
  const colors = useColors();

  const points = useMemo(() => {
    if (!data || data.length < 2) return null;
    const sorted = [...data]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-10);
    const prices = sorted.map((p) => p.price);
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const range = maxP - minP || 1;
    const pad = 3;
    const usableW = width - pad * 2;
    const usableH = height - pad * 2;
    const coords = sorted.map((p, i) => {
      const x = pad + (i / (sorted.length - 1)) * usableW;
      const y = pad + (1 - (p.price - minP) / range) * usableH;
      return { x, y, price: p.price };
    });
    const polylineStr = coords.map((c) => `${c.x},${c.y}`).join(" ");
    const last = coords[coords.length - 1];
    const first = coords[0];
    const trend = last.price >= first.price ? "up" : "down";
    return { coords, polylineStr, last, trend };
  }, [data, width, height]);

  if (!points) return null;

  const lineColor = points.trend === "down" ? colors.success : colors.error;

  return (
    <View
      style={{ alignItems: "flex-end" }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Price sparkline, ${points.trend === "up" ? "up" : "down"} trend, ${data.length} points`}
    >
      <Svg width={width} height={height}>
        <Polyline
          points={points.polylineStr}
          fill="none"
          stroke={lineColor}
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <Circle
          cx={points.last.x}
          cy={points.last.y}
          r={2.5}
          fill={lineColor}
        />
      </Svg>
      {currency && (
        <Text
          style={{
            color: lineColor,
            fontSize: 9,
            fontWeight: "600",
            opacity: 0.8,
          }}
        >
          {points.trend === "up" ? "▲" : "▼"} {currency}
        </Text>
      )}
    </View>
  );
}
