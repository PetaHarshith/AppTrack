import express, { Request, Response, NextFunction } from 'express';
import { toNodeHandler, fromNodeHeaders } from 'better-auth/node';
import cors from 'cors';
import { eq } from 'drizzle-orm';
import applicationsRouter from './routes/applications.js';
import usersRouter from './routes/users.js';
import { auth } from './lib/auth.js';
import { db } from './db/index.js';
import { user as authUserTable } from './db/schema/auth.js';
import { users } from './db/schema/app.js';

const isProd = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;

const app = express();

// ---------- CORS ----------
// Frontend origins allowed in dev + the production frontend URL from env.
// Chrome extension origins are allowed via the chrome-extension:// prefix check.
const allowedOrigins = new Set<string>(
    [
        process.env.FRONTEND_URL,
        !isProd && 'http://localhost:5173',
        !isProd && 'http://localhost:5174',
    ].filter(Boolean) as string[]
);

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            if (allowedOrigins.has(origin)) return callback(null, true);
            if (origin.startsWith('chrome-extension://')) return callback(null, true);
            return callback(new Error(`CORS: origin ${origin} not allowed`));
        },
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        credentials: true,
    })
);

// ---------- better-auth ----------
// Mounted at /api/auth — must be BEFORE express.json() to receive the raw body.
app.all('/api/auth/*splat', toNodeHandler(auth));

app.use(express.json());

// ---------- session middleware ----------
// Resolves the integer userId for routes that need it. Skips routes that don't.
app.use(async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.path.startsWith('/api/applications') && !req.path.startsWith('/api/users')) {
        return next();
    }
    try {
        const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
        if (!session || !session.user) return next();

        const authUserId = session.user.id;
        let userResult = await db
            .select()
            .from(users)
            .where(eq(users.authUserId, authUserId))
            .limit(1);

        // Lazy-create the integer-id user row on first hit
        if (!userResult.length) {
            const authUserResult = await db
                .select()
                .from(authUserTable)
                .where(eq(authUserTable.id, authUserId))
                .limit(1);
            if (authUserResult.length) {
                const authUser = authUserResult[0]!;
                userResult = await db
                    .insert(users)
                    .values({
                        authUserId,
                        email: authUser.email,
                        name: authUser.name,
                    })
                    .returning();
            }
        }
        if (userResult.length) {
            (req as any).userId = userResult[0]!.id;
        }
    } catch (error) {
        console.error('[auth middleware]', error);
    }
    next();
});

// ---------- routes ----------
app.get('/api/health', (_req, res) => {
    res.json({ ok: true, env: isProd ? 'prod' : 'dev' });
});

app.use('/api/applications', applicationsRouter);
app.use('/api/users', usersRouter);

// ---------- export + conditional listen ----------
// Vercel imports `app` as the serverless handler. Local dev calls listen().
if (!process.env.VERCEL) {
    const PORT = parseInt(process.env.PORT || '8000', 10);
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

export default app;
