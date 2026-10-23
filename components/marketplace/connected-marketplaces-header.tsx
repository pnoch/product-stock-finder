import { Text, TouchableOpacity, View } from "react-native";
import type { useColors } from "@/hooks/use-colors";

type Colors = ReturnType<typeof useColors>;

export function ConnectedMarketplacesHeader({
  colors,
  onBack,
}: {
  colors: Colors;
  onBack: () => void;
}) {
  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", padding: 16 }}>
        <TouchableOpacity
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={onBack}
          hitSlop={12}
          style={{ marginRight: 12 }}
        >
          <Text style={{ color: colors.primary, fontSize: 16 }}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "700" }}>
          Connected marketplaces
        </Text>
      </View>

      <Text
        style={{
          color: colors.muted,
          fontSize: 13,
          paddingHorizontal: 16,
          paddingBottom: 12,
        }}
      >
        Connect a marketplace in the app browser so its signed-in session is
        available to checks. Closing the browser cancels. Tapping Done starts a
        page-access check.
      </Text>
    </>
  );
}
