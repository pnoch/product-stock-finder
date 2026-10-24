import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("health unlock action", () => {
  const src = readFileSync(path.join(process.cwd(), "app/health.tsx"), "utf8");
  const hook = readFileSync(
    path.join(process.cwd(), "hooks/use-health-screen.ts"),
    "utf8",
  );
  it("renders an unlock action for assist candidates and mounts the modal", () => {
    expect(src).toContain("isAssistCandidate(");
    expect(src).toContain("SessionAssistModal");
    expect(hook).toContain("testDistributor(");
    expect(src).toContain("Unlock ");
  });

  it("marks the distributor unlocked when the assist completes", () => {
    expect(hook).toContain("markUnlocked(");
  });
});
