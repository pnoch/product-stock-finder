import {
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Platform,
} from "react-native";
import * as Haptics from "expo-haptics";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useColors } from "@/hooks/use-colors";
import { DistributorListing } from "@/lib/types";
import {
  formatPrice,
  convertPrice,
  EXCHANGE_RATES,
} from "@/lib/currency";
import { getDistributorById } from "@/lib/distributors";
import { DistributorListingCard } from "@/components/product/distributor-listing-card";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BestDistributorCard } from "@/components/best-distributor-card";
import { PriceHistoryChart } from "@/components/price-history-chart";
import { showAlert } from "@/lib/alert";
import type { Product } from "@/lib/types";
import type { BestDeal } from "@/lib/best-deal";

export { ProductInfoCard } from "@/components/product/product-info-card";
export { ActionButtons } from "@/components/product/action-buttons";
export { DistributorListingCard } from "@/components/product/distributor-listing-card";

// ─── DistributorListingSection ───────────────────────────────────────────────

interface DistributorListingSectionProps {
  sortedListings: DistributorListing[];
  visibleListings: DistributorListing[];
  bestInStockListing: DistributorListing | null;
  product: Product;
  insight: string | null;
  regionFilter: string;
  regions: string[];
  shippingRegion: string;
  bestDeal: BestDeal | null;
  stockWatches: Record<string, boolean>;
  id: string;
  onSetRegionFilter: (region: string) => void;
  onSetBestAlert: (listing: DistributorListing) => void;
  onToggleStockWatch: (listing: DistributorListing) => void;
  onOpenChart: (listing: DistributorListing) => void;
}

export function DistributorListingSection({
  sortedListings,
  visibleListings,
  bestInStockListing,
  product,
  insight,
  regionFilter,
  regions,
  shippingRegion,
  bestDeal,
  stockWatches,
  id,
  onSetRegionFilter,
  onSetBestAlert,
  onToggleStockWatch,
  onOpenChart,
}: DistributorListingSectionProps) {
  const colors = useColors();

  return (
    <View style={{ paddingHorizontal: 16 }}>
      <Text
        style={{
          color: colors.foreground,
          fontWeight: "700",
          fontSize: 16,
          marginBottom: 12,
        }}
      >
        Distributor Prices
      </Text>
      {sortedListings.length === 0 ? (
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 24,
            alignItems: "center",
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ color: colors.muted, fontSize: 14 }}>
            No distributor data available yet.
          </Text>
        </View>
      ) : visibleListings.length === 0 ? (
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 24,
            alignItems: "center",
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ color: colors.muted, fontSize: 14 }}>
            No distributors in {regionFilter}.
          </Text>
          <TouchableOpacity
            onPress={() => onSetRegionFilter("all")}
            style={{
              marginTop: 12,
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 16,
              backgroundColor: colors.primary,
            }}
          >
            <Text
              style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}
            >
              Show All
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {bestInStockListing && (
            <BestDistributorCard
              listing={bestInStockListing}
              product={product}
              onSetAlert={() => onSetBestAlert(bestInStockListing)}
            />
          )}
          {insight && (
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 16,
                padding: 16,
                marginTop: 12,
              }}
            >
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 12,
                  fontWeight: "600",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                AI insight
              </Text>
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 14,
                  marginTop: 4,
                  lineHeight: 20,
                }}
              >
                {insight}
              </Text>
            </View>
          )}
          {bestInStockListing && (
            <Text
              style={{
                color: colors.muted,
                fontSize: 12,
                fontWeight: "600",
                marginBottom: 10,
                marginTop: 4,
                letterSpacing: 0.5,
              }}
            >
              ALL DISTRIBUTORS
            </Text>
          )}
          <View
            style={{
              flexDirection: "row",
              marginBottom: 12,
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            {["all", ...regions].map((region) => (
              <TouchableOpacity
                key={region}
                onPress={() => onSetRegionFilter(region)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 16,
                  backgroundColor:
                    regionFilter === region
                      ? colors.primary
                      : colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text
                  style={{
                    color:
                      regionFilter === region ? "#fff" : colors.foreground,
                    fontSize: 13,
                    fontWeight: "600",
                  }}
                >
                  {region === "all" ? "All" : region}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {bestDeal && (
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 16,
                padding: 16,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 12,
                  fontWeight: "600",
                  letterSpacing: 0.5,
                }}
              >
                BEST DEAL (incl. shipping to {shippingRegion})
              </Text>
              {(() => {
                const distrib = getDistributorById(bestDeal.distributorId);
                return (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginTop: 8,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.foreground,
                        fontSize: 16,
                        fontWeight: "700",
                        flex: 1,
                      }}
                    >
                      {distrib?.countryFlag}{" "}
                      {distrib?.name ?? bestDeal.distributorId}
                    </Text>
                    <Text
                      style={{
                        color: colors.primary,
                        fontSize: 18,
                        fontWeight: "700",
                      }}
                    >
                      {formatPrice(bestDeal.total, bestDeal.currency)}
                    </Text>
                  </View>
                );
              })()}
              <View
                style={{ flexDirection: "row", marginTop: 8, gap: 16 }}
              >
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  Price: {formatPrice(bestDeal.price, bestDeal.currency)}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  Tax:{" "}
                  {bestDeal.tax > 0
                    ? formatPrice(bestDeal.tax, bestDeal.currency)
                    : "Tax-free"}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  Ship: {formatPrice(bestDeal.shipping, bestDeal.currency)}
                </Text>
              </View>
            </View>
          )}
          {visibleListings.map((listing) => (
            <DistributorListingCard
              key={listing.distributorId}
              listing={listing}
              stockWatches={stockWatches}
              onToggleStockWatch={onToggleStockWatch}
              onOpenChart={onOpenChart}
            />
          ))}
        </>
      )}
    </View>
  );
}

