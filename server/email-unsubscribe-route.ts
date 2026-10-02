import type { Express, Request } from "express";
import { checkRateLimitByKey } from "./rate-limit";

function clientIp(req: Request): string {
  return req.ip ?? req.socket?.remoteAddress ?? "unknown";
}

export function registerUnsubscribeRoute(app: Express): void {
  app.get("/api/email/unsubscribe", async (req, res) => {
    try {
      let allowed = true;
      try {
        checkRateLimitByKey(`email.unsubscribe:${clientIp(req)}`, 30, 60_000);
      } catch {
        allowed = false;
      }
      if (!allowed) {
        res.status(429).type("html").send("<h1>Too many requests</h1>");
        return;
      }
      const { verifyUnsubscribeToken, unsubscribeUser } = await import(
        "./notifications/email-alerts"
      );
      const userId = Number(req.query.u);
      const token = String(req.query.t ?? "");
      if (!verifyUnsubscribeToken(userId, token)) {
        res.status(400).type("html").send("<h1>Invalid link</h1>");
        return;
      }
      if (!(await unsubscribeUser(userId))) {
        res.status(500).type("html").send("<h1>Something went wrong</h1>");
        return;
      }
      res
        .status(200)
        .type("html")
        .send(
          "<h1>Unsubscribed</h1><p>You will no longer receive alert emails.</p>",
        );
    } catch (error) {
      console.error("[EmailUnsubscribe] failed", error);
      res.status(500).type("html").send("<h1>Something went wrong</h1>");
    }
  });
}
