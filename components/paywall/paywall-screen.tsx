import { useState, type JSX } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getEntitlementProvider } from "@/lib/entitlements";
import { track } from "@/lib/telemetry";

const BENEFITS = [
  "Unlimited watchlist",
  "Background monitoring + alerts",
  "Digests",
  "Server sync",
  "Bulk import",
  "Landed-cost sourcing",
] as const;

export function PaywallScreen({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}): JSX.Element {
  const colors = useColors();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const provider = getEntitlementProvider();
  const purchasable = typeof provider?.purchase === "function";

  const handleUpgrade = async () => {
    setError(null);
    if (!purchasable) return;
    if (busy) return;
    if (Platform.OS !== "web")
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBusy(true);
    try {
      track("upgrade_started");
      await provider.purchase!("pro");
      if (Platform.OS !== "web")
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch {
      setError("Purchase failed. Please try again.");
      if (Platform.OS !== "web")
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
        onPress={onClose}
        accessibilityLabel="Close"
      >
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
            maxHeight: "85%",
          }}
          accessibilityViewIsModal
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: colors.primary + "22",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 12,
              }}
            >
              <IconSymbol name="crown.fill" size={22} color={colors.primary} />
            </View>
            <Text
              style={{
                color: colors.foreground,
                fontSize: 22,
                fontWeight: "700",
                flex: 1,
              }}
            >
              Go Pro
            </Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onClose}
              style={{ padding: 4 }}
              accessibilityLabel="Close"
              accessibilityRole="button"
            >
              <IconSymbol name="xmark.circle.fill" size={24} color={colors.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView>
            <Text
              style={{ color: colors.muted, fontSize: 14, marginBottom: 16 }}
            >
              Track every product and never miss a restock or a price drop.
            </Text>

            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                paddingVertical: 6,
                marginBottom: 20,
              }}
            >
              {BENEFITS.map((benefit, index) => (
                <View
                  key={benefit}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: colors.border,
                  }}
                >
                  <IconSymbol
                    name="checkmark.circle.fill"
                    size={18}
                    color={colors.success}
                  />
                  <Text
                    style={{
                      color: colors.foreground,
                      fontSize: 15,
                      marginLeft: 12,
                      flex: 1,
                    }}
                  >
                    {benefit}
                  </Text>
                </View>
              ))}
            </View>

            {error ? (
              <Text
                style={{
                  color: colors.error,
                  fontSize: 13,
                  marginBottom: 12,
                  textAlign: "center",
                }}
              >
                {error}
              </Text>
            ) : null}

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleUpgrade}
              disabled={!purchasable || busy}
              style={{
                backgroundColor: purchasable ? colors.primary : colors.border,
                opacity: !purchasable || busy ? 0.6 : 1,
                borderRadius: 14,
                paddingVertical: 14,
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "center",
                gap: 8,
                marginBottom: 12,
              }}
              accessibilityLabel={
                purchasable ? "Upgrade to Pro" : "Pro is coming soon"
              }
              accessibilityRole="button"
              accessibilityState={{ disabled: !purchasable || busy }}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <IconSymbol
                    name="crown.fill"
                    size={18}
                    color={purchasable ? "#fff" : colors.muted}
                  />
                  <Text
                    style={{
                      color: purchasable ? "#fff" : colors.muted,
                      fontWeight: "600",
                      fontSize: 15,
                    }}
                  >
                    {purchasable ? "Upgrade to Pro" : "Pro is coming soon"}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onClose}
              style={{ alignItems: "center", paddingVertical: 6 }}
              accessibilityLabel="Not now"
              accessibilityRole="button"
            >
              <Text style={{ color: colors.muted, fontSize: 13 }}>Not now</Text>
            </TouchableOpacity>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
