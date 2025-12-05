import type { Config } from "drizzle-kit";

// Local config for migration generation without SST
// Usage: npx drizzle-kit generate --config drizzle.config.local.ts
export default {
  schema: "./src/schema",
  schemaFilter: ["public"],
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    // Use local/dev postgres or connection string from env
    url: process.env.DATABASE_URL ?? "postgresql://localhost:5432/ubumuntu_dev",
  },
  tablesFilter: ["ubumuntu_*"],
} satisfies Config;
