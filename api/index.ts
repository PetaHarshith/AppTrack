/**
 * Vercel serverless entry. The whole Express app is wrapped as a single function
 * that handles every request under /api/*. Vercel's rewrites in vercel.json route
 * matching paths here; everything else (static frontend assets) is served from
 * the Vite build output.
 *
 * The Express app exports itself; we just re-export so Vercel finds a default
 * handler in this file.
 */

export { default } from "../Apptrack-backend/src/index";
