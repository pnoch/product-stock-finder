import { describe, expect, it } from "vitest";
import { bumpSyncGeneration, currentSyncGeneration } from "../lib/sync-gate";

// The generation gate is what stops an in-flight sync from writing the previous
// account's rows (and its cursor) back after a logout wipe.
describe("sync generation gate", () => {
  it("only ever moves forward when bumped", () => {
    const before = currentSyncGeneration();
    bumpSyncGeneration();
    const after = currentSyncGeneration();
    expect(after).toBeGreaterThan(before);
    bumpSyncGeneration();
    expect(currentSyncGeneration()).toBeGreaterThan(after);
  });

  it("is stable between bumps (a sync captures and re-checks it)", () => {
    const captured = currentSyncGeneration();
    expect(currentSyncGeneration()).toBe(captured);
  });
});