// ─── PriceAlertModal ─────────────────────────────────────────────────────────

interface PriceAlertModalProps {
  visible: boolean;
  onClose: () => void;
  onSetAlert: () => void;
  alertPrice: string;
  setAlertPrice: (price: string) => void;
  alertCurrency: string;
  setAlertCurrency: (currency: string) => void;
  productName: string;
}

export function PriceAlertModal({
  visible,
  onClose,
  onSetAlert,
  alertPrice,
  setAlertPrice,
  alertCurrency,
  setAlertCurrency,
  productName,
}: PriceAlertModalProps) {
  const colors = useColors();

  return (
    <Modal visible={visible} transparent animationType="slide">
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
              marginBottom: 6,
            }}
          >
            Set Price Alert
          </Text>
          <Text
            style={{ color: colors.muted, fontSize: 14, marginBottom: 20 }}
          >
            Get notified when {productName} drops below your target price.
          </Text>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 10,
              marginBottom: 16,
            }}
          >
            {Object.keys(EXCHANGE_RATES).map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => setAlertCurrency(c)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 20,
                  backgroundColor:
                    alertCurrency === c ? colors.primary : colors.surface,
                  borderWidth: 1,
                  borderColor:
                    alertCurrency === c ? colors.primary : colors.border,
                }}
              >
                <Text
                  style={{
                    color: alertCurrency === c ? "#fff" : colors.foreground,
                    fontWeight: "600",
                  }}
                >
                  {c}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            value={alertPrice}
            onChangeText={setAlertPrice}
            placeholder={`Target price in ${alertCurrency}`}
            placeholderTextColor={colors.muted}
            keyboardType="decimal-pad"
            style={{
              backgroundColor: colors.surface,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 14,
              color: colors.foreground,
              fontSize: 18,
              marginBottom: 16,
            }}
          />
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
              <Text style={{ color: colors.foreground, fontWeight: "600" }}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onSetAlert}
              style={{
                flex: 1,
                backgroundColor: colors.primary,
                borderRadius: 14,
                paddingVertical: 14,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "600" }}>
                Set Alert
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

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
