/**
 * Image generation helper supporting multiple providers:
 * - forge: Internal Forge API (GPT Image 2)
 * - ollama: Local Ollama with OpenAI-compatible /v1/images/generations
 * - openai: Direct OpenAI API (DALL-E / GPT Image)
 *
 * Set IMAGE_PROVIDER env var to choose (default: "forge").
 * OLLAMA_BASE_URL defaults to http://localhost:11434.
 */
import { storagePut } from "../storage";
import { ENV } from "./env";

const DEFAULT_IMAGE_MODEL = "MODEL_GPT_IMAGE_2";
const DEFAULT_IMAGE_QUALITY = "medium";

export type GenerateImageOptions = {
  prompt: string;
  originalImages?: Array<{
    url?: string;
    b64Json?: string;
    mimeType?: string;
  }>;
  model?: string;
  quality?: string;
};

export type GenerateImageResponse = {
  url?: string;
};

export async function generateImage(
  options: GenerateImageOptions,
): Promise<GenerateImageResponse> {
  const provider = ENV.imageProvider;
  if (provider === "ollama") return generateWithOllama(options);
  if (provider === "openai") return generateWithOpenAI(options);
  return generateWithForge(options);
}

async function generateWithForge(
  options: GenerateImageOptions,
): Promise<GenerateImageResponse> {
  if (!ENV.forgeApiUrl) throw new Error("BUILT_IN_FORGE_API_URL is not configured");
  if (!ENV.forgeApiKey) throw new Error("BUILT_IN_FORGE_API_KEY is not configured");

  const baseUrl = ENV.forgeApiUrl.endsWith("/") ? ENV.forgeApiUrl : `${ENV.forgeApiUrl}/`;
  const fullUrl = new URL("images.v1.ImageService/GenerateImage", baseUrl).toString();

  const model = options.model ?? DEFAULT_IMAGE_MODEL;
  const quality = options.quality ?? (model === DEFAULT_IMAGE_MODEL ? DEFAULT_IMAGE_QUALITY : undefined);

  const response = await fetch(fullUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "connect-protocol-version": "1",
      authorization: `Bearer ${ENV.forgeApiKey}`,
    },
    body: JSON.stringify({
      prompt: options.prompt,
      original_images: options.originalImages || [],
      model,
      ...(quality ? { quality } : {}),
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Forge image generation failed (${response.status})${detail ? `: ${detail}` : ""}`);
  }

  const result = (await response.json()) as { image: { b64Json: string; mimeType: string } };
  const buffer = Buffer.from(result.image.b64Json, "base64");
  const { url } = await storagePut(`generated/${Date.now()}.png`, buffer, result.image.mimeType);
  return { url };
}

async function generateWithOllama(
  options: GenerateImageOptions,
): Promise<GenerateImageResponse> {
  const baseUrl = ENV.ollamaBaseUrl || "http://localhost:11434";
  const model = options.model ?? "llava";

  const response = await fetch(`${baseUrl}/v1/images/generations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt: options.prompt,
      n: 1,
      size: "1024x1024",
      response_format: "b64_json",
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Ollama image generation failed (${response.status})${detail ? `: ${detail}` : ""}`);
  }

  const result = (await response.json()) as {
    data: Array<{ b64_json?: string; b64Json?: string; url?: string }>;
  };
  const item = result.data?.[0];
  if (!item) throw new Error("Ollama returned no images");

  if (item.url) return { url: item.url };

  const b64 = item.b64_json ?? item.b64Json;
  if (!b64) throw new Error("Ollama returned no image data");

  const buffer = Buffer.from(b64, "base64");
  const { url } = await storagePut(`generated/${Date.now()}.png`, buffer, "image/png");
  return { url };
}

async function generateWithOpenAI(
  options: GenerateImageOptions,
): Promise<GenerateImageResponse> {
  if (!ENV.openaiApiKey) throw new Error("OPENAI_API_KEY is not configured");

  const model = options.model ?? "dall-e-3";
  const size = "1024x1024";

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ENV.openaiApiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt: options.prompt,
      n: 1,
      size,
      response_format: "b64_json",
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`OpenAI image generation failed (${response.status})${detail ? `: ${detail}` : ""}`);
  }

  const result = (await response.json()) as {
    data: Array<{ b64_json?: string; url?: string }>;
  };
  const item = result.data?.[0];
  if (!item) throw new Error("OpenAI returned no images");

  if (item.url) return { url: item.url };

  const b64 = item.b64_json;
  if (!b64) throw new Error("OpenAI returned no image data");

  const buffer = Buffer.from(b64, "base64");
  const { url } = await storagePut(`generated/${Date.now()}.png`, buffer, "image/png");
  return { url };
}

export type ImageModelInfo = {
  model?: string;
  id?: string;
};

export type ListImageModelsResponse = {
  models: ImageModelInfo[];
};

export async function listImageModels(): Promise<ListImageModelsResponse> {
  const provider = ENV.imageProvider;

  if (provider === "ollama") {
    const baseUrl = ENV.ollamaBaseUrl || "http://localhost:11434";
    try {
      const res = await fetch(`${baseUrl}/api/tags`);
      if (!res.ok) return { models: [] };
      const data = (await res.json()) as { models?: Array<{ name: string }> };
      return {
        models: (data.models ?? []).map((m) => ({
          model: m.name,
          id: m.name,
        })),
      };
    } catch {
      return { models: [] };
    }
  }

  if (!ENV.forgeApiUrl) throw new Error("BUILT_IN_FORGE_API_URL is not configured");
  if (!ENV.forgeApiKey) throw new Error("BUILT_IN_FORGE_API_KEY is not configured");

  const baseUrl = ENV.forgeApiUrl.endsWith("/") ? ENV.forgeApiUrl : `${ENV.forgeApiUrl}/`;
  const fullUrl = new URL("images.v1.ImageService/ListModels", baseUrl).toString();

  const response = await fetch(fullUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "connect-protocol-version": "1",
      authorization: `Bearer ${ENV.forgeApiKey}`,
    },
    body: "{}",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`List image models failed (${response.status})${detail ? `: ${detail}` : ""}`);
  }

  const result = (await response.json()) as { models?: ImageModelInfo[] };
  return { models: result.models ?? [] };
}
