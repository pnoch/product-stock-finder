import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { useAuth } from "./use-auth";
import { getApiBaseUrl } from "../lib/api-base";
import { deriveConnectionStatus } from "../../../lib/live-prices";

const REFETCH_INTERVAL_MS = 60_000;
const HEALTH_TIMEOUT_MS = 3000;

async function checkHealth(): Promise<boolean> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) return false;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl}/api/health`, {
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

function isServerConfigured(): boolean {
  return getApiBaseUrl() !== "";
}

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
    const onFocus = () => refetch();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refetch]);

  const reachable = query.data ?? false;
  const status = deriveConnectionStatus({
    reachable,
    isAuthenticated,
    configured: isServerConfigured(),
  });

  return {
    status,
    reachable,
    isRefreshing: query.isFetching,
    lastCheckedAt: query.dataUpdatedAt || null,
    refetch,
  };
}
