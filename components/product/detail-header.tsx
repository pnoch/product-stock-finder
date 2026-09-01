import { Text, View } from "react-native";
import { StockBadge } from "@/components/stock-badge";
import { getDistributorById } from "@/lib/distributors";
import { useColors } from "@/hooks/use-colors";
import type { Product } from "@/lib/types";
import type { BestDeal } from "@/lib/best-deal";

export function DetailHeader({ product, bestDeal }: { product: Product; bestDeal: BestDeal | null }) {
  const colors = useColors();
  const region = bestDeal
    ? getDistributorById(bestDeal.distributorId)?.region
    : product.listings?.[0]
      ? getDistributorById(product.listings[0].distributorId)?.region
      : undefined;
  return (
    <View style={{ padding: 16 }}>
      <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "700" }}>{product.name}</Text>
      <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>{product.brand} · {product.category} · {product.modelNumber}</Text>
      {region ? <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>{region}</Text> : null}
      {bestDeal ? <View style={{ marginTop: 8 }}><StockBadge status="in_stock" /></View> : null}
    </View>
  );
}
