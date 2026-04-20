import express, { Request, Response, NextFunction } from 'express';
import { toNodeHandler, fromNodeHeaders } from 'better-auth/node';
import applicationsRouter from './routes/applications';
import cors from 'cors';
import { auth } from './lib/auth';
import { db } from './db';
import { eq } from 'drizzle-orm';
import { user as authUserTable } from './db/schema/auth';
import { users } from './db/schema/app';

const app = express();
const PORT = 8000;

if (!process.env.FRONTEND_URL) {
    throw new Error('Missing frontend URL');
}

app.use(cors({
    origin: [process.env.FRONTEND_URL!, 'http://localhost:5174', 'http://localhost:5173'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));

// Better-auth handler - must be before express.json() for auth routes
app.all('/api/auth/*splat', toNodeHandler(auth));

app.use(express.json());

// Middleware to extract authenticated user from session using better-auth's API
app.use(async (req: Request, _res: Response, next: NextFunction) => {
    // Skip for non-application routes
    if (!req.path.startsWith('/applications')) {
        return next();
    }

    try {
        // Use better-auth's built-in session validation
        const session = await auth.api.getSession({
            headers: fromNodeHeaders(req.headers),
        });

        if (!session || !session.user) {
            return next(); // No valid session
        }

        const authUserId = session.user.id;

        // Look up custom users table
        let userResult = await db
            .select()
            .from(users)
            .where(eq(users.authUserId, authUserId))
            .limit(1);

        // If user doesn't exist in custom users table, create them (lazy creation)
        if (!userResult.length) {
            // Get user info from better-auth user table
            const authUserResult = await db
                .select()
                .from(authUserTable)
                .where(eq(authUserTable.id, authUserId))
                .limit(1);

            if (authUserResult.length) {
                const authUser = authUserResult[0]!;

                // Create custom user record
                const newUser = await db
                    .insert(users)
                    .values({
                        authUserId: authUserId,
                        email: authUser.email,
                        name: authUser.name,
                    })
                    .returning();

                userResult = newUser;
                console.log(`[Auth Middleware] Created custom user for: ${authUser.email}`);
            }
        }

        if (userResult.length) {
            // Attach integer userId to request for use in route handlers
            (req as any).userId = userResult[0]!.id;
            console.log(`[Auth Middleware] User authenticated: ${session.user.email}, userId: ${userResult[0]!.id}`);
        }
    } catch (error) {
        console.error('[Auth Middleware] Error:', error);
    }

    next();
});

app.get('/', (_req, res) => {
    res.send('Welcome to the Application Tracking API!');
});

// Register routes
app.use('/applications', applicationsRouter);

app.listen(PORT, () => {
    console.log(`Server is running on port http://localhost:${PORT}`);
});
