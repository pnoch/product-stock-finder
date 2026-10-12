import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Linking from "expo-linking";

import { useColors } from "@/hooks/use-colors";
import { formatPrice } from "@shared/currency";
import {
  buildFbSearchUrl,
  searchFbMarketplace,
  type FbSearchState,
} from "@/lib/marketplace/fb-search";

const FB_LOCATION = "Bangkok";
const FB_RADIUS_KM = 64;
const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 500;
const MAX_ROWS = 5;

export function FacebookResultsSection({
  query,
  onTrack,
}: {
  query: string;
  onTrack: (url: string) => void;
}) {
  const colors = useColors();
  const [state, setState] = useState<FbSearchState | null>(null);
  const [loading, setLoading] = useState(false);
  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setState(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    const timer = setTimeout(() => {
      void searchFbMarketplace({
        query: trimmed,
        location: FB_LOCATION,
        radiusKm: FB_RADIUS_KM,
      })
        .then((result) => {
          if (!active) return;
          setState(result);
          setLoading(false);
        })
        .catch(() => {
          if (!active) return;
          setState({ kind: "unavailable" });
          setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [trimmed]);

  if (trimmed.length < MIN_QUERY_LENGTH) return null;

  if (loading) {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 16,
          paddingVertical: 8,
          marginBottom: 8,
        }}
      >
        <ActivityIndicator size="small" color={colors.muted} />
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          Checking Facebook Marketplace…
        </Text>
      </View>
    );
  }

  if (!state) return null;

  if (state.kind === "login_required") {
    return (
      <View
        style={{
          marginHorizontal: 16,
          marginBottom: 12,
          padding: 12,
          borderRadius: 12,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          Facebook Marketplace — sign in in the app browser to see local listings
        </Text>
      </View>
    );
  }

  if (state.kind !== "listings") return null;

  const { listings } = state;
  const seeAllUrl = buildFbSearchUrl({
    query: trimmed,
    location: FB_LOCATION,
    radiusKm: FB_RADIUS_KM,
  });

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 16,
        borderRadius: 16,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text
        style={{
          color: colors.foreground,
          fontWeight: "700",
          fontSize: 15,
          marginBottom: 10,
        }}
      >
        Facebook Marketplace ({listings.length})
      </Text>

      {listings.slice(0, MAX_ROWS).map((item, index) => (
        <TouchableOpacity
          key={item.itemId}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Track ${item.title || "Facebook Marketplace listing"}`}
          onPress={() => onTrack(item.url)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 10,
            borderTopWidth: index === 0 ? 0 : 1,
            borderTopColor: colors.border,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              numberOfLines={1}
              style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}
            >
              {item.title || "Facebook Marketplace listing"}
            </Text>
            {item.location ? (
              <Text
                numberOfLines={1}
                style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}
              >
                {item.location}
              </Text>
            ) : null}
          </View>
          {item.price != null ? (
            <Text
              style={{
                color: colors.primary,
                fontSize: 14,
                fontWeight: "700",
                marginLeft: 12,
              }}
            >
              {formatPrice(item.price, item.currency ?? "THB")}
            </Text>
          ) : null}
        </TouchableOpacity>
      ))}

      <TouchableOpacity
        activeOpacity={0.85}
        accessibilityRole="link"
        accessibilityLabel="See all on Facebook"
        onPress={() => {
          void Linking.openURL(seeAllUrl).catch(() => {});
        }}
        style={{ paddingTop: 12 }}
      >
        <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}>
          See all on Facebook →
        </Text>
      </TouchableOpacity>
    </View>
  );
}
