import type { Express, NextFunction, Request, Response } from "express";

/**
 * Every `/api` response is per-session and time-sensitive — prices, alerts,
 * notifications, auth, sync. Without an explicit header a browser may
 * heuristically cache a 200 GET (tRPC queries are GETs), so a refresh could
 * serve a stale price or alert. The static shell sets its own headers in
 * `server/spa.ts`; this covers the API surface, which `registerSpa` never sees
 * (it is mounted after the API routes).
 */
export function apiNoStore(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  res.setHeader("Cache-Control", "no-store");
  next();
}

export function registerApiNoStore(app: Express): void {
  app.use("/api", apiNoStore);
}
