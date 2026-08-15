import { useCallback, useEffect } from "react";
import { AppState, Platform } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { checkHealth } from "@/lib/health";
import { deriveConnectionStatus } from "@/lib/live-prices";

const REFETCH_INTERVAL_MS = 60_000;

export function useConnection() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["connection"],
    queryFn: checkHealth,
    refetchInterval: REFETCH_INTERVAL_MS,
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
  const status = deriveConnectionStatus({ reachable, isAuthenticated });

  return {
    status,
    reachable,
    isRefreshing: query.isFetching,
    lastCheckedAt: query.dataUpdatedAt || null,
    refetch,
  };
}
