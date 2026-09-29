import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

// Guards that credential-bearing files can never be committed. `.gitignore`
// previously listed only `.env` and `.env*.local`, so `.env.production` (and
// `.env.development`, `.env.staging`, `.env.test`) were committable — a real
// credential leak waiting to happen.
function isIgnored(path: string): boolean {
  try {
    execFileSync("git", ["check-ignore", "-q", path], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

describe(".gitignore credential coverage", () => {
  it("ignores every per-environment env file", () => {
    for (const f of [
      ".env",
      ".env.local",
      ".env.production",
      ".env.development",
      ".env.staging",
      ".env.test",
      ".env.production.local",
    ]) {
      expect(isIgnored(f), `${f} must be gitignored`).toBe(true);
    }
  });

  it("ignores Android/iOS signing material", () => {
    for (const f of [
      "credentials/release.keystore",
      "credentials/keystore.properties",
      "app/release.jks",
      "certs/key.p12",
      "certs/key.p8",
      "certs/key.pem",
    ]) {
      expect(isIgnored(f), `${f} must be gitignored`).toBe(true);
    }
  });

  it("does not ignore the committed env template", () => {
    // `.env.*` must not swallow the example file developers copy from.
    expect(isIgnored(".env.example")).toBe(false);
  });

  it("has no tracked .env file", () => {
    const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" })
      .split("\n")
      .filter((f) => /(^|\/)\.env(\.|$)/.test(f) && !f.endsWith(".example"));
    expect(tracked, `tracked env files: ${tracked.join(", ")}`).toEqual([]);
  });
});
