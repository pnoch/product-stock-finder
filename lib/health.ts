import { getApiBaseUrl } from "@/constants/oauth";

const HEALTH_TIMEOUT_MS = 3000;

export async function checkHealth(): Promise<boolean> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) return false;
  try {
    const res = await Promise.race([
      fetch(`${baseUrl}/api/health`).catch(() => null),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), HEALTH_TIMEOUT_MS),
      ),
    ]);
    return res?.ok ?? false;
  } catch {
    return false;
  }
}
