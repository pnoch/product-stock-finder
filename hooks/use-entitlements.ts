import { useEffect, useState } from "react";
import {
  FREE_STATE,
  getEntitlementState,
  subscribeEntitlements,
  type EntitlementState,
} from "@/lib/entitlements";

/**
 * Reactive entitlement state. Defaults to free, re-reads when a provider
 * registers or changes, and updates after the provider resolves. Screens gate
 * on `isPro`.
 */
export function useEntitlements(): EntitlementState {
  const [state, setState] = useState<EntitlementState>(FREE_STATE);
  useEffect(() => {
    let cancelled = false;
    const read = () => {
      void getEntitlementState().then((s) => {
        if (!cancelled) setState(s);
      });
    };
    read();
    const unsubscribe = subscribeEntitlements(read);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);
  return state;
}
