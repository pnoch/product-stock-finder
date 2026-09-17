import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { registerSpa } from "../spa";
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

  // Small default for every route; the sync mutation opts into a larger limit
  // on its own path below. A global 50mb limit let a handful of concurrent
  // unauthenticated POSTs to /api/auth/* inflate memory before any rate limit
  // (which runs inside the handler, after the body is buffered).
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
      res.status(503).json({
        ok: false,
        db: "error",
        error: e instanceof Error ? e.message : String(e),
        timestamp: Date.now(),
      });
    }
  });

  // Sync pushes can legitimately carry a few MB (bounded by SYNC_PUSH_MAX_ITEMS
  // × 100KB per item), so that path gets a larger body limit.
  app.use(
    "/api/trpc/sync.push",
    express.json({ limit: "10mb" }),
  );
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
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
    await closeDb().catch((e) => console.error("[Database] close failed", e));
    server.close(() => process.exit(0));
    const t = setTimeout(() => process.exit(1), 5000);
    (t as unknown as NodeJS.Timeout).unref?.();
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

startServer().catch((error) => {
  // Exit non-zero: a logged-and-swallowed startup failure previously exited 0,
  // which a platform could treat as a healthy deploy.
  console.error("[api] startup failed:", error);
  process.exit(1);
});
