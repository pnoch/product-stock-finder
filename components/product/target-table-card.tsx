import { Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import {
  formatPrice,
  convertPrice,
  hasExchangeRate,
} from "@/lib/currency";
import { getDistributorById } from "@/lib/distributors";
import { scopedAlertFor, productWideAlert } from "@/lib/alert-scope";
import type { DistributorListing, PriceAlert } from "@/lib/types";

export function TargetTableCard({
  listings,
  alerts,
  productId,
  onSetTarget,
}: {
  listings: DistributorListing[];
  alerts: PriceAlert[];
  productId: string;
  onSetTarget: (distributorId: string) => void;
}) {
  const colors = useColors();

  const rows = listings.map((listing) => ({
    listing,
    alert: scopedAlertFor(alerts, productId, listing.distributorId),
  }));
  const wide = productWideAlert(alerts, productId);
  if (rows.length === 0) return null;

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
      <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 8 }}>
        Distributor Targets
      </Text>

      {rows.map(({ listing, alert }) => {
        const dist = getDistributorById(listing.distributorId);
        const hasFx =
          hasExchangeRate(listing.currency) &&
          hasExchangeRate(alert!.currency);
        const deltaPct =
          alert && hasFx
            ? Math.round(
                ((convertPrice(listing.price, listing.currency, alert.currency) -
                  alert.targetPrice) /
                  alert.targetPrice) *
                  100,
              )
            : null;
        const met = deltaPct !== null && deltaPct <= 0;
        return (
          <View
            key={listing.distributorId}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 7,
              gap: 8,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Text style={{ fontSize: 13 }}>{dist?.countryFlag ?? ""}</Text>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 12,
                  fontWeight: "500",
                }}
                numberOfLines={1}
              >
                {dist?.name ?? listing.distributorId}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                {formatPrice(listing.price, listing.currency)}
                {alert
                  ? ` · target ${formatPrice(alert.targetPrice, alert.currency)}`
                  : ""}
              </Text>
            </View>
            {alert && deltaPct !== null ? (
              <Text
                style={{
                  color: met ? colors.success : colors.error,
                  fontSize: 12,
                  fontWeight: "700",
                }}
              >
                {deltaPct > 0 ? "+" : ""}
                {deltaPct}%
              </Text>
            ) : (
              <TouchableOpacity
                onPress={() => onSetTarget(listing.distributorId)}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.primary + "22",
                }}
              >
                <Text
                  style={{
                    color: colors.primary,
                    fontSize: 15,
                    fontWeight: "700",
                  }}
                >
                  +
                </Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}

      {wide && (
        <Text style={{ color: colors.muted, fontSize: 11, paddingTop: 8 }}>
          Any distributor · target{" "}
          {formatPrice(wide.targetPrice, wide.currency)}
        </Text>
      )}

      {!wide && rows.every((r) => !r.alert) && (
        <Text style={{ color: colors.muted, fontSize: 11, marginTop: 8 }}>
          Set per-distributor targets with + to compare them here.
        </Text>
      )}
    </View>
  );
}
