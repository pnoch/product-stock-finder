import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { SessionAssistModal } from "@/components/session-assist-modal";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useMarketplaceConnections } from "@/hooks/use-marketplace-connections";
import { goBackOrHome } from "@/lib/navigation";
import { showAlert } from "@/lib/alert";
import { getWatchlist } from "@/lib/storage";
import type { Product } from "@/lib/types";
import {
  isMarketplaceUrlAllowed,
  MARKETPLACE_SITES,
  MARKETPLACE_SITE_CONFIG,
  marketplaceHomeUrl,
  type MarketplaceSite,
  type ProbeCapability,
  type Verification,
} from "@/lib/marketplace/connections";
import {
  buildFbSearchUrl,
  evaluateProbe,
  facebookListingReader,
  type ListingProbeReading,
} from "@/lib/marketplace/fb-search";
import { parseShopeePrice } from "@/lib/scrapers/shopee-th";
import { parseLazadaPrice } from "@/lib/scrapers/lazada-th";
import {
  getWebViewHost,
  type MarketplacePageSnapshot,
} from "@/lib/scrapers/webview-host";

const PROBE_TIMEOUT_MS = 25_000;
const MISSING_CONTEXT_GUIDANCE =
  "We couldn't verify this marketplace yet. Open one of your tracked listings and tap Reconnect, or enter a search query in Facebook search and connect from there.";

interface ProbePlan {
  site: MarketplaceSite;
  capability: ProbeCapability;
  url: string;
  product?: Product;
  canVerify: boolean;
}

function firstParam(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
}

function parseSite(
  value: string | string[] | undefined,
): MarketplaceSite | null {
  const raw = firstParam(value);
  return raw && (MARKETPLACE_SITES as readonly string[]).includes(raw)
    ? (raw as MarketplaceSite)
    : null;
}

function capabilityLabel(capability: ProbeCapability): string {
  switch (capability.kind) {
    case "search":
      return `Search “${capability.query}”`;
    case "listing":
      return "Tracked listing";
    case "navigation":
      return "Page navigation";
  }
}

function statusLabel(verification: Verification): string {
  switch (verification.kind) {
    case "not_checked":
      return "Not checked";
    case "checking":
      return "Checking…";
    case "ready":
      return `Ready to check · ${capabilityLabel(verification.capability)}`;
    case "login_required":
      return "Sign-in required";
    case "unverified":
      return "Couldn't verify";
    case "unavailable":
      return "Unavailable on this platform";
  }
}

function verificationTime(verification: Verification): string | null {
  if (
    verification.kind === "ready" ||
    verification.kind === "login_required" ||
    verification.kind === "unverified"
  ) {
    return new Date(verification.checkedAt).toLocaleString();
  }
  return null;
}

function statusColor(verification: Verification, colors: ReturnType<typeof useColors>): string {
  switch (verification.kind) {
    case "ready":
      return colors.success;
    case "checking":
      return colors.muted;
    case "login_required":
      return colors.warning;
    case "unverified":
      return colors.warning;
    case "unavailable":
      return colors.muted;
    case "not_checked":
      return colors.muted;
  }
}

function listingReaderFor(
  plan: ProbePlan,
): ((snapshot: MarketplacePageSnapshot) => ListingProbeReading) | undefined {
  const marketplace = plan.product?.marketplace;
  if (!marketplace) return undefined;
  if (marketplace.platform === "shopee") {
    return (snapshot) => {
      const found = parseShopeePrice(
        snapshot.html,
        marketplace.shopId,
        marketplace.itemId,
      );
      return { identityMatched: found != null, price: found?.price ?? null };
    };
  }
  if (marketplace.platform === "lazada") {
    return (snapshot) => {
      const found = parseLazadaPrice(
        snapshot.html,
        marketplace.itemId,
        marketplace.skuId,
      );
      return { identityMatched: found != null, price: found?.price ?? null };
    };
  }
  return facebookListingReader(marketplace.itemId);
}

