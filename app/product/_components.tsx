import {
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useColors } from "@/hooks/use-colors";
import { DistributorListing } from "@/lib/types";
import { formatPrice } from "@/lib/currency";
import { getDistributorById } from "@/lib/distributors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { PriceHistoryChart } from "@/components/price-history-chart";

export { ProductInfoCard } from "@/components/product/product-info-card";
export { ActionButtons } from "@/components/product/action-buttons";
export { DistributorListingCard } from "@/components/product/distributor-listing-card";
export { DistributorListingSection } from "@/components/product/distributor-listing-section";
export { PriceAlertModal } from "@/components/product/price-alert-modal";

// ─── ReminderDatePickerModal ─────────────────────────────────────────────────

interface ReminderDatePickerModalProps {
  visible: boolean;
  onClose: () => void;
  reminderListing: DistributorListing | null;
  reminderDate: Date;
  showDatePicker: boolean;
  setShowDatePicker: (show: boolean) => void;
  setReminderDate: (date: Date) => void;
  onSetReminder: () => void;
  productName: string;
}

export function ReminderDatePickerModal({
  visible,
  onClose,
  reminderListing,
  reminderDate,
  showDatePicker,
  setShowDatePicker,
  setReminderDate,
  onSetReminder,
  productName,
}: ReminderDatePickerModalProps) {
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
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
      >
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
          }}
        >
          <Text
            style={{
              color: colors.foreground,
              fontSize: 20,
              fontWeight: "700",
              marginBottom: 4,
            }}
          >
            Set Reminder 📅
          </Text>
          <Text
            style={{ color: colors.muted, fontSize: 14, marginBottom: 20 }}
          >
            Pick a date to be reminded to check{" "}
            <Text style={{ fontWeight: "600", color: colors.foreground }}>
              {reminderListing
                ? (getDistributorById(reminderListing.distributorId)?.name ??
                  reminderListing.distributorId)
                : ""}
            </Text>{" "}
            for {productName}.
          </Text>
          <TouchableOpacity
            onPress={() => setShowDatePicker(true)}
            style={{
              backgroundColor: colors.surface,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 20,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              <IconSymbol
                name="calendar"
                size={20}
                color={colors.primary}
              />
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 17,
                  fontWeight: "600",
                }}
              >
                {reminderDate.toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </Text>
            </View>
            <IconSymbol
              name="chevron.right"
              size={16}
              color={colors.muted}
            />
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={reminderDate}
              mode="date"
              display={Platform.OS === "ios" ? "inline" : "default"}
              minimumDate={new Date()}
              onChange={(_, selected) => {
                setShowDatePicker(Platform.OS === "ios");
                if (selected) setReminderDate(selected);
              }}
            />
          )}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity
              onPress={onClose}
              style={{
                flex: 1,
                backgroundColor: colors.surface,
                borderRadius: 14,
                paddingVertical: 14,
                alignItems: "center",
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text
                style={{ color: colors.foreground, fontWeight: "600" }}
              >
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onSetReminder}
              style={{
                flex: 1,
                backgroundColor: colors.primary,
                borderRadius: 14,
                paddingVertical: 14,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "600" }}>
                Set Reminder
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── PriceChartModal ─────────────────────────────────────────────────────────

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
      >
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
          }}
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
            <TouchableOpacity
              onPress={onClose}
              style={{ padding: 4 }}
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
