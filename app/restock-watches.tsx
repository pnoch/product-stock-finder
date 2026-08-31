import { useCallback, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { getStockWatches, removeStockWatch } from "@/lib/storage";
import { getDistributorById } from "@/lib/distributors";
import type { BackOrderReminder } from "@/lib/types";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { SkeletonList } from "@/components/ui/skeleton";

const STATUS_LABELS: Record<string, string> = {
  in_stock: "In Stock",
  back_order: "Back Order",
  out_of_stock: "Out of Stock",
  unknown: "Unknown",
};

export default function RestockWatchesScreen() {
  const colors = useColors();
  const router = useRouter();
  const [watches, setWatches] = useState<BackOrderReminder[]>([]);
  const [loading, setLoading] = useState(true);

  const loadWatches = useCallback(async () => {
    try {
      const list = await getStockWatches();
      setWatches(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadWatches();
    }, [loadWatches]),
  );

  const handleRemove = useCallback(async (id: string) => {
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await removeStockWatch(id);
      setWatches((prev) => prev.filter((w) => w.id !== id));
    } catch {
      // Ignore remove failures — the watch stays in the list
    }
  }, []);

  return (
    <ScreenContainer>
      <View style={{ flexDirection: "row", alignItems: "center", padding: 16 }}>
        <TouchableOpacity
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={{ marginRight: 12 }}
        >
          <Text style={{ color: colors.primary, fontSize: 16 }}>‹ Back</Text>
        </TouchableOpacity>
        <Text
          style={{ color: colors.foreground, fontSize: 20, fontWeight: "700" }}
        >
          Restock Watches
        </Text>
      </View>

      {loading ? (
        <SkeletonList count={3} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        >
          {watches.length === 0 ? (
            <View style={{ alignItems: "center", paddingHorizontal: 16, marginTop: 40 }}>
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: colors.warning + "18",
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: colors.warning + "33",
                }}
              >
                <IconSymbol name="eye.fill" size={30} color={colors.warning} />
              </View>
              <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 16, marginTop: 16, textAlign: "center" }}>
                No restock watches
              </Text>
              <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center", marginTop: 8, lineHeight: 20 }}>
                Open a product and tap &quot;Watch for Restock&quot; to get notified when it&apos;s back in stock.
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/search")}
                accessibilityLabel="Browse products"
                accessibilityRole="button"
                style={{ backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 24, paddingVertical: 12, marginTop: 20 }}
              >
                <Text style={{ color: "#fff", fontWeight: "600" }}>Browse Products</Text>
              </TouchableOpacity>
            </View>
          ) : (
            watches.map((watch) => {
              const distrib = getDistributorById(watch.distributorId);
              return (
                <View
                  key={watch.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: colors.foreground,
                        fontWeight: "500",
                        fontSize: 14,
                      }}
                    >
                      {watch.productName}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      {distrib?.countryFlag}{" "}
                      {distrib?.name ?? watch.distributorName}
                    </Text>
                    <Text
                      style={{
                        color: colors.muted,
                        fontSize: 11,
                        marginTop: 2,
                      }}
                    >
                      {STATUS_LABELS[watch.lastKnownStatus ?? "unknown"] ??
                        "Unknown"}
                    </Text>
                  </View>
                  <TouchableOpacity
                    accessibilityLabel={`Remove ${watch.productName} restock watch`}
                    accessibilityRole="button"
                    onPress={() => handleRemove(watch.id)}
                    style={{ padding: 8 }}
                  >
                    <Text style={{ color: colors.error, fontSize: 13 }}>
                      Remove
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}
