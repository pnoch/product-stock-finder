import { describe, expect, it, vi, beforeEach } from "vitest";
import { byoLlmHeaders } from "../src/lib/trpc";
import { storage } from "../src/storage";

vi.mock("../src/storage", () => ({
  storage: { getSettings: vi.fn() },
}));

const getSettings = vi.mocked(storage.getSettings);

describe("byoLlmHeaders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends nothing for the built-in forge provider or unset settings", async () => {
    getSettings.mockResolvedValue({ llmProvider: "forge" } as never);
    expect(await byoLlmHeaders()).toEqual({});
    getSettings.mockResolvedValue({} as never);
    expect(await byoLlmHeaders()).toEqual({});
  });

  it("sends nothing when settings cannot be read", async () => {
    getSettings.mockRejectedValue(new Error("storage down"));
    expect(await byoLlmHeaders()).toEqual({});
  });

  it("forwards the configured provider fields", async () => {
    getSettings.mockResolvedValue({
      llmProvider: "openai",
      llmApiKey: "sk-1",
      llmModel: "gpt-4o-mini",
    } as never);
    expect(await byoLlmHeaders()).toEqual({
      "x-llm-provider": "openai",
      "x-llm-key": "sk-1",
      "x-llm-model": "gpt-4o-mini",
    });
  });

  it("includes the Ollama URL when configured", async () => {
    getSettings.mockResolvedValue({
      llmProvider: "ollama-local",
      llmOllamaUrl: "http://127.0.0.1:11434",
    } as never);
    expect(await byoLlmHeaders()).toEqual({
      "x-llm-provider": "ollama-local",
      "x-llm-url": "http://127.0.0.1:11434",
    });
  });
});
