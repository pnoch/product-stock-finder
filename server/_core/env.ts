export const ENV = {
  appId: process.env.VITE_APP_ID ?? "stock-finder",
  cookieSecret: (() => {
    const secret = process.env.JWT_SECRET;
    if (secret) return secret;
    if (process.env.NODE_ENV === "production")
      throw new Error("JWT_SECRET must be set in production");
    return "dev-secret-change-in-production";
  })(),
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "https://ollama.com",
  imageProvider: (process.env.IMAGE_PROVIDER ?? "forge") as "forge" | "ollama" | "ollama-local" | "openai",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
};
