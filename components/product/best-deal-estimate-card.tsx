import { Text, TouchableOpacity, View } from "react-native";
import { formatPrice } from "@shared/currency";
import { formatEstimate } from "@/lib/estimate-format";
import { getDistributorById } from "@shared/distributors";
import { openListingUrl } from "@/lib/listing-utils";
import { IconSymbol } from "@/components/ui/icon-symbol";
import type { BestDeal } from "@/lib/best-deal";
import type { Destination } from "@/lib/landed-cost";
import type { DistributorListing } from "@/lib/types";
import type { useColors } from "@/hooks/use-colors";

type Colors = ReturnType<typeof useColors>;

export function BestDealEstimateCard({
  colors,
  bestDeal,
  destination,
  selectedCountry,
  shippingRegion,
  sortedListings,
}: {
  colors: Colors;
  bestDeal: BestDeal;
  destination: Destination | null;
  selectedCountry: { name: string } | undefined;
  shippingRegion: string;
  sortedListings: DistributorListing[];
}) {
  const distrib = getDistributorById(bestDeal.distributorId);
  const listing = sortedListings.find(
    (l) => l.distributorId === bestDeal.distributorId && l.url,
  );
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text
        style={{
          color: colors.muted,
          fontSize: 12,
          fontWeight: "600",
          letterSpacing: 0.5,
        }}
      >
        {destination
          ? `BEST DEAL (to ${selectedCountry?.name ?? destination.countryCode})`
          : `BEST DEAL (incl. shipping to ${shippingRegion})`}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
        <Text
          style={{
            color: colors.foreground,
            fontSize: 16,
            fontWeight: "700",
            flex: 1,
          }}
        >
          {distrib?.countryCode} {distrib?.name ?? bestDeal.distributorId}
        </Text>
        <Text style={{ color: colors.primary, fontSize: 18, fontWeight: "700" }}>
          {destination
            ? formatEstimate(bestDeal.total, bestDeal.currency)
            : formatPrice(bestDeal.total, bestDeal.currency)}
        </Text>
      </View>
      <View style={{ flexDirection: "row", marginTop: 8, gap: 16 }}>
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          Price: {formatPrice(bestDeal.price, bestDeal.currency)}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          Tax:{" "}
          {bestDeal.tax > 0 ? formatPrice(bestDeal.tax, bestDeal.currency) : "Tax-free"}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          Ship:{" "}
          {bestDeal.shipping === null
            ? "N/A"
            : destination
              ? formatEstimate(bestDeal.shipping, bestDeal.currency)
              : formatPrice(bestDeal.shipping, bestDeal.currency)}
        </Text>
      </View>
      {destination && (
        <>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>
            {formatPrice(bestDeal.price, bestDeal.currency)} +{" "}
            {formatEstimate(bestDeal.shipping ?? 0, bestDeal.currency)}
            {bestDeal.tax > 0 ? ` + ${formatPrice(bestDeal.tax, bestDeal.currency)}` : ""}
            {bestDeal.importEstimate && bestDeal.importEstimate > 0
              ? ` + ${formatEstimate(bestDeal.importEstimate, bestDeal.currency)}`
              : ""}{" "}
            = {formatEstimate(bestDeal.total, bestDeal.currency)}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
            Shipping is estimated. Check exact rates at checkout.
          </Text>
        </>
      )}
      {listing && (
        <TouchableOpacity
          activeOpacity={0.85}
          accessibilityLabel="Visit store"
          accessibilityRole="button"
          onPress={() => void openListingUrl(listing.url)}
          style={{
            marginTop: 10,
            alignSelf: "flex-start",
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 16,
            backgroundColor: colors.primary,
          }}
        >
          <IconSymbol name="arrow.up.right.square" size={14} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>
            Visit store
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
