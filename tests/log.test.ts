import { describe, expect, it } from "vitest";
import { LOG_ERROR } from "../lib/log";

describe("LOG_ERROR", () => {
  it("is a callable function", () => {
    expect(typeof LOG_ERROR).toBe("function");
  });
});
