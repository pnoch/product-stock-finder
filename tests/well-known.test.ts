import { afterEach, describe, expect, it } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import {
  appleAppSiteAssociation,
  assetLinks,
  registerWellKnown,
} from "../server/spa";

async function serveWellKnown(): Promise<{
  base: string;
  close: () => Promise<void>;
}> {
  const app = express();
  registerWellKnown(app);
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  return {
    base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((e) => (e ? reject(e) : resolve())),
      ),
  };
}

describe("apple-app-site-association", () => {
  afterEach(() => {
    delete process.env.APPLE_TEAM_ID;
    delete process.env.ANDROID_SHA256_CERT_FINGERPRINTS;
  });

  it("is null without APPLE_TEAM_ID", () => {
    delete process.env.APPLE_TEAM_ID;
    expect(appleAppSiteAssociation()).toBeNull();
  });

  it("builds a valid document when configured", () => {
    process.env.APPLE_TEAM_ID = "TEAM123456";
    const doc = appleAppSiteAssociation() as {
      applinks: {
        details: Array<{
          appIDs: string[];
          components: Array<Record<string, string>>;
        }>;
      };
    };
    expect(doc.applinks.details[0]!.appIDs[0]).toBe(
      "TEAM123456.com.app.stocktrackerpro",
    );
    const paths = doc.applinks.details[0]!.components.map((c) => c["/"]);
    expect(paths).toContain("/product/*");
    expect(paths).toContain("/w/*");
  });

  it("builds assetlinks when fingerprints are configured", () => {
    process.env.ANDROID_SHA256_CERT_FINGERPRINTS = "AA:BB:CC, dd:ee:ff";
    const links = assetLinks() as Array<{
      target: { package_name: string; sha256_cert_fingerprints: string[] };
    }>;
    expect(links[0]!.target.package_name).toBe("com.app.stocktrackerpro");
    // Fingerprints are normalized to uppercase.
    expect(links[0]!.target.sha256_cert_fingerprints).toEqual([
      "AA:BB:CC",
      "DD:EE:FF",
    ]);
  });

  it("is null without fingerprints", () => {
    delete process.env.ANDROID_SHA256_CERT_FINGERPRINTS;
    expect(assetLinks()).toBeNull();
  });
});

describe("well-known routes", () => {
  afterEach(() => {
    delete process.env.APPLE_TEAM_ID;
    delete process.env.ANDROID_SHA256_CERT_FINGERPRINTS;
  });

  it("serves both documents when configured", async () => {
    process.env.APPLE_TEAM_ID = "TEAM123456";
    process.env.ANDROID_SHA256_CERT_FINGERPRINTS = "AA:BB:CC";
    const { base, close } = await serveWellKnown();
    try {
      const aasa = await fetch(`${base}/.well-known/apple-app-site-association`);
      expect(aasa.status).toBe(200);
      expect(aasa.headers.get("content-type")).toContain("application/json");
      const aasaBody = (await aasa.json()) as {
        applinks: { details: Array<{ appIDs: string[] }> };
      };
      expect(aasaBody.applinks.details[0]!.appIDs[0]).toContain(
        "com.app.stocktrackerpro",
      );

      const links = await fetch(`${base}/.well-known/assetlinks.json`);
      expect(links.status).toBe(200);
      const linksBody = (await links.json()) as Array<{
        target: { package_name: string };
      }>;
      expect(linksBody[0]!.target.package_name).toBe("com.app.stocktrackerpro");
    } finally {
      await close();
    }
  });

  it("404s when unconfigured", async () => {
    delete process.env.APPLE_TEAM_ID;
    delete process.env.ANDROID_SHA256_CERT_FINGERPRINTS;
    const { base, close } = await serveWellKnown();
    try {
      expect(
        (await fetch(`${base}/.well-known/apple-app-site-association`)).status,
      ).toBe(404);
      expect((await fetch(`${base}/.well-known/assetlinks.json`)).status).toBe(
        404,
      );
    } finally {
      await close();
    }
  });
});
