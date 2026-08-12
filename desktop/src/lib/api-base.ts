export function getApiBaseUrl(): string {
  const base = import.meta.env.VITE_API_BASE_URL ?? "";
  return (base || "http://localhost:3000").replace(/\/$/, "");
}

export function getOAuthPortalUrl(): string {
  return (import.meta.env.VITE_OAUTH_PORTAL_URL ?? "").replace(/\/$/, "");
}

export function getAppId(): string {
  return import.meta.env.VITE_APP_ID ?? "";
}
