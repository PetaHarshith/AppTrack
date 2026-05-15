import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";
import { BACKEND_URL } from "@/constants";

// In production VITE_BACKEND_URL is unset, so BACKEND_URL falls back to window.location.origin
// (see constants/index.ts). Better-auth appends its own /api/auth/... path to baseURL,
// so we pass just the origin here.
export const authClient = createAuthClient({
    baseURL: BACKEND_URL,
    plugins: [
        usernameClient(),
    ],
});

export const {
    signIn,
    signUp,
    signOut,
    useSession,
} = authClient;
