import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "drizzle-kit";

// Load .env relative to this file so `npm run db:push` works from the repo root.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env") });

if (!process.env.DATABASE_URL) {
    throw new Error("Missing DATABASE_URL");
}

export default defineConfig({
    schema: "./Apptrack-backend/src/db/schema/index.ts",
    out: "./Apptrack-backend/src/db/migrations",
    dialect: "postgresql",
    dbCredentials: {
        url: process.env.DATABASE_URL!,
    },
});
