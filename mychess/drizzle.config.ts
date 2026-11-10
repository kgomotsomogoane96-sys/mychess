import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
import { databaseUrl, directDatabaseUrl } from "./src/lib/database-url";

// .env.local survives platform-managed .env resets; fall back to .env too.
config({ path: ".env.local" });
config();

// drizzle-kit performs DDL, so prefer Neon's direct/unpooled URL.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  dbCredentials: { url: directDatabaseUrl() ?? databaseUrl() ?? "" },
});
