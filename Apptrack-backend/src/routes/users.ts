import express from "express";
import { eq } from "drizzle-orm";
import { users } from "../db/schema";
import { db } from "../db";
import { z } from "zod";

const router = express.Router();

const updateMeSchema = z.object({
    weeklyGoal: z.number().int().min(0).max(200).optional(),
    name: z.string().trim().max(120).optional(),
});

router.get("/me", async (req, res) => {
    try {
        const userId = (req as any).userId as number | undefined;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        if (!result.length) return res.status(404).json({ error: "User not found" });

        return res.status(200).json({ data: result[0] });
    } catch (error) {
        console.error("[GET /users/me] Error:", error);
        return res.status(500).json({ error: "Failed to fetch user" });
    }
});

router.patch("/me", async (req, res) => {
    try {
        const userId = (req as any).userId as number | undefined;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const validation = updateMeSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({ error: "Validation failed", details: validation.error.issues });
        }
        if (Object.keys(validation.data).length === 0) {
            return res.status(400).json({ error: "No fields to update" });
        }

        const updated = await db
            .update(users)
            .set(validation.data)
            .where(eq(users.id, userId))
            .returning();

        return res.status(200).json({ data: updated[0] });
    } catch (error) {
        console.error("[PATCH /users/me] Error:", error);
        return res.status(500).json({ error: "Failed to update user" });
    }
});

export default router;
