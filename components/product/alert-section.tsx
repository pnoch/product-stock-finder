import { useState } from "react";
import { Text, View, TextInput, TouchableOpacity, Keyboard } from "react-native";
import { addAlert } from "@/lib/storage";
import { schedulePriceAlert } from "@/lib/notifications";
import { showAlert } from "@/lib/alert";
import { useToast } from "@/components/ui/toast";
import { useColors } from "@/hooks/use-colors";

export function AlertSection({ productId }: { productId: string }) {
  const colors = useColors();
  const { showToast } = useToast();
  const [price, setPrice] = useState("");
  const [currency] = useState("USD");
  const onAdd = async () => {
    Keyboard.dismiss();
    const targetPrice = parseFloat(price);
    if (!Number.isFinite(targetPrice) || targetPrice <= 0) { showAlert("Invalid price", "Please enter a valid target price."); return; }
    try {
      const alert = { id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, productId, targetPrice, currency, isActive: true, createdAt: new Date().toISOString(), direction: "drop" as const };
      await addAlert(alert);
      await schedulePriceAlert(productId, targetPrice, currency).catch(() => {});
      showToast(`Alert created — watching for ${targetPrice} ${currency}`, "success");
      setPrice("");
    } catch {
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
