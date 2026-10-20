import { useCallback, useEffect, useState } from "react";
import type { AppSettings } from "../../../../lib/types";

export function LlmSettingsSection({
  settings,
  update,
  showToast,
}: {
  settings: AppSettings;
  update: (partial: Partial<AppSettings>) => Promise<void> | void;
  showToast: (message: string) => void;
}) {
  const [draftLlmApiKey, setDraftLlmApiKey] = useState(settings.llmApiKey ?? "");
  const [draftLlmModel, setDraftLlmModel] = useState(settings.llmModel ?? "");
  const [draftLlmOllamaUrl, setDraftLlmOllamaUrl] = useState(
    settings.llmOllamaUrl ?? "",
  );
  const [testingLlm, setTestingLlm] = useState(false);
  const [showLlmApiKey, setShowLlmApiKey] = useState(false);

  const [prevLlm, setPrevLlm] = useState({
    apiKey: settings.llmApiKey,
    model: settings.llmModel,
    ollamaUrl: settings.llmOllamaUrl,
  });
  if (
    settings.llmApiKey !== prevLlm.apiKey ||
    settings.llmModel !== prevLlm.model ||
    settings.llmOllamaUrl !== prevLlm.ollamaUrl
  ) {
    setPrevLlm({
      apiKey: settings.llmApiKey,
      model: settings.llmModel,
      ollamaUrl: settings.llmOllamaUrl,
    });
    setDraftLlmApiKey(settings.llmApiKey ?? "");
    setDraftLlmModel(settings.llmModel ?? "");
    setDraftLlmOllamaUrl(settings.llmOllamaUrl ?? "");
  }

  useEffect(() => {
    if (draftLlmApiKey === (settings.llmApiKey ?? "")) return;
    const t = setTimeout(() => {
      void update({ llmApiKey: draftLlmApiKey });
    }, 500);
    return () => clearTimeout(t);
  }, [draftLlmApiKey, settings.llmApiKey, update]);
  useEffect(() => {
    if (draftLlmModel === (settings.llmModel ?? "")) return;
    const t = setTimeout(() => {
      void update({ llmModel: draftLlmModel });
    }, 500);
    return () => clearTimeout(t);
  }, [draftLlmModel, settings.llmModel, update]);
  useEffect(() => {
    if (draftLlmOllamaUrl === (settings.llmOllamaUrl ?? "")) return;
    const t = setTimeout(() => {
      void update({ llmOllamaUrl: draftLlmOllamaUrl });
    }, 500);
    return () => clearTimeout(t);
  }, [draftLlmOllamaUrl, settings.llmOllamaUrl, update]);

  const handleTestLlm = useCallback(async () => {
    if (testingLlm) return;
    setTestingLlm(true);
    try {
      const { testLlmConnection } = await import("../../lib/server-llm");
      const res = await testLlmConnection();
      if (!res) {
        showToast("Couldn't reach the server. Try again.");
      } else if (res.ok) {
        showToast("Connection OK — provider responded");
      } else if (res.reason === "auth") {
        showToast("Check your API key — the provider rejected it");
      } else {
        showToast("Connection failed — check the URL and model");
      }
    } finally {
      setTestingLlm(false);
    }
  }, [testingLlm, showToast]);

  const llmProvider = settings.llmProvider ?? "forge";

  return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-lg font-semibold mb-4">AI / LLM</h2>
        <label className="block text-sm font-medium mb-2" htmlFor="llm-provider">
          Provider
        </label>
        <select
          id="llm-provider"
          value={llmProvider}
          onChange={(e) => update({ llmProvider: e.target.value as AppSettings["llmProvider"] })}
          className="w-full max-w-xs px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm shadow-sm dark:shadow-none focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
          aria-label="LLM provider"
        >
          <option value="forge">Forge (Default)</option>
          <option value="openai">OpenAI</option>
          <option value="ollama">Ollama Cloud</option>
          <option value="ollama-local">Ollama Local</option>
        </select>

        {llmProvider !== "forge" && (
          <button
            onClick={() => void handleTestLlm()}
            disabled={testingLlm}
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-60"
            aria-label="Test LLM connection"
          >
            {testingLlm ? "Testing…" : "Test connection"}
          </button>
        )}

        {llmProvider === "openai" && (
          <div className="mt-4">
            <label className="block text-sm font-medium mb-2" htmlFor="llm-api-key">
              API Key
            </label>
            <div className="flex items-center gap-2">
              <input
                id="llm-api-key"
                type={showLlmApiKey ? "text" : "password"}
                value={draftLlmApiKey}
                onChange={(e) => setDraftLlmApiKey(e.target.value)}
                onBlur={() => { if (draftLlmApiKey !== (settings.llmApiKey ?? "")) void update({ llmApiKey: draftLlmApiKey }); }}
                placeholder="sk-..."
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
              />
              <button
                onClick={() => setShowLlmApiKey(!showLlmApiKey)}
                className="px-3 py-2 text-sm text-brand-600 dark:text-brand-400 font-medium"
                aria-label={showLlmApiKey ? "Hide API key" : "Show API key"}
              >
                {showLlmApiKey ? "Hide" : "Show"}
              </button>
            </div>

            <label className="block text-sm font-medium mt-4 mb-2" htmlFor="llm-model">
              Model
            </label>
            <input
              id="llm-model"
              type="text"
              value={draftLlmModel}
              onChange={(e) => setDraftLlmModel(e.target.value)}
              onBlur={() => { if (draftLlmModel !== (settings.llmModel ?? "")) void update({ llmModel: draftLlmModel }); }}
              placeholder="dall-e-3"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
            />
          </div>
        )}

        {llmProvider === "ollama" && (
          <div className="mt-4">
            <label className="block text-sm font-medium mb-2" htmlFor="llm-api-key">
              API Key
            </label>
            <div className="flex items-center gap-2">
              <input
                id="llm-api-key"
                type={showLlmApiKey ? "text" : "password"}
                value={draftLlmApiKey}
                onChange={(e) => setDraftLlmApiKey(e.target.value)}
                onBlur={() => { if (draftLlmApiKey !== (settings.llmApiKey ?? "")) void update({ llmApiKey: draftLlmApiKey }); }}
                placeholder="ollama_..."
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
              />
              <button
                onClick={() => setShowLlmApiKey(!showLlmApiKey)}
                className="px-3 py-2 text-sm text-brand-600 dark:text-brand-400 font-medium"
                aria-label={showLlmApiKey ? "Hide API key" : "Show API key"}
              >
                {showLlmApiKey ? "Hide" : "Show"}
              </button>
            </div>

            <label className="block text-sm font-medium mt-4 mb-2" htmlFor="llm-ollama-url">
              Ollama URL
            </label>
            <input
              id="llm-ollama-url"
              type="text"
              value={draftLlmOllamaUrl}
              onChange={(e) => setDraftLlmOllamaUrl(e.target.value)}
              onBlur={() => { if (draftLlmOllamaUrl !== (settings.llmOllamaUrl ?? "")) void update({ llmOllamaUrl: draftLlmOllamaUrl }); }}
              placeholder="https://ollama.com"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
            />

            <label className="block text-sm font-medium mt-4 mb-2" htmlFor="llm-model">
              Model (optional)
            </label>
            <input
              id="llm-model"
              type="text"
              value={draftLlmModel}
              onChange={(e) => setDraftLlmModel(e.target.value)}
              onBlur={() => { if (draftLlmModel !== (settings.llmModel ?? "")) void update({ llmModel: draftLlmModel }); }}
              placeholder="gemma4"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
            />
          </div>
        )}

        {llmProvider === "ollama-local" && (
          <div className="mt-4">
            <label className="block text-sm font-medium mb-2" htmlFor="llm-ollama-url">
              Ollama URL
            </label>
            <input
              id="llm-ollama-url"
              type="text"
              value={draftLlmOllamaUrl}
              onChange={(e) => setDraftLlmOllamaUrl(e.target.value)}
              onBlur={() => { if (draftLlmOllamaUrl !== (settings.llmOllamaUrl ?? "")) void update({ llmOllamaUrl: draftLlmOllamaUrl }); }}
              placeholder="http://localhost:11434"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
            />

            <label className="block text-sm font-medium mt-4 mb-2" htmlFor="llm-model">
              Model (optional)
            </label>
            <input
              id="llm-model"
              type="text"
              value={draftLlmModel}
              onChange={(e) => setDraftLlmModel(e.target.value)}
              onBlur={() => { if (draftLlmModel !== (settings.llmModel ?? "")) void update({ llmModel: draftLlmModel }); }}
              placeholder="llava"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
            />
          </div>
        )}

        <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          {llmProvider === "forge"
            ? "Uses the built-in service. AI discovery and price insights run on the server; no key needed."
            : llmProvider === "openai"
              ? "Requires an OpenAI API key. Used for product discovery and price insights."
              : llmProvider === "ollama"
                ? "Uses Ollama Cloud. Requires an API key from ollama.com; used for product discovery and price insights."
                : "Runs against an Ollama server on the app server's host (loopback only). Run 'ollama pull llama3.2' to download the default model."}
        </p>
      </div>
  );
}
