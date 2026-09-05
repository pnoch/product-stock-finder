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
import { formatPrice } from "@shared/currency";
import { convertPrice } from "@/lib/currency";
import { nearestByX } from "@/lib/price-chart";
import { detectPriceEvents, getEventColor } from "@/lib/price-events";

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
  const startXRef = useRef<number | null>(null);
  const padLConst = 56;
  const padRConst = 16;

  const clampScrub = (x: number) =>
    Math.max(padLConst, Math.min(x, width - padRConst));

  const { allCoords, globalMin, globalMax, globalMinDate, globalMaxDate } = useMemo(() => {
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
        if (c !== null && Number.isFinite(c)) allPrices.push(c);
      }
    }
    if (allPrices.length === 0)
      return { allCoords: [], globalMin: 0, globalMax: 0, globalMinDate: 0, globalMaxDate: 0 };

    const globalMin = Math.min(...allPrices);
    const globalMax = Math.max(...allPrices);
    const range = globalMax - globalMin;
    const isFlat = range === 0;

    const allDates: number[] = [];
    for (const s of series) {
      for (const p of s.data) {
        const t = new Date(p.date).getTime();
        if (!Number.isNaN(t)) allDates.push(t);
      }
    }
    if (allDates.length === 0)
      return { allCoords: [], globalMin: 0, globalMax: 0, globalMinDate: 0, globalMaxDate: 0 };
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
          if (converted === null || !Number.isFinite(converted)) return null;
          const t = new Date(p.date).getTime();
          if (Number.isNaN(t)) return null;
          const x = padL + ((t - minDate) / dateRange) * usableW;
          const y = isFlat
            ? padT + usableH / 2
            : padT + (1 - (converted - globalMin) / range) * usableH;
          return { x, y, price: p.price, converted, date: p.date, stockStatus: p.stockStatus };
        })
        .filter((c): c is NonNullable<typeof c> => c !== null);
      const events = detectPriceEvents(sorted);
      const eventCoords = events
        .map((ev) => {
          const targetDate = sorted[ev.index]?.date;
          const coordIdx = coords.findIndex((c) => c.date === targetDate);
          if (coordIdx < 0) return null;
          return { ev, coord: coords[coordIdx] };
        })
        .filter((v): v is NonNullable<typeof v> => v !== null);
      return {
        ...s,
        coords,
        polylineStr: coords.map((c) => `${c.x},${c.y}`).join(" "),
        eventCoords,
      };
    });

    return { allCoords, globalMin, globalMax, globalMinDate: minDate, globalMaxDate: maxDate };
  }, [series, width, height, displayCurrency]);

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
    <View
      onStartShouldSetResponder={(e) => {
        startXRef.current = e.nativeEvent.locationX;
        return false;
      }}
      onMoveShouldSetResponder={(e) => {
        if (startXRef.current == null) return false;
        return Math.abs(e.nativeEvent.locationX - startXRef.current) > 8;
      }}
      onResponderGrant={(e) => {
        movedRef.current = false;
        startXRef.current = e.nativeEvent.locationX;
        setScrubX(clampScrub(e.nativeEvent.locationX));
      }}
      onResponderMove={(e) => {
        if (startXRef.current != null && Math.abs(e.nativeEvent.locationX - startXRef.current) <= 8 && !movedRef.current) return;
        movedRef.current = true;
        setScrubX(clampScrub(e.nativeEvent.locationX));
      }}
      onResponderRelease={() => {
        startXRef.current = null;
        if (!movedRef.current) setScrubX(null);
      }}
      onResponderTerminationRequest={() => false}
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
        {formatPrice(globalMax, displayCurrency)}
      </SvgText>
      <SvgText
        x={padL - 6}
        y={midY + 4}
        fontSize={9}
        fill={colors.muted}
        textAnchor="end"
      >
        {formatPrice(midP, displayCurrency)}
      </SvgText>
      <SvgText
        x={padL - 6}
        y={minY + 4}
        fontSize={9}
        fill={colors.muted}
        textAnchor="end"
      >
        {formatPrice(globalMin, displayCurrency)}
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
          {s.eventCoords.map(({ ev, coord }) => (
            <Circle
              key={`event-${s.label}-${ev.type}-${coord.date}`}
              cx={coord.x}
              cy={coord.y}
              r={5}
              fill={getEventColor(ev.type, colors)}
              stroke={colors.surface}
              strokeWidth={1.5}
            />
          ))}
        </Fragment>
      ))}
      {(() => {
          if (!globalMinDate || !globalMaxDate) return null;
          const usableW = width - 56 - 16;
          const padL = 56;
          const minDate = globalMinDate;
          const maxDate = globalMaxDate;
          const midDate = (minDate + maxDate) / 2;
          const dates = [minDate, midDate, maxDate];
          const xs = [
            padL,
            padL + usableW / 2,
            width - 16,
          ];
          return dates.map((t, i) => {
            const label = new Date(t).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            });
            return (
              <SvgText
                key={i}
                x={xs[i]}
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
          let globalNearest: { date: string } | null = null;
          let globalBestDist = Infinity;
          for (const s of allCoords) {
            const pt = nearestByX(s.coords, scrubX);
            if (pt) {
              const d = Math.abs(pt.x - scrubX);
              if (d < globalBestDist) {
                globalBestDist = d;
                globalNearest = pt;
              }
            }
          }
          if (!globalNearest) return null;
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
                {new Date(globalNearest.date).toLocaleDateString(undefined, {
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
                    {`${row.label}  ${row.point ? formatPrice(row.point.converted, displayCurrency) : "—"}`}
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
