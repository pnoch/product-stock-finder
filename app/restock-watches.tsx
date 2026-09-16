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
import { getDistributorById } from "@shared/distributors";
import type { BackOrderReminder } from "@/lib/types";
import { EmptyStateView } from "@/components/ui/empty-state-view";
import { SkeletonList } from "@/components/ui/skeleton";
import { showAlert } from "@/lib/alert";

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

  const handleRemove = useCallback((id: string, productName?: string) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showAlert(
      "Remove Watch",
      productName
        ? `Stop watching for ${productName}? This cannot be undone.`
        : "Remove this restock watch? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            if (Platform.OS !== "web")
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            try {
              await removeStockWatch(id);
              setWatches((prev) => prev.filter((w) => w.id !== id));
            } catch (e) {
              console.error("[Restock] remove failed", e);
              showAlert("Remove failed", "We couldn't remove that watch. Please try again.");
            }
          },
        },
      ],
    );
  }, []);

  return (
    <ScreenContainer>
      <View style={{ flexDirection: "row", alignItems: "center", padding: 16 }}>
        <TouchableOpacity activeOpacity={0.7}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={() => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
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
            <EmptyStateView
              icon="eye.fill"
              iconColor={colors.warning}
              title="No restock watches"
              subtitle={`Open a product and tap "Watch for Restock" to get notified when it's back in stock.`}
              ctaLabel="Browse Products"
              onCtaPress={() => {
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/search");
              }}
            />
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
                  <TouchableOpacity activeOpacity={0.7}
                    accessibilityLabel={`View ${watch.productName}`}
                    accessibilityRole="button"
                    onPress={() => router.push(`/product/${watch.productId}`)}
                    style={{ flex: 1 }}
                  >
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
                  </TouchableOpacity>
                  <TouchableOpacity activeOpacity={0.7}
                    accessibilityLabel={`Remove ${watch.productName} restock watch`}
                    accessibilityRole="button"
                    accessibilityHint="Removes this product from your restock watches"
                    onPress={() => handleRemove(watch.id, watch.productName)}
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
