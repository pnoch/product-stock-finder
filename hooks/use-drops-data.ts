import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import { createTRPCClient } from "@/lib/trpc";
import { getWatchlist } from "@/lib/storage";
import {
  buildDropShareText,
  computeLocalDrops,
  type DropSortBy,
  type DropWindow,
  type PriceDrop,
} from "@/lib/price-leaderboard";
import { shareText } from "@/lib/share-text";
import type { Product } from "@/lib/types";

const GLOBAL_CACHE_TTL_MS = 5 * 60 * 1000;
const globalCache = new Map<string, { at: number; data: PriceDrop[] }>();

export type DropsTab = "your" | "global";

export function useDropsData({
  window,
  sortBy,
  tab,
  setTab,
  isAuthenticated,
  displayCurrency,
  showToast,
}: {
  window: DropWindow;
  sortBy: DropSortBy;
  tab: DropsTab;
  setTab: (tab: DropsTab) => void;
  isAuthenticated: boolean;
  displayCurrency: string;
  showToast: (message: string, tone?: "info" | "error") => void;
}) {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [globalDrops, setGlobalDrops] = useState<PriceDrop[]>([]);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const failedKeysRef = useState(() => new Set<string>())[0];
  const [client] = useState(() => createTRPCClient());

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const load = async () => {
        try {
          const watchlist = await getWatchlist();
          if (!active) return;
          setProducts(watchlist);
        } catch {
          // storage read failure — keep existing state
        } finally {
          if (active) setLoaded(true);
        }
      };
      void load();
      return () => {
        active = false;
      };
    }, []),
  );

  useEffect(() => {
    if (tab !== "global" || !isAuthenticated) return;
    const key = `${window}:${sortBy}`;
    const cached = globalCache.get(key);
    let active = true;
    if (cached && Date.now() - cached.at < GLOBAL_CACHE_TTL_MS) {
      queueMicrotask(() => {
        if (active) setGlobalDrops(cached.data);
      });
      return () => {
        active = false;
      };
    }
    queueMicrotask(() => {
      if (active) setGlobalLoading(true);
    });
    client.prices.topDrops
      .query({ window, limit: 20, sortBy })
      .then((rows) => {
        if (!active) return;
        const drops = rows as PriceDrop[];
        globalCache.set(key, { at: Date.now(), data: drops });
        setGlobalDrops(drops);
      })
      .catch(() => {
        if (!active) return;
        setTab("your");
        if (!failedKeysRef.has(key)) {
          failedKeysRef.add(key);
          showToast("Couldn't load global drops — showing yours", "error");
        }
      })
      .finally(() => {
        if (active) setGlobalLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tab, isAuthenticated, window, sortBy, client, showToast, setTab, failedKeysRef]);

  const localDrops = useMemo(
    () => computeLocalDrops(products, window, displayCurrency, sortBy, 20),
    [products, window, displayCurrency, sortBy],
  );

  const watchlistIds = useMemo(
    () => new Set(products.map((p) => p.id)),
    [products],
  );

  const visibleDrops = tab === "your" ? localDrops : globalDrops;
  const loading = !loaded || (tab === "global" && globalLoading);

  const handleRowPress = useCallback(
    (drop: PriceDrop) => {
      if (Platform.OS !== "web") {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      if (watchlistIds.has(drop.productId)) {
        router.push(`/product/${drop.productId}`);
      } else {
        router.push("/search");
      }
    },
    [router, watchlistIds],
  );

  const handleShare = useCallback(async () => {
    if (Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (visibleDrops.length === 0) {
      showToast("Nothing to share yet", "info");
      return;
    }
    const result = await shareText(
      buildDropShareText(visibleDrops, window, sortBy),
      "Price Drops",
    );
    if (result === "copied") {
      showToast("Drops copied to your clipboard");
    } else if (result === "failed") {
      showToast("Sharing isn't supported in this browser", "error");
    }
  }, [visibleDrops, window, sortBy, showToast]);

  const selectTab = useCallback(
    (next: DropsTab) => {
      if (next === "global" && !isAuthenticated) return;
      if (Platform.OS !== "web") {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      setTab(next);
    },
    [isAuthenticated, setTab],
  );

  return {
    visibleDrops,
    loading,
    handleRowPress,
    handleShare,
    selectTab,
  };
}
