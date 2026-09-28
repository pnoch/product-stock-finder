import { describe, expect, it } from "vitest";
import {
  applyLocalLlmKey,
  stripDeviceLocalSettings,
} from "../lib/settings-privacy";
import type { AppSettings } from "../lib/types";

const base: AppSettings = {
  theme: "dark",
  displayCurrency: "EUR",
  checkInterval: "daily",
  notificationsEnabled: true,
  stockAlerts: true,
  priceAlerts: true,
  healthAlerts: true,
};

describe("stripDeviceLocalSettings", () => {
  it("removes the BYO-LLM key and keeps everything else", () => {
    const stripped = stripDeviceLocalSettings({
      ...base,
      llmApiKey: "sk-secret",
      llmProvider: "openai",
    });
    // The key must never leave the device (sync push, backup, export).
    expect(stripped.llmApiKey).toBeUndefined();
    expect(stripped.llmProvider).toBe("openai");
    expect(stripped.displayCurrency).toBe("EUR");
  });

  it("does not mutate the input", () => {
    const input = { ...base, llmApiKey: "sk-secret" };
    stripDeviceLocalSettings(input);
    expect(input.llmApiKey).toBe("sk-secret");
  });

  it("is a no-op when there is no key", () => {
    expect(stripDeviceLocalSettings({ ...base })).toEqual(base);
  });
});

describe("applyLocalLlmKey", () => {
  it("keeps this device's own key on an inbound merge", () => {
    const merged = applyLocalLlmKey(
      { ...base },
      { ...base, llmApiKey: "sk-local" },
    );
    // A remote row must never overwrite the local key with nothing.
    expect(merged.llmApiKey).toBe("sk-local");
  });

  it("never adopts a remote key", () => {
    const merged = applyLocalLlmKey(
      { ...base, llmApiKey: "sk-remote" },
      { ...base },
    );
    // The device has no key: the incoming one must be dropped, not adopted.
    expect(merged.llmApiKey).toBeUndefined();
  });

  it("drops a remote key when the local device removed its own", () => {
    const merged = applyLocalLlmKey(
      { ...base, llmApiKey: "sk-remote" },
      { ...base, llmApiKey: undefined },
    );
    expect(merged.llmApiKey).toBeUndefined();
  });
});
