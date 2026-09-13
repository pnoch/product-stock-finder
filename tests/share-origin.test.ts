import { describe, expect, it, afterEach } from "vitest";
import { getOrigin } from "../server/routers";

const OLD_WEB = process.env.EXPO_PUBLIC_WEB_URL;
const OLD_API = process.env.EXPO_PUBLIC_API_BASE_URL;

afterEach(() => {
  if (OLD_WEB === undefined) delete process.env.EXPO_PUBLIC_WEB_URL;
  else process.env.EXPO_PUBLIC_WEB_URL = OLD_WEB;
  if (OLD_API === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
  else process.env.EXPO_PUBLIC_API_BASE_URL = OLD_API;
});

describe("getOrigin", () => {
  it("prefers the configured web URL", () => {
    process.env.EXPO_PUBLIC_WEB_URL = "https://shop.example.com/";
    expect(getOrigin()).toBe("https://shop.example.com");
  });

  it("never trusts attacker-controlled Origin/Referer headers", () => {
    delete process.env.EXPO_PUBLIC_WEB_URL;
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
    expect(
      getOrigin({ headers: { origin: "https://evil-phish.example" } }),
    ).toBe("http://localhost:8081");
    expect(
      getOrigin({ headers: { referer: "https://evil-phish.example/x" } }),
    ).toBe("http://localhost:8081");
  });

  it("rejects non-http(s) configured values", () => {
    process.env.EXPO_PUBLIC_WEB_URL = "javascript:alert(1)";
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
    expect(getOrigin()).toBe("http://localhost:8081");
  });
});
