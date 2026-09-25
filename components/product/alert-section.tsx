import { useState } from "react";
import { Text, View, TextInput, TouchableOpacity, Keyboard, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { addAlert } from "@/lib/storage";
import { ensureNotificationPermission, schedulePriceAlert } from "@/lib/notifications";
import { showAlert } from "@/lib/alert";
import { useToast } from "@/components/ui/toast";
import { useColors } from "@/hooks/use-colors";
import { formatPrice } from "@shared/currency";
import type { PriceAlert } from "@/lib/types";

export function AlertSection({ productId, productName, displayCurrency = "USD", onAdded }: { productId: string; productName?: string; displayCurrency?: string; onAdded?: (alert: PriceAlert) => void }) {
  const colors = useColors();
  const { showToast } = useToast();
  const [price, setPrice] = useState("");
  const [adding, setAdding] = useState(false);
  const currency = displayCurrency;
  const onAdd = async () => {
    Keyboard.dismiss();
    // Guard against double-submit: the button and onSubmitEditing both call
    // this, and each call would mint a new alert id.
    if (adding) return;
    const targetPrice = parseFloat(price);
    if (!Number.isFinite(targetPrice) || targetPrice <= 0) { showAlert("Invalid price", "Please enter a valid target price."); return; }
    // Same gate as every other alert-creation path (product detail, compare,
    // desktop): without notification permission the alert saves but can never
    // notify, yet the toast below promises it will.
    const granted = await ensureNotificationPermission();
    if (!granted) {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAlert(
        "Permission Denied",
        Platform.OS === "web"
          ? "Please allow notifications in your browser to receive price alerts."
          : "Please enable notifications in your device settings to receive price alerts.",
      );
      return;
    }
    setAdding(true);
    try {
      const alert = { id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, productId, targetPrice, currency, isActive: true, createdAt: new Date().toISOString(), direction: "drop" as const };
      await addAlert(alert);
      // Let the parent refresh its alerts state so the Distributor Targets
      // table reflects this product-wide target immediately.
      onAdded?.(alert);
      await schedulePriceAlert(productName ?? "Product", targetPrice, currency, productId).catch(() => {});
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(`Alert created — watching for ${formatPrice(targetPrice, currency)}`, "success");
      setPrice("");
    } catch {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAlert("Couldn't create alert", "We couldn't save your price alert. Please try again.");
    } finally {
      setAdding(false);
    }
  };
  return (
    <View style={{ padding: 16 }}>
      <Text style={{ color: colors.foreground, fontWeight: "600", marginBottom: 8 }}>Price Alert</Text>
      <TextInput value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="Target price" placeholderTextColor={colors.muted} returnKeyType="done" onSubmitEditing={onAdd} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, color: colors.foreground }} />
      <TouchableOpacity activeOpacity={0.85} onPress={onAdd} style={{ backgroundColor: colors.primary, borderRadius: 8, padding: 10, marginTop: 10, alignItems: "center" }} accessibilityLabel="Add price alert" accessibilityRole="button"><Text style={{ color: "#fff", fontWeight: "600" }}>Add Alert</Text></TouchableOpacity>
    </View>
  );
}
