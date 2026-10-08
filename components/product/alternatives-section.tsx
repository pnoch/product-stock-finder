import type { JSX } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { formatPrice } from "@shared/currency";
import type { Alternative } from "@/lib/alternatives";

export function AlternativesSection({
  category,
  alternatives,
}: {
  category: string;
  alternatives: Alternative[];
}): JSX.Element | null {
  const colors = useColors();
  const router = useRouter();

  if (alternatives.length === 0) return null;

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginBottom: 16,
        backgroundColor: colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 16,
      }}
    >
      <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 15, marginBottom: 12 }}>
        In stock now in {category}
      </Text>
      {alternatives.map((alt, index) => (
        <TouchableOpacity
          key={alt.id}
          activeOpacity={0.7}
          onPress={() => router.push(`/product/${alt.id}`)}
          accessibilityRole="button"
          accessibilityLabel={`View ${alt.name}`}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingVertical: 10,
            borderTopWidth: index === 0 ? 0 : 1,
            borderTopColor: colors.border,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}>
              {alt.name}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
              {formatPrice(alt.bestPrice, alt.bestCurrency)} · {alt.storeCount}{" "}
              {alt.storeCount === 1 ? "store" : "stores"}
            </Text>
          </View>
          <IconSymbol name="chevron.right" size={18} color={colors.muted} />
        </TouchableOpacity>
      ))}
    </View>
  );
}
