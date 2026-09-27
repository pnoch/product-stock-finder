import express, { type Express } from "express";

// Request-shape middleware, extracted from server/_core/index.ts so it is
// testable (the entry only wires it). These are exactly the pieces whose
// ordering and matching are security-relevant.

/**
 * CORS for allowlisted origins only (exact match; credentials are never granted
 * to an unknown origin). `allowedOrigins` is passed in so the entry keeps
 * reading its env once.
 */
export function registerCors(app: Express, allowedOrigins: Set<string>): void {
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.has(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Credentials", "true");
    }
    res.header(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS",
    );
    res.header(
      "Access-Control-Allow-Headers",
      // X-LLM-* carry the BYO-LLM config (lib/trpc.ts): without them the
      // browser's preflight blocks every discovery/insight/llm.test call from a
      // cross-origin client.
      "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Device-Id, X-LLM-Provider, X-LLM-Key, X-LLM-Model, X-LLM-Url",
    );

    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });
}

/**
 * Express's `trust proxy` value. Defaults to 1 (trust a single proxy hop), which
 * is right behind one gateway/LB: `req.ip` and `X-Forwarded-Proto` then come
 * from the hop the proxy added, so IP rate limits and the Secure-cookie decision
 * cannot be spoofed by a client. If the app is ever exposed directly, or sits
 * behind a longer chain, a hard-coded 1 is wrong in both directions — override
 * with `TRUST_PROXY`:
 *   - a number             → trust that many hops
 *   - "false" / "0"        → trust nothing (direct connections: a client-sent
 *                            X-Forwarded-For must not be believed)
 *   - "true"               → trust everything (only when never directly reachable)
 *   - IPs/CIDRs, comma-sep → trust exactly those proxies (the safest option)
 */
export function resolveTrustProxy(
  raw: string | undefined,
): boolean | number | string {
  const value = (raw ?? "").trim();
  if (!value) return 1;
  const lower = value.toLowerCase();
  if (lower === "false" || lower === "0") return false;
  if (lower === "true") return true;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

/**
 * Body parsers. The large limit is scoped to the sync.push procedure *exactly*:
 * `app.use(path, …)` is a prefix match, so mounting it on "/api/trpc/sync.push"
 * also granted unauthenticated 10 MB buffering to `/api/trpc/sync.pushX` — the
 * memory-amplification hole the 256 kb default exists to close. tRPC batches
 * procedures with commas (`sync.push,other`), hence the two accepted shapes.
 * Mounted before the default parser, which would otherwise consume the stream
 * and 413 a legitimate push.
 */
export function registerBodyParsers(app: Express): void {
  const syncPushJson = express.json({ limit: "10mb" });
  app.use((req, res, next) => {
    const path = (req.url ?? "").split("?")[0];
    if (
      path === "/api/trpc/sync.push" ||
      path.startsWith("/api/trpc/sync.push,")
    ) {
      syncPushJson(req, res, next);
      return;
    }
    next();
  });
  app.use(express.json({ limit: "256kb" }));
  app.use(express.urlencoded({ limit: "256kb", extended: true }));
}
