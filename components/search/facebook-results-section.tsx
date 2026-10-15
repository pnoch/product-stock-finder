import { useEffect, useMemo, useRef, useState } from "react";
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
  type ObservedSearchScope,
} from "@/lib/marketplace/fb-search";
import {
  getMarketplaceConnectionsService,
  type FacebookSearchPreference,
} from "@/lib/marketplace/connections";

const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 500;
const MAX_ROWS = 5;

function requestedScopeLabel(preferences: FacebookSearchPreference): string {
  const area = preferences.requestedArea.trim();
  return `Requested: ${area || "location not set"} · ${preferences.requestedRadiusKm} km`;
}

function observedScopeLabel(observed: ObservedSearchScope): string {
  const area = observed.area?.trim();
  const parts: string[] = [];
  parts.push(area ? `Location: ${area}` : "Location not confirmed");
  parts.push(
    observed.radiusKm != null
      ? `Radius: ${observed.radiusKm} km`
      : "Radius not confirmed",
  );
  return parts.join(" · ");
}

export function FacebookResultsSection({
  query,
  onTrack,
}: {
  query: string;
  onTrack: (url: string) => void;
}) {
  const colors = useColors();
  const service = useMemo(() => getMarketplaceConnectionsService(), []);
  const [state, setState] = useState<FbSearchState | null>(null);
  const [loading, setLoading] = useState(false);
  const [preferences, setPreferences] = useState<FacebookSearchPreference>(
    () => service.preferences(),
  );
  const [connected, setConnected] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const trimmed = query.trim();
  const trimmedRef = useRef(trimmed);
  const retriedAtRef = useRef<string | null>(null);

  useEffect(() => {
    trimmedRef.current = trimmed;
  }, [trimmed]);

  useEffect(() => {
    let active = true;
    void service
      .load()
      .then(() => {
        if (!active) return;
        setPreferences(service.preferences());
        setConnected(service.current("facebook").kind === "ready");
      })
      .catch(() => {});
    const unsubscribe = service.subscribe((event) => {
      if (event.type === "preferences") {
        setPreferences(event.preferences);
        return;
      }
      if (event.type === "verification" && event.site === "facebook") {
        setConnected(event.verification.kind === "ready");
      }
      // A completed Facebook search verification means the sign-in flow
      // succeeded: re-run the retained query exactly once. Failed checks never
      // reach here, and a query change no longer matches the retained query.
      if (
        event.type === "verification" &&
        event.site === "facebook" &&
        event.verification.kind === "ready" &&
        event.verification.capability.kind === "search" &&
        event.verification.capability.query.trim() === trimmedRef.current &&
        event.verification.checkedAt !== retriedAtRef.current
      ) {
        retriedAtRef.current = event.verification.checkedAt;
        setRetryToken((token) => token + 1);
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [service]);

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
        location: preferences.requestedArea,
        radiusKm: preferences.requestedRadiusKm,
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
  }, [
    trimmed,
    preferences.requestedArea,
    preferences.requestedRadiusKm,
    retryToken,
  ]);

  // Search shows Facebook results only for a connected session. When signed
  // out the section stays out of the way — connection lives in Settings →
  // Connected marketplaces.
  if (!connected) return null;

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

  // The hidden WebView couldn't render Facebook at all (session may have
  // expired, renderer busy, page didn't load). Say so — rendering nothing
  // would look identical to "no matches".
  if (state.kind === "unavailable") {
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
          Facebook Marketplace couldn&apos;t be checked right now. Reconnect in
          Settings → Connected marketplaces.
        </Text>
      </View>
    );
  }

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
          Facebook session expired — reconnect in Settings → Connected
          marketplaces to see local listings.
        </Text>
      </View>
    );
  }

  if (state.kind === "unverified") {
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
          Facebook Marketplace results couldn&apos;t be read this time. This is
          not a confirmed empty result.
        </Text>
      </View>
    );
  }

  if (state.kind !== "listings") return null;

  const { listings, observedScope } = state;
  const requestedArea = preferences.requestedArea.trim();
  const observedArea = observedScope.area?.trim() ?? null;
  const areaMismatch =
    requestedArea !== "" &&
    observedArea !== null &&
    observedArea.toLowerCase() !== requestedArea.toLowerCase();
  const seeAllUrl = buildFbSearchUrl({
    query: trimmed,
    location: preferences.requestedArea,
    radiusKm: preferences.requestedRadiusKm,
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
          marginBottom: 6,
        }}
      >
        Facebook Marketplace ({listings.length})
      </Text>

      <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 2 }}>
        {requestedScopeLabel(preferences)}
      </Text>
      <Text
        style={{
          color: observedArea === null ? colors.warning : colors.muted,
          fontSize: 12,
          marginBottom: 10,
        }}
      >
        {observedArea === null
          ? "Location not confirmed — Facebook chose the search area"
          : observedScopeLabel(observedScope)}
      </Text>
      {areaMismatch && (
        <Text style={{ color: colors.warning, fontSize: 12, marginBottom: 10 }}>
          Facebook searched {observedArea}, not your requested {requestedArea}.
          Change the location in Facebook to match.
        </Text>
      )}

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
