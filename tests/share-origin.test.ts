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

  it("derives the origin from the API base URL and remaps port 3000", () => {
    delete process.env.EXPO_PUBLIC_WEB_URL;
    process.env.EXPO_PUBLIC_API_BASE_URL = "http://api.example.com:3000/api";
    expect(getOrigin()).toBe("http://api.example.com:8081");
  });

  it("keeps a non-3000 API port and strips the path", () => {
    delete process.env.EXPO_PUBLIC_WEB_URL;
    process.env.EXPO_PUBLIC_API_BASE_URL = "https://api.example.com:8443/trpc";
    expect(getOrigin()).toBe("https://api.example.com:8443");
  });

  it("falls back to localhost for an unparseable API base URL", () => {
    delete process.env.EXPO_PUBLIC_WEB_URL;
    process.env.EXPO_PUBLIC_API_BASE_URL = "not a url";
    expect(getOrigin()).toBe("http://localhost:8081");
  });

  it("falls back to localhost for a non-http API base URL", () => {
    delete process.env.EXPO_PUBLIC_WEB_URL;
    process.env.EXPO_PUBLIC_API_BASE_URL = "ftp://api.example.com";
    expect(getOrigin()).toBe("http://localhost:8081");
  });
});
