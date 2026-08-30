import { TrendingProduct } from "@/lib/types";

function getApiBase(): string {
  return process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
}

const FALLBACK_TRENDING: TrendingProduct[] = [
  {
    id: "nvidia-dgx-spark",
    name: "NVIDIA DGX Spark",
    brand: "NVIDIA",
    category: "Server",
    estimatedPrice: 3000,
    currency: "USD",
    reason: "Enterprise AI dev kit with extreme demand, months-long backorder",
    source: "static",
    fetchedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  },
  {
    id: "nvidia-rtx-5090",
    name: "NVIDIA RTX 5090",
    brand: "NVIDIA",
    category: "GPU",
    estimatedPrice: 2000,
    currency: "USD",
    reason: "Flagship GPU sells out within minutes of restocking",
    source: "static",
    fetchedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  },
  {
    id: "nintendo-switch-2",
    name: "Nintendo Switch 2",
    brand: "Nintendo",
    category: "Gaming Console",
    estimatedPrice: 450,
    currency: "USD",
    reason: "Massive pre-order demand, retail stock limited",
    source: "static",
    fetchedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  },
  {
    id: "sony-ps5-pro",
    name: "Sony PlayStation 5 Pro",
    brand: "Sony",
    category: "Gaming Console",
    estimatedPrice: 700,
    currency: "USD",
    reason: "High demand console, often out of stock at major retailers",
    source: "static",
    fetchedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  },
  {
    id: "valve-steam-deck-oled",
    name: "Valve Steam Deck OLED",
    brand: "Valve",
    category: "Handheld Gaming",
    estimatedPrice: 649,
    currency: "USD",
    reason: "Back-order only, 4-6 week shipping estimates",
    source: "static",
    fetchedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  },
];

export async function fetchTrending(): Promise<TrendingProduct[]> {
  try {
    const res = await fetch(`${getApiBase()}/api/trending`);
    if (!res.ok) return FALLBACK_TRENDING;
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) return data;
    return FALLBACK_TRENDING;
  } catch {
    return FALLBACK_TRENDING;
  }
}
