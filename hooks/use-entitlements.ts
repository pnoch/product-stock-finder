import { useEffect, useState } from "react";
import {
  FREE_STATE,
  getEntitlementState,
  type EntitlementState,
} from "@/lib/entitlements";

/**
 * Reactive entitlement state. Defaults to free and updates after the provider
 * resolves. Screens gate on `isPro`.
 */
export function useEntitlements(): EntitlementState {
  const [state, setState] = useState<EntitlementState>(FREE_STATE);
  useEffect(() => {
    let cancelled = false;
    void getEntitlementState().then((s) => {
      if (!cancelled) setState(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}
