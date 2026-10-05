import type { DistributorParser } from "./types";
import { getWebViewHost } from "./webview-host";
import { clearUnlocked, clearAllUnlocked, getUnlocked } from "./session-store";
import { PARSERS } from "./registry";

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

export async function clearDistributorSession(
  parser: DistributorParser,
): Promise<void> {
  const url = assistUrl(parser);
  try {
    const mod = await import("@react-native-cookies/cookies");
    const cookies = await mod.default.get(url);
    for (const cookie of Object.values(cookies)) {
      try {
        await mod.default.set(url, { ...cookie, expires: "1970-01-01T00:00:00.000Z" });
      } catch {
        // skip an individual cookie
      }
    }
  } catch {
    // cookie manager unavailable
  }
  try {
    await getWebViewHost()?.clearStorage(url);
  } catch {
    // no host mounted / clear failed
  }
  await clearUnlocked(parser.id);
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
  try {
    const unlocked = await getUnlocked();
    const host = getWebViewHost();
    if (host) {
      for (const id of Object.keys(unlocked)) {
        const parser = PARSERS.find((p) => p.id === id);
        if (parser) {
          try {
            await host.clearStorage(assistUrl(parser));
          } catch {
            // skip this origin
          }
        }
      }
    }
  } catch {
    // best-effort
  }
  await clearAllUnlocked();
}
