import { TrendingProduct } from "@/lib/types";

function getApiBase(): string {
  return process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
}

export async function fetchTrending(): Promise<TrendingProduct[]> {
  try {
    const res = await fetch(`${getApiBase()}/api/trending`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
