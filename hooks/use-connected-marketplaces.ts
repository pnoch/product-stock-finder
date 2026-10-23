import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
import {
  isMarketplaceUrlAllowed,
  MARKETPLACE_SITE_CONFIG,
  marketplaceHomeUrl,
  type MarketplaceSite,
  type ProbeCapability,
} from "@/lib/marketplace/connections";
import { buildFbSearchUrl, evaluateProbe, facebookListingReader, type ListingProbeReading } from "@/lib/marketplace/fb-search";
import { useMarketplaceConnections } from "@/hooks/use-marketplace-connections";
import { getWatchlist } from "@/lib/storage";
import { showAlert } from "@/lib/alert";
import { parseShopeePrice } from "@/lib/scrapers/shopee-th";
import { parseLazadaPrice } from "@/lib/scrapers/lazada-th";
import {
  getWebViewHost,
  type MarketplacePageSnapshot,
} from "@/lib/scrapers/webview-host";
import type { Product } from "@/lib/types";

const PROBE_TIMEOUT_MS = 25_000;
const MISSING_CONTEXT_GUIDANCE =
  "Open this screen from a product listing or a search result to verify access.";

export interface ProbePlan {
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

function parseSite(value: string | string[] | undefined): MarketplaceSite | null {
  const raw = firstParam(value);
  if (raw === "shopee" || raw === "lazada" || raw === "facebook") return raw;
  return null;
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

export function useConnectedMarketplaces() {
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
  const [fbSearchVisible, setFbSearchVisible] = useState(false);
  const [guidance, setGuidance] = useState<Partial<Record<MarketplaceSite, string>>>({});

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

  const orderedConnections = useMemo(() => {
    if (!siteParam) return connections;
    return [...connections].sort((a, b) => {
      if (a.site === siteParam) return -1;
      if (b.site === siteParam) return 1;
      return 0;
    });
  }, [connections, siteParam]);

  return {
    loaded,
    connections,
    orderedConnections,
    busySites,
    guidance,
    openPlan,
    setOpenPlan,
    fbSearchVisible,
    setFbSearchVisible,
    handleConnect,
    handleDone,
    handleCheckAgain,
    handleDisconnect,
  };
}
