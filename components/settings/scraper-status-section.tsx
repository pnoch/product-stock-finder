import {
  Text,
  View,
  TouchableOpacity,
  Platform,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { SectionHeader } from "@/components/settings/section-header";
import { getDistributorById } from "@/lib/distributors";
import { getAllParserIds } from "@/lib/scrapers/registry";
import type { Product } from "@/lib/types";

function getDistributorHealth(
  lastSuccess: string | null,
  colors: ReturnType<typeof useColors>,
): { label: string; emoji: string; color: string } {
  if (!lastSuccess) {
    return { label: "Never Checked", emoji: "❓", color: colors.muted };
  }
  const hoursSince =
    (Date.now() - new Date(lastSuccess).getTime()) / (1000 * 60 * 60);
  if (hoursSince < 24) {
    return { label: "OK", emoji: "✅", color: colors.success };
  }
  if (hoursSince < 168) {
    return { label: "Stale", emoji: "⚠️", color: colors.warning };
  }
  return { label: "Failed", emoji: "❌", color: colors.error };
}

export function ScraperStatusSection({
  products,
  onReenableDistributor,
}: {
  products: Product[];
  onReenableDistributor: (distributorId: string) => void;
}) {
  const colors = useColors();
  const router = useRouter();

  const distributorStatuses = (() => {
    const statuses: Record<
      string,
      {
        lastSuccess: string | null;
        lastError: string | null;
        consecutiveFailures: number;
      }
    > = {};

    const parserIds = getAllParserIds();
    for (const id of parserIds) {
      statuses[id] = {
        lastSuccess: null,
        lastError: null,
        consecutiveFailures: 0,
      };
    }

    for (const product of products) {
      if (!product.listings) continue;
      for (const listing of product.listings) {
        const id = listing.distributorId;
        if (!statuses[id]) {
          statuses[id] = {
            lastSuccess: null,
            lastError: null,
            consecutiveFailures: 0,
          };
        }
        if (listing.lastChecked) {
          const existing = statuses[id].lastSuccess;
          if (!existing || listing.lastChecked > existing) {
            statuses[id].lastSuccess = listing.lastChecked;
          }
        }
      }
    }

    return statuses;
  })();

  return (
    <>
      <SectionHeader title="Scraper Status" />
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          marginHorizontal: 16,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: "hidden",
        }}
      >
        {Object.entries(distributorStatuses).map(([id, status], idx) => {
          const distributor = getDistributorById(id);
          if (!distributor) return null;
          const health = getDistributorHealth(status.lastSuccess, colors);
          return (
            <View
              key={id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderBottomWidth:
                  idx < Object.keys(distributorStatuses).length - 1 ? 1 : 0,
                borderBottomColor: colors.border,
              }}
            >
              <View style={{ flex: 1 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 2,
                  }}
                >
                  <Text
                    style={{
                      color: colors.foreground,
                      fontWeight: "500",
                      fontSize: 14,
                      marginRight: 6,
                    }}
                  >
                    {distributor.countryFlag} {distributor.name}
                  </Text>
                  <Text style={{ fontSize: 14 }}>{health.emoji}</Text>
                </View>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {status.lastSuccess
                    ? `Last checked: ${new Date(status.lastSuccess).toLocaleDateString()}`
                    : "Never checked"}
                </Text>
              </View>
              {health.label !== "OK" ? (
                <TouchableOpacity
                  onPress={() => {
                    if (Platform.OS !== "web")
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    onReenableDistributor(id);
                  }}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 12,
                    backgroundColor: colors.primary + "22",
                  }}
                  accessibilityLabel={`Re-enable ${distributor.name}`}
                  accessibilityRole="button"
                >
                  <Text
                    style={{
                      color: colors.primary,
                      fontSize: 12,
                      fontWeight: "600",
                    }}
                  >
                    Re-enable
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text
                  style={{
                    color: health.color,
                    fontSize: 12,
                    fontWeight: "600",
                  }}
                >
                  {health.label}
                </Text>
              )}
            </View>
          );
        })}
        {Object.keys(distributorStatuses).length === 0 && (
          <View style={{ paddingVertical: 20, paddingHorizontal: 16 }}>
            <Text
              style={{
                color: colors.muted,
                fontSize: 14,
                textAlign: "center",
              }}
            >
              No distributors configured
            </Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        onPress={() => router.push("/health")}
        style={{
          marginHorizontal: 16,
          marginTop: 12,
          paddingVertical: 12,
          borderRadius: 12,
          backgroundColor: colors.primary + "22",
          alignItems: "center",
        }}
        accessibilityLabel="View health dashboard"
        accessibilityRole="button"
      >
        <Text
          style={{ color: colors.primary, fontWeight: "600", fontSize: 14 }}
        >
          View Health Dashboard
        </Text>
      </TouchableOpacity>
    </>
  );
}
