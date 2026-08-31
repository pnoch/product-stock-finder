export const ENV = {
  appId: process.env.VITE_APP_ID ?? "stock-finder",
  cookieSecret: process.env.JWT_SECRET ?? (process.env.NODE_ENV === "production" ? "" : "dev-secret-change-in-production"),
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "",
  imageProvider: (process.env.IMAGE_PROVIDER ?? "forge") as "forge" | "ollama" | "openai",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
};
