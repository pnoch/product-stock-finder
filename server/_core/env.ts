import { randomBytes } from "crypto";
export const ENV = {
  appId: process.env.VITE_APP_ID ?? "stock-finder",
  cookieSecret: (() => {
    const secret = process.env.JWT_SECRET;
    if (secret) return secret;
    if (process.env.NODE_ENV === "production")
      throw new Error("JWT_SECRET must be set in production");
    // Ephemeral per process. A hard-coded fallback secret let anyone forge a
    // session token for any instance started without JWT_SECRET — e.g. a built
    // server run with no NODE_ENV. Sessions simply do not survive a restart in
    // this mode.
    return randomBytes(32).toString("hex");
  })(),
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "https://ollama.com",
  imageProvider: (process.env.IMAGE_PROVIDER ?? "forge") as "forge" | "ollama" | "ollama-local" | "openai",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
};
