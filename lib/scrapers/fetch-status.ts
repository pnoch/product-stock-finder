import type { FetchStatus } from "./fetch-types";

// Markers of an actual block page. These must be specific: a bare
// "challenge-platform" appears as a benign Cloudflare script tag on normal
// pages, and a bare "captcha" matches reCAPTCHA site keys embedded in app
// config — both caused healthy pages to be classified as blocked.
export const BLOCKED_MARKERS = [
  "403 Forbidden",
  "Access Denied",
  "cf-browser-verification",
  "Checking your browser",
  // Cloudflare interstitial / Turnstile
  "Just a moment",
  "Attention Required",
  "/cdn-cgi/challenge-platform/scripts/jsd/main.js",
  // PerimeterX / DataDome
  "px-captcha",
  "captcha-delivery.com",
  // Shopee TH login wall (browser-first shopee-th parser)
  "ต้องเข้าสู่ระบบ",
  "verify/traffic",
  "is_logged_in=false",
];

export function classifyFetchStatus(
  html: string,
  httpStatus?: number,
): FetchStatus {
  if (httpStatus === 403 || httpStatus === 429) return "blocked";
  if (httpStatus !== undefined && httpStatus >= 400) return "error";
  if (BLOCKED_MARKERS.some((marker) => html.includes(marker))) return "blocked";
  return "ok";
}
