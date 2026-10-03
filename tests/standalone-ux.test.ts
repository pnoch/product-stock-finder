import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

// Standalone (no backend) UX: the app must explain "local mode" rather than
// imply an unreachable backend, and must not offer server-only actions.
describe("standalone / local-mode UX", () => {
  it("connection section explains local mode and disables Check Now", async () => {
    const src = await readFile(
      "components/settings/connection-section.tsx",
      "utf8",
    );
    expect(src).toContain("Local mode");
    expect(src).toContain('connection.status === "local"');
    expect(src).toMatch(/disabled=\{[^}]*connection\.status === "local"/);
  });

  it("does not poll health when no server is configured", async () => {
    const src = await readFile("hooks/use-connection.ts", "utf8");
    expect(src).toContain("enabled: configured");
  });

  it("offers a local-mode note instead of sign-in when unconfigured", async () => {
    const src = await readFile(
      "components/settings/account-section.tsx",
      "utf8",
    );
    expect(src).toContain("isServerConfigured");
    expect(src).toContain("configured ?");
    expect(src).toContain("Local mode");
  });

  it("makes the home connection badge tappable in local mode", async () => {
    const src = await readFile("app/(tabs)/index.tsx", "utf8");
    expect(src).toMatch(/connection\.status === "signed-out" \|\|\s*connection\.status === "local"/);
  });
});
