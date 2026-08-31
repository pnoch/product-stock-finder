import { getApiBaseUrl } from "@/constants/oauth";

const HEALTH_TIMEOUT_MS = 3000;

export async function checkHealth(): Promise<boolean> {
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
