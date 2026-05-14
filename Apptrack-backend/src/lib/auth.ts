import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";
import { db } from "../db";
import * as schema from "../db/schema";

const isProd = process.env.NODE_ENV === "production" || !!process.env.VERCEL;

const trustedOrigins: string[] = [];
if (process.env.FRONTEND_URL) trustedOrigins.push(process.env.FRONTEND_URL);
if (!isProd) {
    trustedOrigins.push("http://localhost:5173", "http://localhost:5174");
}

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "pg",
        schema: {
            user: schema.user,
            session: schema.session,
            account: schema.account,
            verification: schema.verification,
        },
    }),
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: false,
    },
    plugins: [
        username(),
    ],
    // SameSite=None + Secure lets the Chrome extension send the session cookie
    // when calling the backend from a chrome-extension:// origin. Chrome treats
    // localhost as a secure context in dev, so this also works without HTTPS locally.
    advanced: {
        defaultCookieAttributes: {
            sameSite: "none",
            secure: true,
        },
    },
    trustedOrigins,
});

export type Auth = typeof auth;
