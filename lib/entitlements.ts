// Provider-agnostic entitlement seam. The default is free; a real provider
// (RevenueCat) registers via setEntitlementProvider() at app boot. Mirrors the
// scraping-provider seam in lib/scrapers/resilient.ts.

export type EntitlementTier = "free" | "pro";

export interface EntitlementState {
  tier: EntitlementTier;
  isPro: boolean;
  /** ISO date when the subscription expires, if known. */
  expiresAt?: string;
}

export interface EntitlementProvider {
  getState(): Promise<EntitlementState>;
  /** Optional: start a purchase flow; resolves to the new state. */
  purchase?(planId: string): Promise<EntitlementState>;
  /** Optional: restore prior purchases. */
  restore?(): Promise<EntitlementState>;
}

export const FREE_STATE: EntitlementState = { tier: "free", isPro: false };

let provider: EntitlementProvider | null = null;

export function setEntitlementProvider(p: EntitlementProvider | null): void {
  provider = p;
}

export function getEntitlementProvider(): EntitlementProvider | null {
  return provider;
}

/** The current entitlement state. Fails closed to free on any provider error. */
export async function getEntitlementState(): Promise<EntitlementState> {
  if (!provider) return FREE_STATE;
  try {
    return await provider.getState();
  } catch {
    return FREE_STATE;
  }
}
