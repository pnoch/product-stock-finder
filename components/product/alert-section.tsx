import { useState } from "react";
import { Text, View, TextInput, TouchableOpacity, Keyboard, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { addAlert } from "@/lib/storage";
import { schedulePriceAlert } from "@/lib/notifications";
import { showAlert } from "@/lib/alert";
import { useToast } from "@/components/ui/toast";
import { useColors } from "@/hooks/use-colors";
import { formatPrice } from "@/lib/currency";

export function AlertSection({ productId, productName, displayCurrency = "USD" }: { productId: string; productName?: string; displayCurrency?: string }) {
  const colors = useColors();
  const { showToast } = useToast();
  const [price, setPrice] = useState("");
  const currency = displayCurrency;
  const onAdd = async () => {
    Keyboard.dismiss();
    const targetPrice = parseFloat(price);
    if (!Number.isFinite(targetPrice) || targetPrice <= 0) { showAlert("Invalid price", "Please enter a valid target price."); return; }
    try {
      const alert = { id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, productId, targetPrice, currency, isActive: true, createdAt: new Date().toISOString(), direction: "drop" as const };
      await addAlert(alert);
      await schedulePriceAlert(productName ?? "Product", targetPrice, currency, productId).catch(() => {});
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(`Alert created — watching for ${formatPrice(targetPrice, currency)}`, "success");
      setPrice("");
    } catch {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAlert("Couldn't create alert", "We couldn't save your price alert. Please try again.");
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
