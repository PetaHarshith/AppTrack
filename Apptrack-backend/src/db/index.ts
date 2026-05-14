import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

// Load .env from Apptrack-backend/, regardless of which cwd we were invoked from.
// In production (Vercel), env vars are injected by the platform and dotenv is a no-op.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing. Add it to Apptrack-backend/.env or your hosting provider's env vars.");
}

const isServerless = !!process.env.VERCEL;

const client = postgres(process.env.DATABASE_URL, {
    prepare: false,
    max: isServerless ? 1 : 10,
    idle_timeout: isServerless ? 20 : undefined,
    connect_timeout: 10,
});

export const db = drizzle(client);
