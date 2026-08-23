import { Fragment, useMemo } from "react";
import { Text, View } from "react-native";
import Svg, { Polyline, Circle, Line, Text as SvgText } from "react-native-svg";

import { useColors } from "@/hooks/use-colors";
import { PricePoint } from "@/lib/types";
import { convertPrice } from "@/lib/currency";

export function MultiLineChart({
  series,
  width,
  height,
}: {
  series: {
    label: string;
    color: string;
    data: PricePoint[];
    currency: string;
  }[];
  width: number;
  height: number;
}) {
  const colors = useColors();
  const { allCoords, globalMin, globalMax } = useMemo(() => {
    const padL = 56,
      padR = 16,
      padT = 24,
      padB = 44;
    const usableW = width - padL - padR;
    const usableH = height - padT - padB;

    const allPricesUSD: number[] = [];
    for (const s of series) {
      for (const p of s.data) {
        allPricesUSD.push(convertPrice(p.price, p.currency, "USD"));
      }
    }
    if (allPricesUSD.length === 0)
      return { allCoords: [], globalMin: 0, globalMax: 0 };

    const globalMin = Math.min(...allPricesUSD);
    const globalMax = Math.max(...allPricesUSD);
    const range = globalMax - globalMin || 1;

    const allDates: number[] = [];
    for (const s of series) {
      for (const p of s.data) allDates.push(new Date(p.date).getTime());
    }
    const minDate = Math.min(...allDates);
    const maxDate = Math.max(...allDates);
    const dateRange = maxDate - minDate || 1;

    const allCoords = series.map((s) => {
      const sorted = [...s.data].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      );
      const coords = sorted.map((p) => {
        const usd = convertPrice(p.price, p.currency, "USD");
        const x =
          padL + ((new Date(p.date).getTime() - minDate) / dateRange) * usableW;
        const y = padT + (1 - (usd - globalMin) / range) * usableH;
        return { x, y, price: p.price, usd, date: p.date };
      });
      return {
        ...s,
        coords,
        polylineStr: coords.map((c) => `${c.x},${c.y}`).join(" "),
      };
    });

    return { allCoords, globalMin, globalMax };
  }, [series, width, height]);

  const padL = 56,
    padT = 24,
    padB = 44,
    usableH = height - padT - padB;
  const midP = (globalMin + globalMax) / 2;
  const midY = padT + usableH / 2;
  const minY = padT + usableH;
  const maxY = padT;

  if (allCoords.length === 0) {
    return (
      <View
        style={{
          width,
          height,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: colors.muted, fontSize: 13 }}>
          No price history data
        </Text>
      </View>
    );
  }

  return (
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
        fontSize={9}
        fill={colors.muted}
        textAnchor="end"
      >
        ${globalMax.toFixed(0)}
      </SvgText>
      <SvgText
        x={padL - 6}
        y={midY + 4}
        fontSize={9}
        fill={colors.muted}
        textAnchor="end"
      >
        ${midP.toFixed(0)}
      </SvgText>
      <SvgText
        x={padL - 6}
        y={minY + 4}
        fontSize={9}
        fill={colors.muted}
        textAnchor="end"
      >
        ${globalMin.toFixed(0)}
      </SvgText>
      {allCoords.map((s) => (
        <Fragment key={s.label}>
          <Polyline
            key={`line-${s.label}`}
            points={s.polylineStr}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {s.coords.map((c, i) => (
            <Circle
              key={`dot-${s.label}-${i}`}
              cx={c.x}
              cy={c.y}
              r={3}
              fill={s.color}
            />
          ))}
        </Fragment>
      ))}
      {allCoords[0]?.coords &&
        (() => {
          const coords = allCoords[0].coords;
          const indices = [
            0,
            Math.floor((coords.length - 1) / 2),
            coords.length - 1,
          ];
          return indices.map((idx) => {
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
                fontSize={9}
                fill={colors.muted}
                textAnchor="middle"
              >
                {label}
              </SvgText>
            );
          });
        })()}
    </Svg>
  );
}
