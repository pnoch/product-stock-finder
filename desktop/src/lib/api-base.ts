export function getApiBaseUrl(): string {
  return (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
}

export function getOAuthPortalUrl(): string {
  return (import.meta.env.VITE_OAUTH_PORTAL_URL ?? "").replace(/\/$/, "");
}

export function getAppId(): string {
  return import.meta.env.VITE_APP_ID ?? "";
}
