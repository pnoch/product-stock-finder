import React, { memo, useCallback } from "react";
import { View, Text, Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/use-colors";
import { formatPrice } from "@shared/currency";
import { isServerConfigured } from "@/constants/oauth";
import { fetchAvailable, type AvailableProduct } from "@/lib/server-catalog";

const AvailableRow = memo(function AvailableRow({
  product,
  onPress,
}: {
  product: AvailableProduct;
  onPress: (id: string) => void;
}) {
  const colors = useColors();
  const handlePress = useCallback(() => onPress(product.id), [onPress, product.id]);
  return (
    <Pressable
      onPress={handlePress}
      accessibilityLabel={`View ${product.name}`}
      accessibilityRole="button"
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={{ color: colors.foreground, fontSize: 15, fontWeight: "600" }}
          >
            {product.name}
          </Text>
          <Text
            numberOfLines={1}
            style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}
          >
            in stock at {product.storeCount}{" "}
            {product.storeCount === 1 ? "store" : "stores"}
          </Text>
        </View>
        <Text
          style={{ color: colors.primary, fontSize: 15, fontWeight: "700" }}
        >
          {formatPrice(product.bestPrice, product.bestCurrency)}
        </Text>
      </View>
    </Pressable>
  );
});
AvailableRow.displayName = "AvailableRow";

export const AvailableSection = memo(function AvailableSection() {
  const colors = useColors();
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ["available", "home"],
    queryFn: () => fetchAvailable(),
    enabled: isServerConfigured(),
  });

  if (isLoading || !data || data.length === 0) return null;

  const rows = data.slice(0, 5);

  return (
    <View style={{ marginBottom: 16 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 4,
        }}
      >
        <Text
          accessibilityRole="header"
          style={{ fontSize: 18, fontWeight: "700", color: colors.foreground }}
        >
          Available Now
        </Text>
        <Pressable
          onPress={() => router.push("/available")}
          accessibilityLabel="See all available products"
          accessibilityRole="button"
          hitSlop={8}
        >
          <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>
            See all
          </Text>
        </Pressable>
      </View>
      <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 12 }}>
        In stock right now across distributors
      </Text>
      {rows.map((product) => (
        <AvailableRow
          key={product.id}
          product={product}
          onPress={(id) => router.push(`/product/${id}`)}
        />
      ))}
    </View>
  );
});
AvailableSection.displayName = "AvailableSection";
