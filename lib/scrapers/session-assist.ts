import type { DistributorParser } from "./types";

export function distributorHost(parser: DistributorParser): string {
  try {
    return new URL(parser.baseUrl).hostname;
  } catch {
    return parser.baseUrl;
  }
}

export function assistUrl(parser: DistributorParser): string {
  return parser.baseUrl;
}

// The unlock action is offered for a blocked distributor, or one that rendered
// but yielded no price (a likely login/consent wall). Other errors are not.
export function isAssistCandidate(
  status?: string | null,
  reason?: string | null,
): boolean {
  if (status === "blocked") return true;
  if (status === "error" && typeof reason === "string" && /no price found/i.test(reason)) {
    return true;
  }
  return false;
}

// Sign out of every distributor site by clearing all WebView cookies. The
// assist modal and the hidden fetch pool are both non-incognito, so the session
// IS the cookie jar. Best-effort — never throws.
export async function clearSiteData(): Promise<void> {
  try {
    const mod = await import("@react-native-cookies/cookies");
    await mod.default.clearAll();
  } catch {
    // Cookie manager unavailable (web / native module missing) — no-op.
  }
}
