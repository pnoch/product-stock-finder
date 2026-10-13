import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getMarketplaceConnectionsService,
  MARKETPLACE_SITES,
  MARKETPLACE_SITE_CONFIG,
  marketplaceHomeUrl,
  type FacebookSearchPreference,
  type MarketplaceSite,
  type Verification,
} from "@/lib/marketplace/connections";
import {
  clearMarketplaceSession,
  getMarketplaceOperationTracker,
  type MarketplaceClearResult,
} from "@/lib/marketplace/session-clear";

export interface MarketplaceConnectionView {
  site: MarketplaceSite;
  label: string;
  homeUrl: string;
  verification: Verification;
}

export interface UseMarketplaceConnectionsResult {
  loaded: boolean;
  connections: MarketplaceConnectionView[];
  preferences: FacebookSearchPreference;
  setPreferences(preference: FacebookSearchPreference): Promise<void>;
  beginVerification(site: MarketplaceSite): number;
  completeVerification(
    site: MarketplaceSite,
    generation: number,
    verification: Verification,
  ): Promise<void>;
  disconnect(site: MarketplaceSite): Promise<MarketplaceClearResult>;
}

function readVerifications(
  service: ReturnType<typeof getMarketplaceConnectionsService>,
): Record<MarketplaceSite, Verification> {
  return {
    facebook: service.current("facebook"),
    shopee: service.current("shopee"),
    lazada: service.current("lazada"),
  };
}

// Subscribes to the device-local connection service. It exposes only
// verification metadata and preferences; it never reads or holds cookie values.
export function useMarketplaceConnections(): UseMarketplaceConnectionsResult {
  const service = useMemo(() => getMarketplaceConnectionsService(), []);
  const [loaded, setLoaded] = useState(false);
  const [preferences, setPreferencesState] = useState<FacebookSearchPreference>(
    () => service.preferences(),
  );
  const [verifications, setVerifications] = useState<
    Record<MarketplaceSite, Verification>
  >(() => readVerifications(service));
  const mounted = useRef(true);

  const refresh = useCallback(() => {
    setPreferencesState(service.preferences());
    setVerifications(readVerifications(service));
  }, [service]);

  useEffect(() => {
    mounted.current = true;
    const unsubscribe = service.subscribe(() => {
      if (mounted.current) refresh();
    });
    let cancelled = false;
    void service.load().then(() => {
      if (cancelled || !mounted.current) return;
      refresh();
      setLoaded(true);
    });
    return () => {
      cancelled = true;
      mounted.current = false;
      unsubscribe();
    };
  }, [service, refresh]);

  const setPreferences = useCallback(
    async (preference: FacebookSearchPreference) => {
      await service.setPreferences(preference);
      if (mounted.current) refresh();
    },
    [service, refresh],
  );

  const beginVerification = useCallback(
    (site: MarketplaceSite) => service.beginVerification(site),
    [service],
  );

  const completeVerification = useCallback(
    async (
      site: MarketplaceSite,
      generation: number,
      verification: Verification,
    ) => {
      await service.complete(site, generation, verification);
      if (mounted.current) refresh();
    },
    [service, refresh],
  );

  const disconnect = useCallback(
    async (site: MarketplaceSite) => {
      const result = await clearMarketplaceSession(site, {
        connections: service,
        operations: getMarketplaceOperationTracker(),
      });
      if (mounted.current) refresh();
      return result;
    },
    [service, refresh],
  );

  const connections = useMemo<MarketplaceConnectionView[]>(
    () =>
      MARKETPLACE_SITES.map((site) => ({
        site,
        label: MARKETPLACE_SITE_CONFIG[site].label,
        homeUrl: marketplaceHomeUrl(site),
        verification: verifications[site],
      })),
    [verifications],
  );

  return {
    loaded,
    connections,
    preferences,
    setPreferences,
    beginVerification,
    completeVerification,
    disconnect,
  };
}
