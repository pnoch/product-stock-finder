import type { MarketplaceIdentity } from "@/shared/marketplace-url";
import type { useColors } from "@/hooks/use-colors";

export interface Draft {
  name: string;
  modelNumber: string;
  brand: string;
  category: string;
  description: string;
}

export const EMPTY_DRAFT: Draft = {
  name: "",
  modelNumber: "",
  brand: "",
  category: "",
  description: "",
};

export function marketplaceSummary(marketplace: MarketplaceIdentity): string {
  switch (marketplace.platform) {
    case "lazada": return `Lazada TH · item ${marketplace.itemId} · sku ${marketplace.skuId}`;
    case "shopee": return `Shopee TH · shop ${marketplace.shopId} · item ${marketplace.itemId}`;
    case "ebay": return `eBay · item ${marketplace.itemId}`;
    default: return `Facebook Marketplace · item ${marketplace.itemId}`;
  }
}

export function marketplaceConfirmNote(marketplace: MarketplaceIdentity): string {
  switch (marketplace.platform) {
    case "facebook": return "Confirm the seller. The variant field is optional. Prices are manual; Facebook may require login for a price check. No automatic price or stock alerts.";
    case "shopee": return "Confirm the selected variant and seller. Prices are manual; Shopee may require login. No automatic price or stock alerts.";
    case "ebay": return "Confirm the seller. The variant field is optional. Prices are manual; eBay may require login for a price check. No automatic price or stock alerts.";
    default: return "Confirm the selected variant and seller. Prices are manual. No automatic price or stock alerts.";
  }
}

export function fieldStyle(colors: ReturnType<typeof useColors>) {
  return {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.foreground,
    fontSize: 14,
    marginBottom: 12,
  };
}
