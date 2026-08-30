import {
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/use-colors";
import { EXCHANGE_RATES, formatPrice } from "@/lib/currency";
import type { AlertSuggestion } from "@/lib/alert-suggestions";

interface PriceAlertModalProps {
  visible: boolean;
  onClose: () => void;
  onSetAlert: () => void;
  alertPrice: string;
  setAlertPrice: (price: string) => void;
  alertCurrency: string;
  setAlertCurrency: (currency: string) => void;
  productName: string;
  suggestions?: AlertSuggestion[];
  distributors?: { id: string; name: string; countryFlag: string }[];
  selectedDistributorId?: string | null;
  onSelectDistributor?: (id: string | null) => void;
  direction?: "drop" | "rise";
  onDirectionChange?: (direction: "drop" | "rise") => void;
  editingAlertId?: string;
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
  suggestions,
  distributors,
  selectedDistributorId,
  onSelectDistributor,
  direction,
  onDirectionChange,
  editingAlertId,
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
            {editingAlertId ? "Edit Alert" : "Set Price Alert"}
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
                accessibilityLabel={`Select ${c} currency`}
                accessibilityRole="radio"
                accessibilityState={{ checked: alertCurrency === c }}
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
          {suggestions && suggestions.length > 0 && (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 16,
              }}
            >
              {suggestions.map((suggestion) => (
                <TouchableOpacity
                  key={suggestion.key}
                  onPress={() => {
                    if (Platform.OS !== "web")
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setAlertPrice(String(suggestion.price));
                  }}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: colors.primary,
                    backgroundColor: colors.primary + "22",
                  }}
                  accessibilityLabel={`Set price to ${suggestion.label}`}
                  accessibilityRole="button"
                >
                  <Text
                    style={{
                      color: colors.primary,
                      fontSize: 12,
                      fontWeight: "600",
                    }}
                  >
                    {suggestion.label} ·{" "}
                    {formatPrice(suggestion.price, alertCurrency)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {onDirectionChange && (
            <View
              style={{
                flexDirection: "row",
                backgroundColor: colors.background,
                borderRadius: 12,
                padding: 3,
                marginBottom: 16,
              }}
            >
              {(
                [
                  { key: "drop", label: "▼ Drops below" },
                  { key: "rise", label: "▲ Rises above" },
                ] as const
              ).map((opt) => {
                const active = (direction ?? "drop") === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    onPress={() => {
                      if (Platform.OS !== "web")
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onDirectionChange(opt.key);
                    }}
                    style={{
                      flex: 1,
                      paddingVertical: 8,
                      borderRadius: 10,
                      alignItems: "center",
                      backgroundColor: active ? colors.primary : "transparent",
                    }}
                    accessibilityLabel={opt.label}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                  >
                    <Text
                      style={{
                        color: active ? "#fff" : colors.muted,
                        fontSize: 13,
                        fontWeight: "600",
                      }}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          {distributors && distributors.length > 0 && (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 16,
              }}
            >
              <TouchableOpacity
                onPress={() => {
                  if (Platform.OS !== "web")
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onSelectDistributor?.(null);
                }}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor:
                    selectedDistributorId == null
                      ? colors.primary
                      : colors.border,
                  backgroundColor:
                    selectedDistributorId == null
                      ? colors.primary + "22"
                      : "transparent",
                }}
                accessibilityLabel="All distributors"
                accessibilityRole="radio"
                accessibilityState={{ selected: selectedDistributorId == null }}
              >
                <Text
                  style={{
                    color:
                      selectedDistributorId == null
                        ? colors.primary
                        : colors.muted,
                    fontSize: 12,
                    fontWeight: "600",
                  }}
                >
                  All distributors
                </Text>
              </TouchableOpacity>
              {distributors.map((d) => {
                const selected = selectedDistributorId === d.id;
                return (
                  <TouchableOpacity
                    key={d.id}
                    onPress={() => {
                      if (Platform.OS !== "web")
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onSelectDistributor?.(d.id);
                    }}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected
                        ? colors.primary + "22"
                        : "transparent",
                    }}
                    accessibilityLabel={`Select ${d.name}`}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <Text
                      style={{
                        color: selected ? colors.primary : colors.muted,
                        fontSize: 12,
                        fontWeight: "600",
                      }}
                    >
                      {d.countryFlag} {d.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
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
              accessibilityLabel="Cancel"
              accessibilityRole="button"
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
              accessibilityLabel={editingAlertId ? "Save changes" : "Set alert"}
              accessibilityRole="button"
            >
              <Text style={{ color: "#fff", fontWeight: "600" }}>
                {editingAlertId ? "Save Changes" : "Set Alert"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
