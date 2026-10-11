import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("desktop drops parity", () => {
  it("Drops page exists and exports Drops", () => {
    expect(read("src/pages/Drops.tsx")).toContain("Drops");
  });

  it("DropLeaderboard component exists", () => {
    expect(read("src/components/DropLeaderboard.tsx")).toContain("DropLeaderboard");
  });

  it("Sidebar has Drops entry", () => {
    expect(read("src/components/Sidebar.tsx")).toContain('"/drops"');
  });

  it("App registers /drops route", () => {
    expect(read("src/App.tsx")).toContain('/drops');
  });

  it("Home renders DropLeaderboard", () => {
    expect(read("src/pages/Home.tsx")).toContain("DropLeaderboard");
  });
});
