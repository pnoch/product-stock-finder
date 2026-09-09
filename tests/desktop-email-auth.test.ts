import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop email auth", () => {
  it("signs in and registers via REST", async () => {
    const text = await readFile("desktop/src/hooks/use-auth.ts", "utf8");
    expect(text).toContain("signInWithEmail");
    expect(text).toContain("signUpWithEmail");
    expect(text).toContain("/api/auth/login");
    expect(text).toContain("/api/auth/register");
  });

  it("changes passwords and wires Account UI", async () => {
    const hooks = await readFile("desktop/src/hooks/use-auth.ts", "utf8");
    const settings = await readFile("desktop/src/pages/Settings.tsx", "utf8");
    expect(hooks).toContain("changePassword");
    expect(hooks).toContain("/api/auth/change-password");
    expect(settings).toContain("Create account");
    expect(settings).toContain("New passwords do not match");
  });
});
