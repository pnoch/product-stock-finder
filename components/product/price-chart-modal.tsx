import {
  Text,
  View,
  TouchableOpacity,
  Modal,
} from "react-native";
import { useColors } from "@/hooks/use-colors";
import { DistributorListing } from "@/lib/types";
import { formatPrice } from "@/lib/currency";
import { getDistributorById } from "@/lib/distributors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { PriceHistoryChart } from "@/components/price-history-chart";

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
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
