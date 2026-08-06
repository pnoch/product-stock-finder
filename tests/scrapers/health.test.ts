import { describe, it, expect } from "vitest";
import { classifyResult } from "@/lib/scrapers/health";

describe("classifyResult", () => {
  it("returns working when result has a price", () => {
    const result = { price: 100, currency: "USD", stockStatus: "in_stock" as const, url: "x" };
    expect(classifyResult("<html></html>", result)).toBe("working");
  });

  it("returns blocked when HTML contains 403 Forbidden", () => {
    expect(classifyResult("403 Forbidden", null)).toBe("blocked");
  });

  it("returns blocked when HTML contains Access Denied", () => {
    expect(classifyResult("Access Denied", null)).toBe("blocked");
  });

  it("returns blocked when HTML contains Cloudflare challenge", () => {
    expect(classifyResult("cf-browser-verification", null)).toBe("blocked");
  });

  it("returns error when result is null and no block detected", () => {
    expect(classifyResult("<html>no products</html>", null)).toBe("error");
  });

  it("returns error when an error is thrown", () => {
    expect(classifyResult("", null, new Error("connection refused"))).toBe("error");
  });

  it("returns blocked even when result has a price (blocked wins)", () => {
    const result = { price: 100, currency: "USD", stockStatus: "in_stock" as const, url: "x" };
    expect(classifyResult("Access Denied", result)).toBe("blocked");
  });
});
