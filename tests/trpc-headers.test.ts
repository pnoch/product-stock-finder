import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  getSessionToken: vi.fn(),
  getDeviceId: vi.fn(),
}));

vi.mock("../lib/storage", () => ({ getSettings: mocks.getSettings }));
vi.mock("../lib/_core/auth", () => ({
  getSessionToken: mocks.getSessionToken,
}));
vi.mock("../lib/device-id", () => ({ getDeviceId: mocks.getDeviceId }));
vi.mock("../lib/device-revoked", () => ({ handleDeviceRevoked: vi.fn() }));
vi.mock("../lib/background-safe-timers", () => ({
  getBackgroundAppState: () => "active",
}));
vi.mock("../lib/background-fetch", () => ({ backgroundFetch: vi.fn() }));
vi.mock("../constants/oauth", () => ({ getApiBaseUrl: () => "https://api.test" }));

import { byoLlmHeaders, trpcHeaders } from "../lib/trpc";

describe("byoLlmHeaders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends nothing for the built-in Forge provider", async () => {
    mocks.getSettings.mockResolvedValue({ llmProvider: "forge" });
    expect(await byoLlmHeaders()).toEqual({});
  });

  it("sends nothing for an unrecognized provider value", async () => {
    // The value comes from persisted/imported settings, so it is not guaranteed
    // to be one of the union — an unknown provider must not be forwarded.
    mocks.getSettings.mockResolvedValue({ llmProvider: "evil-provider" });
    expect(await byoLlmHeaders()).toEqual({});
  });

  it("forwards the provider config, omitting absent fields", async () => {
    mocks.getSettings.mockResolvedValue({
      llmProvider: "openai",
      llmApiKey: "sk-1",
      llmModel: "gpt-4o",
    });
    expect(await byoLlmHeaders()).toEqual({
      "x-llm-provider": "openai",
      "x-llm-key": "sk-1",
      "x-llm-model": "gpt-4o",
    });
  });

  it("forwards the ollama-local URL", async () => {
    mocks.getSettings.mockResolvedValue({
      llmProvider: "ollama-local",
      llmOllamaUrl: "http://localhost:11434",
    });
    expect(await byoLlmHeaders()).toEqual({
      "x-llm-provider": "ollama-local",
      "x-llm-url": "http://localhost:11434",
    });
  });

  it("returns nothing when settings are unreadable", async () => {
    mocks.getSettings.mockRejectedValue(new Error("storage down"));
    expect(await byoLlmHeaders()).toEqual({});
  });
});

describe("trpcHeaders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSettings.mockResolvedValue({ llmProvider: "forge" });
  });

  it("carries the session token and device id", async () => {
    mocks.getSessionToken.mockResolvedValue("tok-1");
    mocks.getDeviceId.mockResolvedValue("dev-1");
    expect(await trpcHeaders()).toEqual({
      Authorization: "Bearer tok-1",
      "x-device-id": "dev-1",
    });
  });

  it("omits the token when signed out and survives a device-id failure", async () => {
    mocks.getSessionToken.mockResolvedValue(null);
    // A device-id failure must not reject header construction for every request.
    mocks.getDeviceId.mockRejectedValue(new Error("no id"));
    expect(await trpcHeaders()).toEqual({});
  });

  it("merges the BYO-LLM headers", async () => {
    mocks.getSessionToken.mockResolvedValue("tok-1");
    mocks.getDeviceId.mockResolvedValue("dev-1");
    mocks.getSettings.mockResolvedValue({
      llmProvider: "openai",
      llmApiKey: "sk-1",
    });
    expect(await trpcHeaders()).toEqual({
      Authorization: "Bearer tok-1",
      "x-device-id": "dev-1",
      "x-llm-provider": "openai",
      "x-llm-key": "sk-1",
    });
  });
});
