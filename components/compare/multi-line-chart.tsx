import { Fragment, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";
import Svg, {
  Polyline,
  Circle,
  Line,
  Text as SvgText,
  Rect,
} from "react-native-svg";

import { useColors } from "@/hooks/use-colors";
import { PricePoint } from "@/lib/types";
import { convertPrice, CURRENCY_SYMBOLS } from "@/lib/currency";
import { nearestByX } from "@/lib/price-chart";

export function MultiLineChart({
  series,
  width,
  height,
  displayCurrency = "USD",
}: {
  series: {
    label: string;
    color: string;
    data: PricePoint[];
    currency: string;
  }[];
  width: number;
  height: number;
  displayCurrency?: string;
}) {
  const colors = useColors();
  const [scrubX, setScrubX] = useState<number | null>(null);
  const movedRef = useRef(false);
  const padLConst = 56;
  const padRConst = 16;

  const clampScrub = (x: number) =>
    Math.max(padLConst, Math.min(x, width - padRConst));

  const { allCoords, globalMin, globalMax } = useMemo(() => {
    const padL = 56,
      padR = 16,
      padT = 24,
      padB = 44;
    const usableW = width - padL - padR;
    const usableH = height - padT - padB;

    const allPrices: number[] = [];
    for (const s of series) {
      for (const p of s.data) {
        const c = convertPrice(p.price, p.currency, displayCurrency);
        if (c !== null) allPrices.push(c);
      }
    }
    if (allPrices.length === 0)
      return { allCoords: [], globalMin: 0, globalMax: 0 };

    const globalMin = Math.min(...allPrices);
    const globalMax = Math.max(...allPrices);
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
      const coords = sorted
        .map((p) => {
          const converted = convertPrice(p.price, p.currency, displayCurrency);
          if (converted === null) return null;
          const x =
            padL + ((new Date(p.date).getTime() - minDate) / dateRange) * usableW;
          const y = padT + (1 - (converted - globalMin) / range) * usableH;
          return { x, y, price: p.price, converted, date: p.date };
        })
        .filter((c): c is NonNullable<typeof c> => c !== null);
      return {
        ...s,
        coords,
        polylineStr: coords.map((c) => `${c.x},${c.y}`).join(" "),
      };
    });

    return { allCoords, globalMin, globalMax };
  }, [series, width, height, displayCurrency]);

  const padL = 56,
    padT = 24,
    padB = 44,
    usableH = height - padT - padB;
  const midP = (globalMin + globalMax) / 2;
  const midY = padT + usableH / 2;
  const minY = padT + usableH;
  const maxY = padT;
  const currencySymbol = CURRENCY_SYMBOLS[displayCurrency] ?? displayCurrency;

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
    <View
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => {
        movedRef.current = false;
        setScrubX(clampScrub(e.nativeEvent.locationX));
      }}
      onResponderMove={(e) => {
        movedRef.current = true;
        setScrubX(clampScrub(e.nativeEvent.locationX));
      }}
      onResponderRelease={() => {
        if (!movedRef.current) setScrubX(null);
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
        fontSize={9}
        fill={colors.muted}
        textAnchor="end"
      >
        {currencySymbol}{globalMax.toFixed(0)}
      </SvgText>
      <SvgText
        x={padL - 6}
        y={midY + 4}
        fontSize={9}
        fill={colors.muted}
        textAnchor="end"
      >
        {currencySymbol}{midP.toFixed(0)}
      </SvgText>
      <SvgText
        x={padL - 6}
        y={minY + 4}
        fontSize={9}
        fill={colors.muted}
        textAnchor="end"
      >
        {currencySymbol}{globalMin.toFixed(0)}
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
        {(() => {
          if (scrubX == null || allCoords.length === 0) return null;
          const nearestFirst = nearestByX(allCoords[0].coords, scrubX);
          if (!nearestFirst) return null;
          const rows = allCoords.slice(0, 6).map((s) => ({
            label: s.label,
            color: s.color,
            point: nearestByX(s.coords, scrubX),
          }));
          const present = rows.filter((r) => r.point);
          const extra = allCoords.length - rows.length;
          return (
            <>
              <Line
                x1={scrubX}
                y1={padT}
                x2={scrubX}
                y2={padT + usableH}
                stroke={colors.muted}
                strokeWidth={1}
                strokeDasharray="3,3"
              />
              {present.map(
                (row) =>
                  row.point && (
                    <Circle
                      key={`scrub-${row.label}`}
                      cx={row.point.x}
                      cy={row.point.y}
                      r={5}
                      fill={row.color}
                    />
                  ),
              )}
              <Rect
                x={padLConst}
                y={padT - 2}
                width={Math.min(190, width / 2)}
                height={18 + present.length * 13}
                rx={6}
                fill={colors.surface}
                stroke={colors.border}
                strokeWidth={1}
              />
              <SvgText
                x={padLConst + 8}
                y={padT + 12}
                fontSize={9}
                fill={colors.muted}
                fontWeight="700"
              >
                {new Date(nearestFirst.date).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </SvgText>
              {present.map((row, i) => (
                <Fragment key={`row-${row.label}`}>
                  <Circle
                    cx={padLConst + 12}
                    cy={padT + 24 + i * 13}
                    r={3}
                    fill={row.color}
                  />
                  <SvgText
                    x={padLConst + 20}
                    y={padT + 27 + i * 13}
                    fontSize={9}
                    fill={colors.foreground}
                  >
                    {`${row.label}  ${row.point ? `${currencySymbol}${row.point.converted.toFixed(2)}` : "—"}`}
                  </SvgText>
                </Fragment>
              ))}
              {extra > 0 && (
                <SvgText
                  x={padLConst + 20}
                  y={padT + 27 + present.length * 13}
                  fontSize={9}
                  fill={colors.muted}
                >
                  {`+${extra} more`}
                </SvgText>
              )}
            </>
          );
        })()}
    </Svg>
    </View>
  );
}
