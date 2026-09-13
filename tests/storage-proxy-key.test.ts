import { describe, expect, it } from "vitest";
import { isValidStorageKey } from "../server/_core/storageProxy";

describe("isValidStorageKey", () => {
  it("accepts ordinary object keys", () => {
    expect(isValidStorageKey("avatars/u1/photo.png")).toBe(true);
    expect(isValidStorageKey("a")).toBe(true);
  });

  it("rejects traversal, absolute, scheme, and oversized keys", () => {
    expect(isValidStorageKey("../secret")).toBe(false);
    expect(isValidStorageKey("a/../../b")).toBe(false);
    expect(isValidStorageKey("/abs/path")).toBe(false);
    expect(isValidStorageKey("https://evil/x")).toBe(false);
    expect(isValidStorageKey("back\\slash")).toBe(false);
    expect(isValidStorageKey("")).toBe(false);
    expect(isValidStorageKey("x".repeat(513))).toBe(false);
    expect(isValidStorageKey("nul\0byte")).toBe(false);
  });
});
