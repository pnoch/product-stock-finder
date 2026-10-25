import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

export default defineConfig({
  schema: "./drizzle/schema.ts",
  // Overridable so the migration-drift check can generate into a scratch dir.
  out: process.env.DRIZZLE_OUT ?? "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    url: connectionString,
  },
});
