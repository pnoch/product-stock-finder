import {
  Text,
  View,
  TouchableOpacity,
  Modal,
  ScrollView,
  Share,
  Platform,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/use-colors";
import { DistributorListing } from "@/lib/types";
import { formatPrice } from "@shared/currency";
import { getDistributorById } from "@shared/distributors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { PriceHistoryChart } from "@/components/price-history-chart";
import { priceHistoryToCsv } from "@/lib/csv";

const LOG_ERROR = __DEV__ ? console.error.bind(console) : () => {};

interface PriceChartModalProps {
  visible: boolean;
  chartListing: DistributorListing | null;
  onClose: () => void;
  chartWidth: number;
  chartHeight: number;
}

export function PriceChartModal({
  visible,
  chartListing,
  onClose,
  chartWidth,
  chartHeight,
}: PriceChartModalProps) {
  const colors = useColors();

  const handleExport = async () => {
    if (!chartListing?.priceHistory?.length) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const distributor = getDistributorById(chartListing.distributorId);
    const csv = priceHistoryToCsv(chartListing.priceHistory, {
      name: distributor?.name ?? chartListing.distributorId,
      modelNumber: chartListing.productId,
    });
    try {
      if (Platform.OS === "web") {
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${chartListing.productId}-${chartListing.distributorId}-history.csv`;
        anchor.style.display = "none";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
      } else {
        await Share.share({
          message: csv,
          title: `Price history — ${chartListing.productId}`,
        });
      }
    } catch (e) {
      LOG_ERROR("[PriceChart] export failed", e);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,0,0,0.55)",
        }}
        accessibilityViewIsModal
      >
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
          }}
          accessibilityViewIsModal
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 4,
            }}
          >
            <Text
              style={{
                color: colors.foreground,
                fontSize: 18,
                fontWeight: "700",
              }}
            >
              Price History 📈
            </Text>
            <TouchableOpacity activeOpacity={0.7}
              onPress={onClose}
              style={{ padding: 4 }}
              accessibilityLabel="Close"
              accessibilityRole="button"
              accessibilityHint="Dismisses the price chart"
            >
              <IconSymbol
                name="xmark.circle.fill"
                size={24}
                color={colors.muted}
              />
            </TouchableOpacity>
          </View>
          {chartListing && (
            <>
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 13,
                  marginBottom: 16,
                }}
              >
                {getDistributorById(chartListing.distributorId)?.name ??
                  chartListing.distributorId}{" "}
                · {chartListing.currency}
              </Text>
              {chartListing.priceHistory &&
              chartListing.priceHistory.length >= 2 ? (
                <PriceHistoryChart
                  data={chartListing.priceHistory}
                  currency={chartListing.currency}
                  width={chartWidth}
                  height={chartHeight}
                />
              ) : (
                <View
                  style={{
                    height: 120,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: colors.muted, fontSize: 14 }}>
                    Not enough data to display chart.
                  </Text>
                </View>
              )}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginTop: 16,
                }}
              >
                <View>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    Current Price
                  </Text>
                  <Text
                    style={{
                      color: colors.primary,
                      fontWeight: "700",
                      fontSize: 16,
                    }}
                  >
                    {formatPrice(
                      chartListing.price,
                      chartListing.currency,
                    )}
                  </Text>
                </View>
                {chartListing.priceHistory &&
                  chartListing.priceHistory.length >= 2 &&
                  (() => {
                    const sorted = [...chartListing.priceHistory].sort(
                      (a, b) =>
                        new Date(a.date).getTime() -
                        new Date(b.date).getTime(),
                    );
                    const oldest = sorted[0].price;
                    const current = sorted[sorted.length - 1].price;
                    const pct = Math.abs(
                      Math.round(((current - oldest) / oldest) * 100),
                    );
                    const dir =
                      current < oldest
                        ? "down"
                        : current > oldest
                          ? "up"
                          : "flat";
                    return (
                      <View style={{ alignItems: "flex-end" }}>
                        <Text
                          style={{ color: colors.muted, fontSize: 11 }}
                        >
                          vs. oldest recorded
                        </Text>
                        <Text
                          style={{
                            color:
                              dir === "down"
                                ? colors.success
                                : dir === "up"
                                  ? colors.error
                                  : colors.muted,
                            fontWeight: "700",
                            fontSize: 16,
                          }}
                        >
                          {dir === "down"
                            ? "▼"
                            : dir === "up"
                              ? "▲"
                              : "—"}{" "}
                          {pct}%
                        </Text>
                      </View>
                    );
                  })()}
              </View>
              {chartListing?.priceHistory && chartListing.priceHistory.length >= 1 && (
                <>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleExport}
                    style={{
                      marginTop: 16,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 12,
                      paddingVertical: 10,
                      paddingHorizontal: 16,
                    }}
                    accessibilityLabel="Export price history as CSV"
                    accessibilityRole="button"
                  >
                    <IconSymbol name="square.and.arrow.up" size={16} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>Export History (CSV)</Text>
                  </TouchableOpacity>
                  <View style={{ marginTop: 16, borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: "hidden" }}>
                    <View style={{ flexDirection: "row", backgroundColor: colors.border + "55", paddingVertical: 6, paddingHorizontal: 8 }}>
                      <Text style={{ flex: 1.2, color: colors.muted, fontSize: 10, fontWeight: "700" }}>DATE</Text>
                      <Text style={{ flex: 0.8, color: colors.muted, fontSize: 10, fontWeight: "700", textAlign: "right" }}>PRICE</Text>
                      <Text style={{ flex: 1, color: colors.muted, fontSize: 10, fontWeight: "700", textAlign: "right" }}>STATUS</Text>
                    </View>
                    <ScrollView style={{ maxHeight: 140 }} showsVerticalScrollIndicator>
                      {[...chartListing.priceHistory]
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map((pt, idx) => (
                          <View
                            key={`${pt.date}-${idx}`}
                            style={{
                              flexDirection: "row",
                              paddingVertical: 6,
                              paddingHorizontal: 8,
                              borderTopWidth: idx === 0 ? 0 : 1,
                              borderTopColor: colors.border,
                              backgroundColor: idx % 2 === 0 ? colors.surface : colors.background,
                            }}
                          >
                            <Text style={{ flex: 1.2, color: colors.foreground, fontSize: 11 }}>
                              {new Date(pt.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                            </Text>
                            <Text style={{ flex: 0.8, color: colors.foreground, fontSize: 11, textAlign: "right", fontWeight: "600" }}>
                              {formatPrice(pt.price, pt.currency)}
                            </Text>
                            <Text style={{ flex: 1, color: colors.muted, fontSize: 11, textAlign: "right" }}>{pt.stockStatus}</Text>
                          </View>
                        ))}
                    </ScrollView>
                  </View>
                </>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
