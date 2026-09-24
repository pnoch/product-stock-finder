import type { IncomingHttpHeaders } from "node:http";
import {
  invokeLLM,
  type InvokeParams,
  type InvokeResult,
} from "./_core/llm";
import { BYO_LLM_AUTH_ERR_MSG } from "../shared/const.js";

export type UserLlmProvider = "forge" | "openai" | "ollama" | "ollama-local";

/**
 * Thrown when the user's own provider rejects the request (401/403) — almost
 * always a bad or expired API key. Callers map this to actionable copy rather
 * than a generic server error. The message is a fixed token; the provider's
 * response body (which can echo the key) is never included.
 */
export class UserLlmAuthError extends Error {
  kind = "auth" as const;
  status: number;
  constructor(status: number) {
    super(BYO_LLM_AUTH_ERR_MSG);
    this.status = status;
    this.name = "UserLlmAuthError";
  }
}

export interface UserLlmConfig {
  provider: UserLlmProvider;
  apiKey?: string;
  model?: string;
  ollamaUrl?: string;
}

// Fixed provider hosts only. The server is the caller, so a user-supplied URL
// would be an SSRF vector into the internal network; the sole exception is
// `ollama-local`, which is loopback-restricted (below).
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const OLLAMA_CLOUD_URL = "https://ollama.com/api/chat";
const DEFAULT_OLLAMA_LOCAL_URL = "http://localhost:11434";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const DEFAULT_OLLAMA_CLOUD_MODEL = "gpt-oss:20b";
const DEFAULT_OLLAMA_LOCAL_MODEL = "llama3.2";
const REQUEST_TIMEOUT_MS = 20_000;

const PROVIDERS: readonly UserLlmProvider[] = [
  "forge",
  "openai",
  "ollama",
  "ollama-local",
];

// Header bounds — mirrors the varchar limits used elsewhere for device ids /
// model numbers. A key longer than this is rejected rather than forwarded.
const MAX_KEY_LEN = 512;
const MAX_MODEL_LEN = 128;
const MAX_URL_LEN = 256;

function headerValue(
  headers: IncomingHttpHeaders,
  name: string,
  max: number,
): string | undefined {
  const raw = headers[name];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed === "" || trimmed.length > max) return undefined;
  return trimmed;
}

/**
 * Reads the user's BYO-LLM config from request headers. The client sends these
 * from the synced `AppSettings`; the key is used per-request for the user's own
 * provider and is never persisted server-side.
 */
export function userLlmConfigFromHeaders(
  headers: IncomingHttpHeaders,
): UserLlmConfig | null {
  const rawProvider = headerValue(headers, "x-llm-provider", 32);
  if (!rawProvider) return null;
  if (!(PROVIDERS as readonly string[]).includes(rawProvider)) return null;
  if (rawProvider === "forge") return null;
  return {
    provider: rawProvider as UserLlmProvider,
    apiKey: headerValue(headers, "x-llm-key", MAX_KEY_LEN),
    model: headerValue(headers, "x-llm-model", MAX_MODEL_LEN),
    ollamaUrl: headerValue(headers, "x-llm-url", MAX_URL_LEN),
  };
}

/**
 * Restricts `ollama-local` to loopback hosts. The server proxies the request,
 * so an arbitrary URL here would let a caller reach internal services.
 */
export function resolveOllamaLocalUrl(raw: string | undefined): string | null {
  const candidate = (raw ?? "").trim() || DEFAULT_OLLAMA_LOCAL_URL;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const isLoopback =
    host === "localhost" || host === "127.0.0.1" || host === "::1";
  if (!isLoopback) return null;
  return `${url.protocol}//${url.host}/api/chat`;
}

function normalizeOllama(model: string, content: string): InvokeResult {
  const now = Date.now();
  return {
    id: `ollama-${now}`,
    created: Math.floor(now / 1000),
    model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content },
        finish_reason: "stop",
      },
    ],
  };
}

async function postJson(url: string, body: unknown, apiKey?: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    // A 401/403 from the user's provider means the key was rejected — surface a
    // distinct, actionable error. Otherwise report only the status: the
    // provider body can echo the key back.
    if (res.status === 401 || res.status === 403) {
      throw new UserLlmAuthError(res.status);
    }
    throw new Error(`LLM provider error (${res.status})`);
  }
  return res.json();
}

function messagesForProvider(params: InvokeParams): unknown {
  // Both providers accept OpenAI-style {role, content} messages.
  return params.messages;
}

/**
 * Invokes the user's configured LLM, or the built-in Forge service when no BYO
 * config is present. Returns an OpenAI-shaped result so callers are unchanged.
 */
export async function invokeUserLlm(
  config: UserLlmConfig | null | undefined,
  params: InvokeParams,
): Promise<InvokeResult> {
  if (!config || config.provider === "forge") {
    return invokeLLM(params);
  }

  if (config.provider === "openai") {
    if (!config.apiKey) throw new Error("OpenAI API key is required");
    const model = config.model || DEFAULT_OPENAI_MODEL;
    const body = {
      model,
      messages: messagesForProvider(params),
      max_tokens: params.maxTokens,
    };
    const json = (await postJson(OPENAI_URL, body, config.apiKey)) as InvokeResult;
    return json;
  }

  if (config.provider === "ollama" || config.provider === "ollama-local") {
    const isLocal = config.provider === "ollama-local";
    const url = isLocal ? resolveOllamaLocalUrl(config.ollamaUrl) : OLLAMA_CLOUD_URL;
    if (!url) {
      throw new Error("Ollama URL must point at a loopback host");
    }
    if (!isLocal && !config.apiKey) {
      throw new Error("Ollama Cloud API key is required");
    }
    const model = config.model
      ? config.model
      : isLocal
        ? DEFAULT_OLLAMA_LOCAL_MODEL
        : DEFAULT_OLLAMA_CLOUD_MODEL;
    const body = {
      model,
      messages: messagesForProvider(params),
      stream: false,
      ...(params.maxTokens ? { options: { num_predict: params.maxTokens } } : {}),
    };
    const json = (await postJson(url, body, isLocal ? undefined : config.apiKey)) as {
      message?: { content?: unknown };
    };
    const content = json?.message?.content;
    if (typeof content !== "string") {
      throw new Error("Invalid Ollama response");
    }
    return normalizeOllama(model, content);
  }

  return invokeLLM(params);
}
