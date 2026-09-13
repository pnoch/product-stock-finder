import { describe, expect, it } from "vitest";

describe("desktop test setup globals", () => {
  it("defines the __DEV__ React Native global before test modules load", () => {
    expect((globalThis as Record<string, unknown>).__DEV__).toBe(true);
  });
});
