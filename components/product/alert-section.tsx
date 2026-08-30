import { useState } from "react";
import { Text, View, TextInput, TouchableOpacity } from "react-native";
import { addAlert } from "@/lib/storage";
import { schedulePriceAlert } from "@/lib/notifications";
import { showAlert } from "@/lib/alert";
import { useColors } from "@/hooks/use-colors";

export function AlertSection({ productId }: { productId: string }) {
  const colors = useColors();
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const onAdd = async () => {
    const targetPrice = parseFloat(price);
    if (!Number.isFinite(targetPrice) || targetPrice <= 0) { showAlert("Invalid price", "Enter a positive number."); return; }
    const alert = { id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, productId, targetPrice, currency, isActive: true, createdAt: new Date().toISOString(), direction: "drop" as const };
    await addAlert(alert);
    await schedulePriceAlert(productId, targetPrice, currency).catch(() => {});
    showAlert("Alert Set", `You'll be notified at ${targetPrice} ${currency}.`);
    setPrice("");
  };
  return (
    <View style={{ padding: 16 }}>
      <Text style={{ color: colors.foreground, fontWeight: "600", marginBottom: 8 }}>Price Alert</Text>
      <TextInput value={price} onChangeText={setPrice} keyboardType="numeric" placeholder="Target price" style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 8, color: colors.foreground }} />
      <TouchableOpacity onPress={onAdd} style={{ backgroundColor: colors.primary, borderRadius: 8, padding: 10, marginTop: 8, alignItems: "center" }} accessibilityLabel="Add price alert" accessibilityRole="button"><Text style={{ color: "#fff", fontWeight: "600" }}>Add Alert</Text></TouchableOpacity>
    </View>
  );
}
