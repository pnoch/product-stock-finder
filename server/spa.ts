import express, { type Express, type NextFunction, type Request, type Response } from "express";
import fs from "node:fs";
import path from "node:path";

export const WEB_DIST_DIRNAME = "dist-web";

export function resolveWebDist(): string {
  return path.resolve(process.env.WEB_DIST ?? WEB_DIST_DIRNAME);
}

export function hasWebDist(webDist = resolveWebDist()): boolean {
  try {
    return fs.statSync(path.join(webDist, "index.html")).isFile();
  } catch {
    return false;
  }
}

// index.html + sw.js must revalidate (fresh deploys change hashed bundles and
// the SW precache version); hashed /_expo/static/* bundles are immutable.
export function cacheControlFor(urlPath: string): string {
  if (urlPath === "/sw.js" || urlPath === "/index.html" || urlPath === "/") {
    return "no-store";
  }
  if (urlPath.startsWith("/_expo/static/")) {
    return "public, max-age=31536000, immutable";
  }
  return "no-cache";
}

// ─── Universal links / App Links ─────────────────────────────────────────────
// app.config.ts sets `associatedDomains: ["applinks:<host>"]` and an Android
// https intent filter with autoVerify, but the app only works if the server
// serves the two association documents. Without them the OS never verifies the
// domain and https links open the browser instead of the app.

// Read lazily (not at module load) so tests and late env injection work.
function appleTeamId(): string {
  return process.env.APPLE_TEAM_ID?.trim() ?? "";
}
function iosBundleId(): string {
  return process.env.IOS_BUNDLE_ID?.trim() ?? "com.app.stocktrackerpro";
}
function androidPackage(): string {
  return process.env.ANDROID_PACKAGE?.trim() ?? "com.app.stocktrackerpro";
}
// Comma-separated SHA-256 cert fingerprints (release + upload key). Required by
// Android for autoVerify; without it the intent filter is ignored.
function androidSha256Certs(): string[] {
  return (process.env.ANDROID_SHA256_CERT_FINGERPRINTS ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

// Paths the app can actually handle (see app/). Keep in sync with the router.
const UNIVERSAL_LINK_PATHS = [
  "/product/*",
  "/compare/*",
  "/w/*",
  "/stats",
  "/health",
  "/health/*",
  "/restock-watches",
  "/search",
  "/reset-password",
  "/verify-email",
  "/oauth/*",
];

export function appleAppSiteAssociation(): Record<string, unknown> | null {
  const teamId = appleTeamId();
  if (!teamId) return null;
  return {
    applinks: {
      details: [
        {
          appIDs: [`${teamId}.${iosBundleId()}`],
          components: UNIVERSAL_LINK_PATHS.map((p) => ({ "/": p })),
        },
      ],
    },
  };
}

export function assetLinks(): Array<Record<string, unknown>> | null {
  const certs = androidSha256Certs();
  if (certs.length === 0) return null;
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: androidPackage(),
        sha256_cert_fingerprints: certs,
      },
    },
  ];
}

/**
 * Registers the association documents. Returns which were served, so startup
 * can log a clear warning when universal links are only half-configured.
 */
export function registerWellKnown(app: Express): {
  apple: boolean;
  android: boolean;
} {
  const aasa = appleAppSiteAssociation();
  const links = assetLinks();
  app.get("/.well-known/apple-app-site-association", (_req, res) => {
    if (!aasa) {
      res.status(404).json({ error: "APPLE_TEAM_ID not configured" });
      return;
    }
    // Apple requires application/json (not application/json+something).
    res.type("application/json").send(JSON.stringify(aasa));
  });
  app.get("/.well-known/assetlinks.json", (_req, res) => {
    if (!links) {
      res.status(404).json({ error: "ANDROID_SHA256_CERT_FINGERPRINTS not configured" });
      return;
    }
    res.type("application/json").send(JSON.stringify(links));
  });
  return { apple: aasa !== null, android: links !== null };
}

export function registerSpa(app: Express, webDist = resolveWebDist()): boolean {
  if (!hasWebDist(webDist)) {
    console.log(`[spa] no web export at ${webDist} — serving API only`);
    return false;
  }
  app.use(
    express.static(webDist, {
      index: false,
      setHeaders: (res, filePath) => {
        res.setHeader(
          "Cache-Control",
          cacheControlFor(`/${path.relative(webDist, filePath)}`),
        );
      },
    }),
  );
  // SPA fallback: unknown GET paths serve index.html. API routes are mounted
  // before this runs, so a matched /api/* request never reaches here — but an
  // *unmatched* /api/* or /storage/* path must 404 as an API miss instead of
  // returning the HTML shell with 200 (which hides typos and breaks clients
  // that expect JSON errors).
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET") {
      next();
      return;
    }
    if (req.path.startsWith("/api/") || req.path.startsWith("/storage/")) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    // The shell must revalidate: `res.sendFile` bypasses express.static's
    // setHeaders, so without this the fallback served index.html with
    // `public, max-age=0` and a browser could retain a stale shell referencing
    // old hashed bundles after a deploy.
    res.setHeader("Cache-Control", cacheControlFor("/index.html"));
    res.sendFile(path.join(webDist, "index.html"));
  });
  console.log(`[spa] serving web export from ${webDist}`);
  return true;
}
