import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("expo-linking", () => ({ createURL: () => "x" }));

const g = globalThis as unknown as { __DEV__: boolean };

async function loadModule(apiBase: string | undefined, dev: boolean) {
  g.__DEV__ = dev;
  if (apiBase === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
  else process.env.EXPO_PUBLIC_API_BASE_URL = apiBase;
  vi.resetModules();
  return import("../constants/oauth");
}

afterEach(() => {
  g.__DEV__ = true;
  delete process.env.EXPO_PUBLIC_API_BASE_URL;
  vi.resetModules();
});

describe("standalone API base", () => {
  // A release build that baked in the dev `.env` loopback URL must run
  // local-only: on a device that URL is the device's own localhost, so treating
  // it as "configured" only produced failed server calls.
  it("ignores a loopback API base in release", async () => {
    const mod = await loadModule("http://localhost:3000", false);
    expect(mod.getApiBaseUrl()).toBe("");
    expect(mod.isServerConfigured()).toBe(false);
  });

  it("keeps a loopback API base in development (adb reverse / emulator)", async () => {
    const mod = await loadModule("http://localhost:3000", true);
    expect(mod.getApiBaseUrl()).toBe("http://localhost:3000");
    expect(mod.isServerConfigured()).toBe(true);
  });

  it("keeps the other loopback forms out of release too", async () => {
    for (const url of ["http://127.0.0.1:3000", "http://10.0.2.2:3000"]) {
      const mod = await loadModule(url, false);
      expect(mod.isServerConfigured()).toBe(false);
    }
  });

  it("keeps a real API base in release", async () => {
    const mod = await loadModule("https://api.example.com", false);
    expect(mod.getApiBaseUrl()).toBe("https://api.example.com");
    expect(mod.isServerConfigured()).toBe(true);
  });

  it("treats no API base as unconfigured", async () => {
    const mod = await loadModule(undefined, false);
    expect(mod.isServerConfigured()).toBe(false);
  });
});
