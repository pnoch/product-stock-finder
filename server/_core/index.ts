import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { registerSpa, registerWellKnown } from "../spa";
import { startWarmer } from "../prices";
import { closeDb } from "../db";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Trust first proxy (gateway/LB) so req.protocol/ip and
  // X-Forwarded-* are honored for Secure cookies + rate-limit IP.
  app.set("trust proxy", 1);

  // Enable CORS for all routes - only allow known frontend origins to support credentials
  const allowedOrigins = new Set(
    (process.env.CORS_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
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
      "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Device-Id",
    );

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // Sync pushes can legitimately carry a few MB (bounded by SYNC_PUSH_MAX_ITEMS
  // × ~100KB per item). This MUST be mounted BEFORE the global parser: Express
  // runs middleware in order, so a global 256kb parser would consume the stream
  // and 413 the request before the path-scoped parser is ever reached.
  app.use("/api/trpc/sync.push", express.json({ limit: "10mb" }));

  // Small default for every other route. A global 50mb limit let a handful of
  // concurrent unauthenticated POSTs to /api/auth/* inflate memory before any
  // rate limit (which runs inside the handler, after the body is buffered).
  app.use(express.json({ limit: "256kb" }));
  app.use(express.urlencoded({ limit: "256kb", extended: true }));

  registerStorageProxy(app);
  registerOAuthRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  app.get("/api/healthz", async (_req, res) => {
    try {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) {
        res.json({ ok: true, db: "not_configured", timestamp: Date.now() });
        return;
      }
      await db.execute("SELECT 1" as never);
      res.json({ ok: true, db: "ok", timestamp: Date.now() });
    } catch (e) {
      // Log the detail server-side; never return it. Driver errors can include
      // host/user/schema names to an unauthenticated caller.
      console.error("[healthz] db check failed:", e);
      res.status(503).json({
        ok: false,
        db: "error",
        timestamp: Date.now(),
      });
    }
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  // Universal-link / App-Link association documents. Served regardless of
  // whether a web export exists (they are API-adjacent, not part of the SPA).
  const wellKnown = registerWellKnown(app);
  console.log(
    `[well-known] apple-app-site-association: ${wellKnown.apple ? "served" : "not configured (APPLE_TEAM_ID unset)"}; assetlinks.json: ${wellKnown.android ? "served" : "not configured (ANDROID_SHA256_CERT_FINGERPRINTS unset)"}`,
  );

  // Same-origin web hosting: serves the `expo export` SPA (incl. /sw.js) when
  // a web export is present; API-only otherwise. Mounted after /api/* routes.
  registerSpa(app);

  const preferredPort = parseInt(process.env.PORT || "3000");
  // In production the platform routes to exactly one port; silently binding a
  // different one makes the health check fail with no clear cause. Fail fast.
  const port =
    process.env.NODE_ENV === "production"
      ? preferredPort
      : await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.on("error", (error: NodeJS.ErrnoException) => {
    console.error(`[api] failed to bind port ${port}:`, error.message);
    process.exit(1);
  });

  server.listen(port, () => {
    console.log(`[api] server listening on port ${port}`);
  });

  const stopWarmer = startWarmer();

  const shutdown = async (signal: string) => {
    console.log(`[api] ${signal} received, shutting down`);
    if (stopWarmer) stopWarmer();
    // Stop accepting connections and drain in-flight requests BEFORE closing
    // the pool: closing the pool first made requests in the drain window fail.
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      const t = setTimeout(resolve, 5000);
      (t as unknown as NodeJS.Timeout).unref?.();
    });
    await closeDb().catch((e) => console.error("[Database] close failed", e));
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  // A stray rejection/exception would otherwise take the process down with the
  // default handler and no log. Log always; exit non-zero on an uncaught
  // exception (state is unknown), stay up on an unhandled rejection.
  process.on("unhandledRejection", (reason) => {
    console.error("[api] unhandled rejection:", reason);
  });
  process.on("uncaughtException", (error) => {
    console.error("[api] uncaught exception:", error);
    process.exit(1);
  });
}

startServer().catch((error) => {
  // Exit non-zero: a logged-and-swallowed startup failure previously exited 0,
  // which a platform could treat as a healthy deploy.
  console.error("[api] startup failed:", error);
  process.exit(1);
});
