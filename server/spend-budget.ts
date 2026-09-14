// Process-wide spend guard for paid provider calls (LLM, image generation).
//
// Per-IP rate limits bound a single client, but a distributed caller rotating
// source addresses can still drive unbounded provider spend. These budgets cap
// total calls per rolling window across all clients on this instance. They are
// intentionally in-memory: the goal is a hard ceiling per process, and a
// multi-replica deploy multiplies the ceiling by replica count (documented in
// server/README.md). Callers degrade gracefully (return null / cached value)
// instead of erroring so a spent budget never breaks the UI.

const windows = new Map<string, number[]>();

export interface BudgetSpec {
  name: string;
  limit: number;
  windowMs: number;
}

function envLimit(name: string, fallback: number): number {
  const envKey = `SPEND_BUDGET_${name.replace(/[^a-zA-Z0-9]+/g, "_").toUpperCase()}`;
  const raw = process.env[envKey];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

// Defaults are deliberately generous relative to real traffic (insights and
// images are cached + single-flight, so only distinct products consume budget)
// while still capping a runaway loop well below provider rate limits.
export const BUDGETS = {
  "products.parse": { name: "products.parse", limit: envLimit("products.parse", 300), windowMs: 60 * 60 * 1000 },
  "insights.get": { name: "insights.get", limit: envLimit("insights.get", 300), windowMs: 60 * 60 * 1000 },
  "images.get": { name: "images.get", limit: envLimit("images.get", 200), windowMs: 60 * 60 * 1000 },
} as const satisfies Record<string, BudgetSpec>;

export type BudgetName = keyof typeof BUDGETS;

/**
 * Consumes one unit from the named budget. Returns false when the rolling
 * window is already at its limit (caller must degrade, not call the provider).
 */
export function tryConsumeBudget(
  name: BudgetName,
  now: number = Date.now(),
): boolean {
  const spec = BUDGETS[name];
  const windowStart = now - spec.windowMs;
  const timestamps = (windows.get(name) ?? []).filter((t) => t > windowStart);
  if (timestamps.length >= spec.limit) {
    windows.set(name, timestamps);
    return false;
  }
  timestamps.push(now);
  windows.set(name, timestamps);
  return true;
}

export function clearSpendBudgetsForTests(): void {
  windows.clear();
}
