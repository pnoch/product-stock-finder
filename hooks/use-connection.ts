import { useCallback, useEffect } from "react";
import { AppState, Platform } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { isServerConfigured } from "@/constants/oauth";
import { checkHealth } from "@/lib/health";
import { deriveConnectionStatus } from "@/lib/live-prices";

const REFETCH_INTERVAL_MS = 60_000;

export function useConnection() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const configured = isServerConfigured();
  const query = useQuery({
    queryKey: ["connection"],
    queryFn: checkHealth,
    // No server to poll in local mode: skip the query entirely so the app makes
    // no outbound health requests and reports "local" directly.
    enabled: configured,
    refetchInterval: configured ? REFETCH_INTERVAL_MS : false,
    retry: 1,
  });

  const refetch = useCallback(() => {
    void queryClient.refetchQueries({ queryKey: ["connection"] });
  }, [queryClient]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refetch();
    });
    return () => sub.remove();
  }, [refetch]);

  const reachable = query.data ?? false;
  const status = deriveConnectionStatus({
    reachable,
    isAuthenticated,
    configured,
  });

  return {
    status,
    reachable,
    isRefreshing: query.isFetching,
    lastCheckedAt: query.dataUpdatedAt || null,
    refetch,
  };
}
