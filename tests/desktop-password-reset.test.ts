import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop password reset", () => {
  it("requests reset links from Settings", async () => {
    const text = await readFile(
      "desktop/src/hooks/use-email-auth.ts",
      "utf8",
    );
    const card = await readFile(
      "desktop/src/components/settings/SignedOutAccountCard.tsx",
      "utf8",
    );
    expect(text).toContain("/api/auth/forgot");
    expect(card).toContain("Send reset link");
  });

  it("completes reset from the email-link route", async () => {
    const app = await readFile("desktop/src/App.tsx", "utf8");
    const page = await readFile("desktop/src/pages/ResetPassword.tsx", "utf8");
    expect(app).toContain("/reset-password");
    expect(page).toContain("/api/auth/reset");
    expect(page).toContain("Passwords do not match");
  });
});
