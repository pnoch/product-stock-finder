import React, { memo, useCallback, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, Pressable, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { useRouter, useFocusEffect } from "expo-router";

import { computeLocalDrops, type DropWindow, type DropSortBy, type PriceDrop } from "@/lib/price-leaderboard";
import { getWatchlist, getSettings } from "@/lib/storage";
import { useColors } from "@/hooks/use-colors";
import { formatPrice } from "@shared/currency";
import type { Product } from "@/lib/types";

const WINDOWS: DropWindow[] = ["24h", "7d", "30d"];
const SORTS: { key: DropSortBy; label: string }[] = [
  { key: "pct", label: "%" },
  { key: "abs", label: "$" },
];

const WINDOW_LABELS: Record<DropWindow, string> = {
  "24h": "24h",
  "7d": "7d",
  "30d": "30d",
};

function DropRow({ drop, onPress }: { drop: PriceDrop; onPress: () => void }) {
  const colors = useColors();
  const pctText = `\u2212${drop.dropPct.toFixed(0)}%`;
  const absText = `\u2212${formatPrice(drop.dropAbs, drop.currency)}`;

  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 14,
        marginBottom: 6,
        borderWidth: 1,
        borderColor: colors.border,
      }}
      accessibilityLabel={`View ${drop.productName}`}
      accessibilityRole="button"
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text
            style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {drop.productName}
          </Text>
          <Text
            style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {drop.distributorName}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.success }}>
            {pctText}
          </Text>
          <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>
            {absText}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export const DropLeaderboard = memo(function DropLeaderboard() {
  const colors = useColors();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [window, setWindow] = useState<DropWindow>("7d");
  const [sortBy, setSortBy] = useState<DropSortBy>("pct");

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const load = async () => {
        try {
          const [watchlist, settings] = await Promise.all([getWatchlist(), getSettings()]);
          if (!active) return;
          setProducts(watchlist);
          setDisplayCurrency(settings?.displayCurrency ?? "USD");
        } catch {
          // storage read failure — keep existing state
        }
      };
      load();
      return () => { active = false; };
    }, []),
  );

  const drops = useMemo(
    () => computeLocalDrops(products, window, displayCurrency, sortBy, 5),
    [products, window, displayCurrency, sortBy],
  );

  const handleProductPress = useCallback(
    (drop: PriceDrop) => {
      if (Platform.OS !== "web") {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      router.push(`/product/${drop.productId}`);
    },
    [router],
  );

  const handleSeeAll = useCallback(() => {
    if (Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push("/drops");
  }, [router]);

  return (
    <View style={{ marginBottom: 16 }}>
      {/* Header */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <Text
          accessibilityRole="header"
          style={{ fontSize: 18, fontWeight: "700", color: colors.foreground }}
        >
          Biggest Drops
        </Text>
        <View style={{ flexDirection: "row", gap: 4 }}>
          {WINDOWS.map((w) => (
            <TouchableOpacity
              key={w}
              accessibilityLabel={`Show drops from last ${w}`}
              accessibilityRole="button"
              onPress={() => {
                if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setWindow(w);
              }}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 8,
                backgroundColor: window === w ? colors.primary : colors.surface,
                borderWidth: 1,
                borderColor: window === w ? colors.primary : colors.border,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "600", color: window === w ? "#fff" : colors.foreground }}>
                {WINDOW_LABELS[w]}
              </Text>
            </TouchableOpacity>
          ))}
          <View style={{ width: 1, backgroundColor: colors.border, marginHorizontal: 4, marginVertical: 2 }} />
          {SORTS.map((s) => (
            <TouchableOpacity
              key={s.key}
              accessibilityLabel={`Sort by ${s.key === "pct" ? "percentage" : "amount"}`}
              accessibilityRole="button"
              onPress={() => {
                if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSortBy(s.key);
              }}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 8,
                backgroundColor: sortBy === s.key ? colors.primary : colors.surface,
                borderWidth: 1,
                borderColor: sortBy === s.key ? colors.primary : colors.border,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "600", color: sortBy === s.key ? "#fff" : colors.foreground }}>
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Drop rows or empty state */}
      {drops.length === 0 ? (
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 20,
            alignItems: "center",
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ fontSize: 13, color: colors.muted }}>No drops this period</Text>
        </View>
      ) : (
        drops.map((drop) => (
          <DropRow key={`${drop.productId}:${drop.distributorId}`} drop={drop} onPress={() => handleProductPress(drop)} />
        ))
      )}

      {/* Footer */}
      <TouchableOpacity
        onPress={handleSeeAll}
        style={{
          marginTop: 8,
          alignSelf: "flex-end",
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 4,
          paddingHorizontal: 4,
        }}
        accessibilityLabel="See all price drops"
        accessibilityRole="button"
      >
        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.primary, marginRight: 4 }}>
          See all
        </Text>
        <Text style={{ fontSize: 13, color: colors.primary }}>→</Text>
      </TouchableOpacity>
    </View>
  );
});