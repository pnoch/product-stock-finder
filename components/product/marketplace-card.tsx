import { useState } from "react";
import { Platform, Text, TextInput, TouchableOpacity, View } from "react-native";
import * as Linking from "expo-linking";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/use-colors";
import { useMarketplaceConnections } from "@/hooks/use-marketplace-connections";
import type { Product } from "@/lib/types";
import { parseManualPrice, refreshMarketplaceListing } from "@/lib/marketplace";
import { updateManualMarketplacePrice } from "@/lib/storage";
import { showAlert } from "@/lib/alert";
import { formatPrice } from "@shared/currency";

export function MarketplaceCard({ product, onUpdated }: { product: Product; onUpdated: () => Promise<unknown> }) {
  const colors = useColors();
  const router = useRouter();
  const { connections } = useMarketplaceConnections();
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const marketplace = product.marketplace;
  const brand = marketplace?.platform === "lazada" ? "Lazada" : marketplace?.platform === "facebook" ? "Facebook Marketplace" : "Shopee";
  const shortName = marketplace?.platform === "lazada" ? "Lazada TH" : marketplace?.platform === "facebook" ? "Facebook Marketplace" : "Shopee TH";
  const visitLabel = marketplace?.platform === "facebook" ? "Open Facebook listing" : `Visit ${brand} product`;
  const check = async () => {
    if (checking) return;
    setChecking(true);
    try {
      const out = await refreshMarketplaceListing(product);
      // A variant-matched observation means the user verified this exact
      // offer: hand it to the automatic pipeline for background checks.
      // Facebook listings have no variants, so a verified observation stays
      // manual — background checks are not offered for Facebook.
      if (out.status === "updated" && out.variantMatched && marketplace?.platform !== "facebook") {
        const { updateMarketplaceStatus } = await import("@/lib/storage");
        await updateMarketplaceStatus(product.id, "automatic");
      }
      await onUpdated();
      if (out.status === "updated") {
        if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (out.status === "login_required") {
        showAlert(
          `${brand} login needed`,
          marketplace?.platform === "facebook"
            ? "Facebook requires login. Log into Facebook in the app's browser, then try again."
            : `${brand} asked for login. Open Settings → Site sessions to connect, then try again.`,
        );
      } else if (out.status === "no_price") {
        showAlert(
          "No price found",
          marketplace?.platform === "facebook"
            ? "The listing may have changed or been removed — reconfirm it, or re-import the link."
            : "The page loaded but no variant price was readable. Try again later.",
        );
      } else {
        showAlert("Check unavailable", "On-device price check isn't available on this platform.");
      }
    } finally { setChecking(false); }
  };
  if (!marketplace) return null;
  const verification = connections.find(
    (connection) => connection.site === marketplace.platform,
  )?.verification;
  const connectLabel = verification?.kind === "ready" ? "Reconnect" : "Connect";
  const listing = product.listings[0];
  const save = async () => {
    if (saving || parseManualPrice(price) === null) return;
    setSaving(true);
    try {
      await updateManualMarketplacePrice(product.id, price);
      await onUpdated();
      setPrice("");
      if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      showAlert("Couldn't update price", error instanceof Error ? error.message : "Try again.");
    } finally { setSaving(false); }
  };
  return (
    <View style={{ margin: 16, padding: 16, borderRadius: 16, backgroundColor: colors.surface, gap: 12 }}>
      <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 18 }}>{shortName}</Text>
      <Text style={{ color: colors.foreground }}>Selected variant: {marketplace.variant}{"\n"}Seller: {marketplace.seller}</Text>
      <Text style={{ color: colors.foreground }}>Manually entered price: {listing ? formatPrice(listing.price, "THB") : "Not entered"}</Text>
      {listing && <Text style={{ color: colors.muted }}>Entered {new Date(listing.lastChecked).toLocaleString()} · {listing.priceHistory.length} manual price records</Text>}
      <Text style={{ color: colors.muted }}>Monitoring: {marketplace.monitoringStatus.replace("_", " ")}. {brand === "Shopee" ? "Shopee may require login. " : ""}{brand === "Facebook Marketplace" ? "Facebook requires login. " : ""}Price and stock are not automatically verified; automatic alerts are unavailable.</Text>
      <TouchableOpacity accessibilityRole="link" accessibilityLabel={visitLabel} onPress={() => { void Linking.openURL(marketplace.canonicalUrl).catch(() => showAlert(`Couldn't open ${brand}`, "Please try again.")); }}>
        <Text style={{ color: colors.primary }}>{visitLabel}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`${connectLabel} ${brand}`}
        onPress={() => {
          if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          // Carry the tracked product so the connection screen verifies this
          // exact listing instead of a generic navigation probe.
          router.push({
            pathname: "/connected-marketplaces",
            params: { site: marketplace.platform, productId: product.id },
          });
        }}
      >
        <Text style={{ color: colors.primary }}>{connectLabel} {brand} session</Text>
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Check current ${brand} price`} disabled={checking} onPress={() => void check()}>
        <Text style={{ color: colors.primary }}>{checking ? "Checking…" : "Check current price"}</Text>
      </TouchableOpacity>
      <TextInput accessibilityLabel="Updated manual THB price" placeholder="New manual price (THB)" placeholderTextColor={colors.muted} keyboardType="decimal-pad" value={price} onChangeText={setPrice} style={{ color: colors.foreground, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12 }} />
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Save manual price" disabled={saving || parseManualPrice(price) === null} onPress={() => void save()} style={{ opacity: saving || parseManualPrice(price) === null ? 0.5 : 1 }}>
        <Text style={{ color: colors.primary }}>{saving ? "Saving…" : "Save manual price"}</Text>
      </TouchableOpacity>
    </View>
  );
}
