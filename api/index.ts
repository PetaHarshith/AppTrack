/**
 * Vercel serverless entry. The whole Express app is wrapped as a single function
 * that handles every request under /api/*. Vercel's rewrites in vercel.json route
 * matching paths here; everything else (static frontend assets) is served from
 * the Vite build output.
 *
 * The .js extension is required by Node's ESM runtime (the .ts source resolves
 * correctly thanks to TypeScript's NodeNext-style resolution).
 */

export { default } from "../Apptrack-backend/src/index.js";
