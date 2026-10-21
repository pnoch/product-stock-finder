import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  isEbayInput,
  isFacebookInput,
  isLazadaInput,
  isShopeeInput,
} from "@/shared/marketplace-url";

export function SearchDiscoverFooter({
  query,
  discovering,
  onDiscover,
}: {
  query: string;
  discovering: boolean;
  onDiscover: () => void;
}) {
  const colors = useColors();
  if (query.trim().length === 0) return null;

  const label = isFacebookInput(query)
    ? "Import Facebook Link"
    : isLazadaInput(query)
      ? "Import Lazada Link"
      : isShopeeInput(query)
        ? "Import Shopee Link"
        : isEbayInput(query)
          ? "Import eBay Link"
          : "Discover with AI";

  return (
    <View style={{ paddingHorizontal: 16 }}>
      {discovering ? (
        <View style={{ alignItems: "center", padding: 24 }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.muted, marginTop: 8 }}>
            Discovering product...
          </Text>
        </View>
      ) : (
        <TouchableOpacity
          activeOpacity={0.85}
          accessibilityLabel={label}
          accessibilityRole="button"
          onPress={onDiscover}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: 16,
            marginTop: 16,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.primary + "44",
            backgroundColor: colors.primary + "11",
          }}
        >
          <IconSymbol name="wand.and.stars" size={20} color={colors.primary} />
          <Text
            style={{
              color: colors.primary,
              fontWeight: "600",
              fontSize: 14,
            }}
          >
            {label}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
