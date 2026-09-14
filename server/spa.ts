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
    res.sendFile(path.join(webDist, "index.html"));
  });
  console.log(`[spa] serving web export from ${webDist}`);
  return true;
}
