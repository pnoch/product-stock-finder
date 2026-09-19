import { getApiBaseUrl } from "@/constants/oauth";

// App-owned legal/support URLs. These must resolve in production — the App
// Store and Play Store both require a reachable privacy-policy URL, and a dead
// support mailbox is a support dead-end.
//
// Override with EXPO_PUBLIC_PRIVACY_URL / EXPO_PUBLIC_SUPPORT_EMAIL. The
// defaults fall back to the deployed web host (which serves the SPA) rather
// than a domain that may not be registered.
const PRIVACY_URL_OVERRIDE = process.env.EXPO_PUBLIC_PRIVACY_URL;
const SUPPORT_EMAIL_OVERRIDE = process.env.EXPO_PUBLIC_SUPPORT_EMAIL;

function webBase(): string {
  const base =
    process.env.EXPO_PUBLIC_WEB_URL ?? process.env.EXPO_PUBLIC_API_BASE_URL ?? "";
  return base.replace(/\/$/, "");
}

export function getPrivacyPolicyUrl(): string {
  if (PRIVACY_URL_OVERRIDE) return PRIVACY_URL_OVERRIDE;
  const base = webBase() || getApiBaseUrl().replace(/\/$/, "");
  return base ? `${base}/privacy` : "";
}

export function getSupportEmail(): string {
  // `??` would accept an empty-string override and produce `mailto:`.
  return SUPPORT_EMAIL_OVERRIDE || "support@productstockfinder.savvylife.icu";
}

export function getSupportMailtoUrl(): string {
  return `mailto:${getSupportEmail()}`;
}