export default function ConnectedMarketplacesScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{
    site?: string | string[];
    productId?: string | string[];
    keyword?: string | string[];
  }>();
  const siteParam = parseSite(params.site);
  const productIdParam = firstParam(params.productId);
  const keywordParam = firstParam(params.keyword);

  const {
    loaded,
    connections,
    preferences,
    beginVerification,
    completeVerification,
    disconnect,
  } = useMarketplaceConnections();

  const [products, setProducts] = useState<Product[]>([]);
  const [openPlan, setOpenPlan] = useState<ProbePlan | null>(null);
  const [disconnecting, setDisconnecting] = useState<MarketplaceSite[]>([]);
  const [guidance, setGuidance] = useState<
    Partial<Record<MarketplaceSite, string>>
  >({});

  useEffect(() => {
    let active = true;
    void getWatchlist()
      .then((list) => {
        if (active) setProducts(list);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const resolvePlan = useCallback(
    (site: MarketplaceSite): ProbePlan => {
      const product = productIdParam
        ? products.find((item) => item.id === productIdParam)
        : undefined;
      if (site === "facebook" && keywordParam) {
        return {
          site,
          capability: { kind: "search", query: keywordParam },
          url: buildFbSearchUrl({
            query: keywordParam,
            location: preferences.requestedArea,
            radiusKm: preferences.requestedRadiusKm,
          }),
          canVerify: true,
        };
      }
      if (product?.marketplace?.platform === site) {
        const canonical = product.marketplace.canonicalUrl;
        return {
          site,
          capability: { kind: "listing", productId: product.id },
          // The listing URL comes from the provider builder that produced it at
          // import time, never from an arbitrary user-supplied destination.
          url: isMarketplaceUrlAllowed(site, canonical)
            ? canonical
            : marketplaceHomeUrl(site),
          product,
          canVerify: true,
        };
      }
      return {
        site,
        capability: { kind: "navigation" },
        url: marketplaceHomeUrl(site),
        canVerify: false,
      };
    },
    [products, productIdParam, keywordParam, preferences],
  );

  const runVerification = useCallback(
    async (plan: ProbePlan) => {
      setGuidance((prev) => ({ ...prev, [plan.site]: undefined }));
      const generation = beginVerification(plan.site);
      if (!plan.canVerify) {
        setGuidance((prev) => ({
          ...prev,
          [plan.site]: MISSING_CONTEXT_GUIDANCE,
        }));
        await completeVerification(plan.site, generation, {
          kind: "unverified",
          checkedAt: new Date().toISOString(),
          reason: "missing-context",
        });
        return;
      }
      const host = getWebViewHost();
      if (!host?.snapshot) {
        await completeVerification(plan.site, generation, {
          kind: "unavailable",
        });
        return;
      }
      let snapshot: MarketplacePageSnapshot;
      try {
        snapshot = await host.snapshot(plan.url, { timeoutMs: PROBE_TIMEOUT_MS });
      } catch {
        await completeVerification(plan.site, generation, {
          kind: "unverified",
          checkedAt: new Date().toISOString(),
          reason: "network",
        });
        return;
      }
      const verification = evaluateProbe({
        capability: plan.capability,
        snapshot,
        hostAllowed: (url) => isMarketplaceUrlAllowed(plan.site, url),
        readListing: listingReaderFor(plan),
      });
      await completeVerification(plan.site, generation, verification);
    },
    [beginVerification, completeVerification],
  );

  const handleConnect = useCallback(
    (site: MarketplaceSite) => {
      if (Platform.OS !== "web") {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      setOpenPlan(resolvePlan(site));
    },
    [resolvePlan],
  );

  const handleDone = useCallback(() => {
    const plan = openPlan;
    setOpenPlan(null);
    if (!plan) return;
    void runVerification(plan);
  }, [openPlan, runVerification]);

  const handleCheckAgain = useCallback(
    (site: MarketplaceSite) => {
      if (Platform.OS !== "web") {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      void runVerification(resolvePlan(site));
    },
    [resolvePlan, runVerification],
  );

  const handleDisconnect = useCallback(
    async (site: MarketplaceSite) => {
      setDisconnecting((prev) => [...prev, site]);
      try {
        const result = await disconnect(site);
        if (result.outcome === "complete") {
          showAlert(
            `${MARKETPLACE_SITE_CONFIG[site].label} disconnected`,
            "This marketplace's session was cleared. Sign-in is required again.",
          );
        } else {
          showAlert(
            `${MARKETPLACE_SITE_CONFIG[site].label} not fully disconnected`,
            result.reason ?? undefined,
          );
        }
      } catch {
        showAlert(
          "Disconnect failed",
          "This marketplace's session could not be cleared. Try again.",
        );
      } finally {
        setDisconnecting((prev) => prev.filter((item) => item !== site));
      }
    },
    [disconnect],
  );

  const busySites = useMemo(() => {
    const set = new Set<MarketplaceSite>(disconnecting);
    for (const connection of connections) {
      if (connection.verification.kind === "checking") set.add(connection.site);
    }
    return set;
  }, [connections, disconnecting]);

  // The link that opened this screen carries the site to work on; surface it
  // first so a Connect from a listing or search lands on the right card.
  const orderedConnections = useMemo(() => {
    if (!siteParam) return connections;
    return [...connections].sort((a, b) => {
      if (a.site === siteParam) return -1;
      if (b.site === siteParam) return 1;
      return 0;
    });
  }, [connections, siteParam]);

  return (
    <ScreenContainer>
      <View style={{ flexDirection: "row", alignItems: "center", padding: 16 }}>
        <TouchableOpacity
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={() => {
            if (Platform.OS !== "web") {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            goBackOrHome(router);
          }}
          hitSlop={12}
          style={{ marginRight: 12 }}
        >
          <Text style={{ color: colors.primary, fontSize: 16 }}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "700" }}>
          Connected marketplaces
        </Text>
      </View>

      <Text
        style={{
          color: colors.muted,
          fontSize: 13,
          paddingHorizontal: 16,
          paddingBottom: 12,
        }}
      >
        Connect a marketplace in the app browser so its signed-in session is
        available to checks. Closing the browser cancels. Tapping Done starts a
        page-access check.
      </Text>

      {!loaded ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 40 }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
          {orderedConnections.map((connection) => {
            const { site, label, verification } = connection;
            const busy = busySites.has(site);
            const canDisconnect = verification.kind !== "not_checked";
            const note = guidance[site];
            return (
              <View
                key={site}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 16,
                  marginBottom: 12,
                  gap: 10,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <IconSymbol name="globe" size={20} color={colors.primary} />
                  <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 16, flex: 1 }}>
                    {label}
                  </Text>
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: statusColor(verification, colors),
                    }}
                  />
                </View>

                <Text style={{ color: colors.foreground, fontSize: 14 }}>
                  {statusLabel(verification)}
                </Text>
                {verificationTime(verification) && (
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    Last verified {verificationTime(verification)}
                  </Text>
                )}
                {verification.kind === "unverified" && (
                  <Text style={{ color: colors.warning, fontSize: 12 }}>
                    {verification.reason === "missing-context"
                      ? MISSING_CONTEXT_GUIDANCE
                      : `Reason: ${verification.reason}`}
                  </Text>
                )}

                {note && (
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{note}</Text>
                )}

                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 }}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`${verification.kind === "ready" ? "Reconnect" : "Connect"} ${label}`}
                    accessibilityState={{ disabled: busy }}
                    disabled={busy}
                    onPress={() => handleConnect(site)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 999,
                      backgroundColor: colors.primary,
                      opacity: busy ? 0.5 : 1,
                    }}
                  >
                    <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>
                      {verification.kind === "ready" ? "Reconnect" : "Connect"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`Check ${label} again`}
                    accessibilityState={{ disabled: busy }}
                    disabled={busy}
                    onPress={() => handleCheckAgain(site)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: colors.border,
                      opacity: busy ? 0.5 : 1,
                    }}
                  >
                    <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>
                      {verification.kind === "checking" ? "Checking…" : "Check again"}
                    </Text>
                  </TouchableOpacity>

                  {verification.kind === "unverified" && (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={`Retry ${label}`}
                      accessibilityState={{ disabled: busy }}
                      disabled={busy}
                      onPress={() => handleCheckAgain(site)}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: colors.primary,
                        opacity: busy ? 0.5 : 1,
                      }}
                    >
                      <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "700" }}>
                        Retry
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`Disconnect ${label}`}
                    accessibilityState={{ disabled: busy || !canDisconnect }}
                    disabled={busy || !canDisconnect}
                    onPress={() => void handleDisconnect(site)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: colors.error,
                      opacity: busy || !canDisconnect ? 0.5 : 1,
                    }}
                  >
                    <Text style={{ color: colors.error, fontSize: 13, fontWeight: "600" }}>
                      Disconnect
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {openPlan && (
        <SessionAssistModal
          visible
          url={openPlan.url}
          title={MARKETPLACE_SITE_CONFIG[openPlan.site].label}
          allowNavigation={(url) => isMarketplaceUrlAllowed(openPlan.site, url)}
          onClose={() => setOpenPlan(null)}
          onDone={handleDone}
        />
      )}
    </ScreenContainer>
  );
}
