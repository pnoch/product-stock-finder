import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { fetchEbaySearch } from "@/lib/server-marketplace";
import { convertPrice } from "@/lib/currency";
import { getSettings } from "@/lib/storage";
import { formatPrice } from "@shared/currency";
import { EBAY_SEARCH_QUERY_MAX, type EbaySearchListing, type EbaySearchResult } from "@/shared/ebay-search";

export function EbayResultsSection({ query, onTrack }: { query: string; onTrack: (listing: EbaySearchListing) => void }) {
  const colors = useColors();
  const [result, setResult] = useState<EbaySearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  useEffect(() => {
    let active = true;
    void getSettings()
      .then((settings) => {
        if (active) setDisplayCurrency(settings?.displayCurrency ?? "USD");
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const trimmed = query.trim();
  const eligible = trimmed.length >= 2 && trimmed.length <= EBAY_SEARCH_QUERY_MAX && !/^https?:\/\//i.test(trimmed);
  useEffect(() => {
    if (!eligible) return;
    let active = true;
    // Defer the reset so the effect does not synchronously cascade state updates.
    queueMicrotask(() => {
      if (!active) return;
      setResult(null);
      setLoading(true);
    });
    const timer = setTimeout(() => {
      void fetchEbaySearch(trimmed).then((value) => {
        if (!active) return;
        setResult(value);
        setLoading(false);
      }).catch(() => {
        if (!active) return;
        setResult({ kind: "unavailable", reason: "network" });
        setLoading(false);
      });
    }, 700);
    return () => { clearTimeout(timer); active = false; };
  }, [trimmed, eligible, retry]);
  if (!eligible) return null;
  return (
    <View style={{ marginHorizontal: 16, marginBottom: 16, padding: 14, borderRadius: 16, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }}>
      <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "700" }}>eBay listings</Text>
      {loading && <View style={{ flexDirection: "row", gap: 8, paddingVertical: 12 }}><ActivityIndicator color={colors.primary} /><Text style={{ color: colors.muted }}>Searching eBay…</Text></View>}
      {result?.kind === "empty" && <Text style={{ color: colors.muted, paddingTop: 8 }}>No eBay matches for this search.</Text>}
      {result?.kind === "unavailable" && <View style={{ paddingTop: 8 }}>
        <Text style={{ color: colors.muted }}>{result.reason === "not_configured"
          ? "Online marketplace search is unavailable in this build because no reachable API server was configured."
          : `Could not search eBay. ${result.reason === "busy" ? "The search service is busy." : "Check your connection and try again."}`}</Text>
        {result.reason !== "not_configured" && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Retry eBay search" onPress={() => setRetry((value) => value + 1)} style={{ paddingVertical: 12 }}><Text style={{ color: colors.primary }}>Retry</Text></TouchableOpacity>}
      </View>}
      {result?.kind === "results" && <>
        <Text style={{ color: colors.muted, fontSize: 12, paddingTop: 4 }}>Observed offers for your query. Confirm model, condition, and shipping before tracking.</Text>
        {result.listings.map((item) => {
          // eBay returns the seller's native currency; show the converted amount
          // too so offers are comparable with the rest of the app.
          const converted =
            item.price !== null && item.currency && item.currency !== displayCurrency
              ? convertPrice(item.price, item.currency, displayCurrency)
              : null;
          return (
            <View key={item.itemId} style={{ flexDirection: "row", gap: 10, borderBottomWidth: 0.5, borderBottomColor: colors.border, paddingVertical: 12 }}>
          {item.imageUrl && <Image source={{ uri: item.imageUrl }} style={{ width: 56, height: 56, borderRadius: 8 }} accessibilityLabel={item.title} />}
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.foreground, fontWeight: "600" }} numberOfLines={2}>{item.title}</Text>
            <Text style={{ color: colors.primary, paddingTop: 4 }}>{item.price !== null && item.currency ? formatPrice(item.price, item.currency) : "Price not available"}</Text>
            {converted !== null && <Text style={{ color: colors.muted, fontSize: 12 }}>≈ {formatPrice(converted, displayCurrency)}</Text>}
            {item.condition && <Text style={{ color: colors.muted, fontSize: 12 }}>{item.condition}</Text>}
            {item.seller && <Text style={{ color: colors.muted, fontSize: 12 }}>Seller: {item.seller}</Text>}
            {item.shipping && <Text style={{ color: colors.muted, fontSize: 12 }}>Shipping: {item.shipping}</Text>}
          </View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Track eBay listing ${item.title}`} onPress={() => onTrack(item)} style={{ alignSelf: "center", padding: 10 }}><Text style={{ color: colors.primary, fontWeight: "700" }}>Track</Text></TouchableOpacity>
            </View>
          );
        })}
      </>}
    </View>
  );
}
