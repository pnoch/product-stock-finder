import React from "react";
import { Pressable, Text, View } from "react-native";
import { StockBadge } from "@/components/stock-badge";
import { formatPrice } from "@/lib/currency";
import { useColors } from "@/hooks/use-colors";
import type { DistributorListing, Product } from "@/lib/types";

export const DistributorRow = React.memo(function DistributorRow({
  listing,
  product,
  onWatchToggle,
}: {
  listing: DistributorListing;
  product: Product;
  onWatchToggle: (productId: string, distributorId: string) => void;
}) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", padding: 12, borderBottomWidth: 1, borderColor: colors.border }}>
      <View>
        <Text style={{ color: colors.foreground, fontWeight: "600" }}>{listing.distributorId}</Text>
        <Text style={{ color: colors.primary, fontWeight: "700" }}>{formatPrice(listing.price, listing.currency)}</Text>
      </View>
      <StockBadge status={listing.stockStatus} />
      <Pressable
        onPress={() => onWatchToggle(product.id, listing.distributorId)}
        android_ripple={{ color: colors.primary + "22" }}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 6, borderRadius: 10, overflow: "hidden" })}
        accessibilityLabel="Toggle watch"
        accessibilityRole="button"
      >
        <Text style={{ color: colors.primary }}>Watch</Text>
      </Pressable>
    </View>
  );
});
