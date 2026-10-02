import type { Express, Request } from "express";
import { checkRateLimitByKey } from "./rate-limit";

function clientIp(req: Request): string {
  return (
    req.ip ??
    (req.socket && req.socket.remoteAddress) ??
    req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ??
    "unknown"
  );
}

export function registerUnsubscribeRoute(app: Express): void {
  app.get("/api/email/unsubscribe", async (req, res) => {
    checkRateLimitByKey(`email.unsubscribe:${clientIp(req)}`, 30, 60_000);
    const { verifyUnsubscribeToken, unsubscribeUser } = await import(
      "./notifications/email-alerts"
    );
    const userId = Number(req.query.u);
    const token = String(req.query.t ?? "");
    if (!verifyUnsubscribeToken(userId, token)) {
      res.status(400).type("html").send("<h1>Invalid link</h1>");
      return;
    }
    await unsubscribeUser(userId);
    res
      .status(200)
      .type("html")
      .send(
        "<h1>Unsubscribed</h1><p>You will no longer receive alert emails.</p>",
      );
  });
}
