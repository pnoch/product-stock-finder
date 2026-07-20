import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View, TouchableOpacity, Dimensions, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Svg, { Polyline, Circle, Line, Text as SvgText } from "react-native-svg";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { getWatchlist } from "@/lib/storage";
import { DistributorListing, PricePoint } from "@/lib/types";
import { formatPrice, convertPrice } from "@/lib/currency";
import { getDistributorById } from "@/lib/distributors";
import { IconSymbol } from "@/components/ui/icon-symbol";

// ─── Chart colors for up to 5 distributors ───────────────────────────────────
const CHART_COLORS = ["#0a7ea4", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6"];

// ─── Multi-series chart ───────────────────────────────────────────────────────
function MultiLineChart({
  series,
  width,
  height,
}: {
  series: { label: string; color: string; data: PricePoint[]; currency: string }[];
  width: number;
  height: number;
}) {
  const colors = useColors();
  const { allCoords, globalMin, globalMax } = useMemo(() => {
    const padL = 56, padR = 16, padT = 24, padB = 44;
    const usableW = width - padL - padR;
    const usableH = height - padT - padB;

    // Collect all prices converted to USD for a common Y axis
    const allPricesUSD: number[] = [];
    for (const s of series) {
      for (const p of s.data) {
        allPricesUSD.push(convertPrice(p.price, p.currency, "USD"));
      }
    }
    if (allPricesUSD.length === 0) return { allCoords: [], globalMin: 0, globalMax: 0 };

    const globalMin = Math.min(...allPricesUSD);
    const globalMax = Math.max(...allPricesUSD);
    const range = globalMax - globalMin || 1;

    // Find overall date range
    const allDates: number[] = [];
    for (const s of series) {
      for (const p of s.data) allDates.push(new Date(p.date).getTime());
    }
    const minDate = Math.min(...allDates);
    const maxDate = Math.max(...allDates);
    const dateRange = maxDate - minDate || 1;

    const allCoords = series.map((s) => {
      const sorted = [...s.data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const coords = sorted.map((p) => {
        const usd = convertPrice(p.price, p.currency, "USD");
        const x = padL + ((new Date(p.date).getTime() - minDate) / dateRange) * usableW;
        const y = padT + (1 - (usd - globalMin) / range) * usableH;
        return { x, y, price: p.price, usd, date: p.date };
      });
      return { ...s, coords, polylineStr: coords.map((c) => `${c.x},${c.y}`).join(" ") };
    });

    return { allCoords, globalMin, globalMax, padL, padT, padB, usableH };
  }, [series, width, height]);

  const padL = 56, padT = 24, padB = 44, usableH = height - padT - padB;
  const midP = (globalMin + globalMax) / 2;
  const midY = padT + usableH / 2;
  const minY = padT + usableH;
  const maxY = padT;

  if (allCoords.length === 0) {
    return (
      <View style={{ width, height, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: colors.muted, fontSize: 13 }}>No price history data</Text>
      </View>
    );
  }

  return (
    <Svg width={width} height={height}>
      {[maxY, midY, minY].map((y, i) => (
        <Line key={i} x1={padL} y1={y} x2={width - 16} y2={y} stroke={colors.border} strokeWidth={0.5} strokeDasharray="4,4" />
      ))}
      <SvgText x={padL - 6} y={maxY + 4} fontSize={9} fill={colors.muted} textAnchor="end">${globalMax.toFixed(0)}</SvgText>
      <SvgText x={padL - 6} y={midY + 4} fontSize={9} fill={colors.muted} textAnchor="end">${midP.toFixed(0)}</SvgText>
      <SvgText x={padL - 6} y={minY + 4} fontSize={9} fill={colors.muted} textAnchor="end">${globalMin.toFixed(0)}</SvgText>
      {allCoords.map((s) => (
        <>
          <Polyline key={`line-${s.label}`} points={s.polylineStr} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {s.coords.map((c, i) => (
            <Circle key={`dot-${s.label}-${i}`} cx={c.x} cy={c.y} r={3} fill={s.color} />
          ))}
        </>
      ))}
      {/* Date labels from first series */}
      {allCoords[0]?.coords && (() => {
        const coords = allCoords[0].coords;
        const indices = [0, Math.floor((coords.length - 1) / 2), coords.length - 1];
        return indices.map((idx) => {
          const c = coords[idx];
          const label = new Date(c.date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
          return <SvgText key={idx} x={c.x} y={height - padB + 16} fontSize={9} fill={colors.muted} textAnchor="middle">{label}</SvgText>;
        });
      })()}
    </Svg>
  );
}

// ─── Compare Screen ───────────────────────────────────────────────────────────
export default function CompareScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useColors();
  const [listings, setListings] = useState<DistributorListing[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [productName, setProductName] = useState("");
  const chartWidth = Dimensions.get("window").width - 32;

  useEffect(() => {
    getWatchlist().then((wl) => {
      const product = wl.find((p) => p.id === id);
      if (!product) return;
      setProductName(product.name);
      const ls = product.listings ?? [];
      setListings(ls);
      // Pre-select up to 3 distributors that have price history
      const withHistory = ls.filter((l) => l.priceHistory && l.priceHistory.length >= 2);
      const preSelect = withHistory.slice(0, 3).map((l) => l.distributorId);
      setSelected(new Set(preSelect));
    });
  }, [id]);

  const toggleSelect = useCallback((distributorId: string) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(distributorId)) {
        next.delete(distributorId);
      } else if (next.size < 5) {
        next.add(distributorId);
      }
      return next;
    });
  }, []);

  const chartSeries = useMemo(() => {
    const selectedListings = listings.filter((l) => selected.has(l.distributorId) && l.priceHistory && l.priceHistory.length >= 2);
    return selectedListings.map((l, i) => {
      const distributor = getDistributorById(l.distributorId);
      return {
        label: distributor?.name ?? l.distributorId,
        color: CHART_COLORS[i % CHART_COLORS.length],
        data: l.priceHistory!,
        currency: l.currency,
      };
    });
  }, [listings, selected]);

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
            <IconSymbol name="arrow.left" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "700" }} numberOfLines={1}>Compare Prices</Text>
            <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }} numberOfLines={1}>{productName}</Text>
          </View>
        </View>

        {/* Chart */}
        <View style={{ marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 16 }}>
          <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 15, marginBottom: 4 }}>Price History (USD)</Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 12 }}>Select up to 5 distributors to overlay</Text>
          {chartSeries.length >= 2 ? (
            <MultiLineChart series={chartSeries} width={chartWidth} height={220} />
          ) : (
            <View style={{ height: 120, alignItems: "center", justifyContent: "center" }}>
              <IconSymbol name="chart.bar.xaxis" size={36} color={colors.muted} />
              <Text style={{ color: colors.muted, fontSize: 13, marginTop: 8, textAlign: "center" }}>
                Select at least 2 distributors{"\n"}with price history to compare
              </Text>
            </View>
          )}
          {/* Legend */}
          {chartSeries.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
              {chartSeries.map((s) => (
                <View key={s.label} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: s.color }} />
                  <Text style={{ color: colors.muted, fontSize: 11 }}>{s.label}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Current prices comparison table */}
        {selected.size > 0 && (
          <View style={{ marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 16 }}>
            <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 15, marginBottom: 12 }}>Current Prices</Text>
            {listings.filter((l) => selected.has(l.distributorId)).map((l, i) => {
              const distributor = getDistributorById(l.distributorId);
              const usd = convertPrice(l.price, l.currency, "USD");
              const color = CHART_COLORS[Array.from(selected).indexOf(l.distributorId) % CHART_COLORS.length];
              return (
                <View key={l.distributorId} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: colors.border }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color, marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14 }}>
                      {distributor?.countryFlag} {distributor?.name ?? l.distributorId}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>{distributor?.country}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 15 }}>{formatPrice(l.price, l.currency)}</Text>
                    {l.currency !== "USD" && <Text style={{ color: colors.muted, fontSize: 11 }}>≈ ${usd.toFixed(2)}</Text>}
                    <View style={{ backgroundColor: l.stockStatus === "in_stock" ? colors.success + "22" : colors.warning + "22", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, marginTop: 2 }}>
                      <Text style={{ color: l.stockStatus === "in_stock" ? colors.success : colors.warning, fontSize: 10, fontWeight: "600" }}>
                        {l.stockStatus === "in_stock" ? "In Stock" : l.stockStatus === "back_order" ? "Back Order" : "Out of Stock"}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Distributor selector */}
        <View style={{ paddingHorizontal: 16 }}>
          <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 15, marginBottom: 12 }}>
            Select Distributors ({selected.size}/5)
          </Text>
          {listings.map((l) => {
            const distributor = getDistributorById(l.distributorId);
            const isSelected = selected.has(l.distributorId);
            const hasHistory = l.priceHistory && l.priceHistory.length >= 2;
            const colorIdx = Array.from(selected).indexOf(l.distributorId);
            const chipColor = isSelected ? CHART_COLORS[colorIdx % CHART_COLORS.length] : colors.border;
            return (
              <TouchableOpacity
                key={l.distributorId}
                onPress={() => toggleSelect(l.distributorId)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: isSelected ? chipColor + "18" : colors.surface,
                  borderRadius: 14,
                  padding: 14,
                  marginBottom: 8,
                  borderWidth: 1.5,
                  borderColor: isSelected ? chipColor : colors.border,
                  opacity: !hasHistory && !isSelected ? 0.5 : 1,
                }}
              >
                <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: isSelected ? chipColor : colors.border, backgroundColor: isSelected ? chipColor : "transparent", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                  {isSelected && <IconSymbol name="checkmark" size={12} color="#fff" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14 }}>
                    {distributor?.countryFlag} {distributor?.name ?? l.distributorId}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {hasHistory ? `${l.priceHistory!.length} price points` : "No price history"}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: isSelected ? chipColor : colors.foreground, fontWeight: "700", fontSize: 14 }}>{formatPrice(l.price, l.currency)}</Text>
                  <View style={{ backgroundColor: l.stockStatus === "in_stock" ? colors.success + "22" : colors.warning + "22", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, marginTop: 2 }}>
                    <Text style={{ color: l.stockStatus === "in_stock" ? colors.success : colors.warning, fontSize: 10, fontWeight: "600" }}>
                      {l.stockStatus === "in_stock" ? "In Stock" : l.stockStatus === "back_order" ? "Back Order" : "Out of Stock"}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

