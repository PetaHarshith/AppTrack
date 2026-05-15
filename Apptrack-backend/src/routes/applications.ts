import express from "express";
import { and, desc, asc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { applications, users } from "../db/schema/index.js";
import { db } from "../db/index.js";
import { z } from "zod";
import { importJobFromUrl } from "../lib/importUrl.js";
import { statsCache, STATS_CACHE_TTL_MS, invalidateStatsCache } from "../lib/statsCache.js";

const router = express.Router();

// Valid status values from schema
const VALID_STATUSES = ["Applied", "OA", "Interview", "Offer", "Rejected", "Withdrawn"] as const;
const MAX_LIMIT = 100;

// Helper to validate status
const isValidStatus = (status: any): status is typeof VALID_STATUSES[number] => {
    return VALID_STATUSES.includes(status);
};

// Helper to validate date string (YYYY-MM-DD format)
const isValidDate = (dateString: string): boolean => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return false;
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
};

const VALID_WORK_TYPES = ["Internship", "FullTime", "Coop", "Contract"] as const;
const VALID_PRIORITIES = ["Dream", "Target", "Safety"] as const;

const nullableDateField = z
    .union([
        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").refine(isValidDate, "Invalid date"),
        z.literal(""),
        z.null(),
    ])
    .optional();

// Zod schema for creating an application
const createApplicationSchema = z.object({
    userId: z.number().int().positive(),
    company: z.string().trim().min(1, "Company name is required").max(120, "Company name too long"),
    position: z.string().trim().min(1, "Position is required").max(150, "Position too long"),
    status: z.enum(VALID_STATUSES).optional().default("Applied"),
    dateApplied: nullableDateField,
    jobUrl: z.union([z.string().min(1), z.literal(""), z.null()]).optional(),
    notes: z.string().nullable().optional(),
    interviewDate: nullableDateField,
    oaDeadline: nullableDateField,
    salary: z.union([z.string().max(120), z.literal(""), z.null()]).optional(),
    location: z.union([z.string().max(120), z.literal(""), z.null()]).optional(),
    workType: z.union([z.enum(VALID_WORK_TYPES), z.literal(""), z.null()]).optional(),
    requiresSponsorship: z.union([z.boolean(), z.null()]).optional(),
    priority: z.union([z.enum(VALID_PRIORITIES), z.literal(""), z.null()]).optional(),
});

// Zod schema for updating an application
const updateApplicationSchema = createApplicationSchema.partial().omit({ userId: true });

// Import a job posting from a URL (scrape company/position/location/salary)
router.post("/import-url", async (req, res) => {
    try {
        const userId = (req as any).userId as number | undefined;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const { url } = req.body || {};
        if (!url || typeof url !== "string") {
            return res.status(400).json({ error: "url is required" });
        }

        const result = await importJobFromUrl(url);
        if (!result.ok) {
            return res.status(422).json(result);
        }
        return res.status(200).json(result);
    } catch (error) {
        console.error("[POST /applications/import-url] Error:", error);
        return res.status(500).json({ error: "Failed to import job posting" });
    }
});

// Get dashboard statistics
router.get("/stats", async (req, res) => {
    try {
        // Get userId from middleware (integer from custom users table)
        const userId = (req as any).userId as number | undefined;

        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const cached = statsCache.get(userId);
        if (cached && cached.expiresAt > Date.now()) {
            return res.status(200).json({ data: cached.payload });
        }

        // Get status counts for this user only
        const statusCounts = await db
            .select({
                status: applications.status,
                count: sql<number>`count(*)::int`
            })
            .from(applications)
            .where(eq(applications.userId, userId))
            .groupBy(applications.status);

        // Get total count for this user only
        const totalResult = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(applications)
            .where(eq(applications.userId, userId));
        const total = totalResult[0]?.count ?? 0;

        // Get applications by month (last 6 months) for this user only
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const monthlyApplications = await db
            .select({
                month: sql<string>`to_char(created_at, 'YYYY-MM')`,
                count: sql<number>`count(*)::int`
            })
            .from(applications)
            .where(and(
                eq(applications.userId, userId),
                sql`created_at >= ${sixMonthsAgo.toISOString()}`
            ))
            .groupBy(sql`to_char(created_at, 'YYYY-MM')`)
            .orderBy(sql`to_char(created_at, 'YYYY-MM')`);

        // Get recent applications (last 5) for this user only
        const recentApplications = await db
            .select({
                id: applications.id,
                company: applications.company,
                position: applications.position,
                status: applications.status,
                dateApplied: applications.dateApplied,
                createdAt: applications.createdAt
            })
            .from(applications)
            .where(eq(applications.userId, userId))
            .orderBy(desc(applications.createdAt))
            .limit(5);

        // Calculate response rate (interviews + offers) / total
        const statusMap: Record<string, number> = {};
        statusCounts.forEach(s => {
            statusMap[s.status] = s.count;
        });

        const interviews = statusMap['Interview'] || 0;
        const offers = statusMap['Offer'] || 0;
        const rejections = statusMap['Rejected'] || 0;
        const responseRate = total > 0 ? Math.round(((interviews + offers + rejections) / total) * 100) : 0;
        const successRate = total > 0 ? Math.round(((interviews + offers) / total) * 100) : 0;

        // Funnel: cumulative reach across pipeline stages.
        // Counts an application as "having reached" a stage if it's currently at that stage or further along.
        const applied = statusMap['Applied'] || 0;
        const oa = statusMap['OA'] || 0;
        // Treat reaching a later stage as also having passed the earlier ones.
        const reachedApplied = applied + oa + interviews + offers + rejections + (statusMap['Withdrawn'] || 0);
        const reachedOA = oa + interviews + offers;
        const reachedInterview = interviews + offers;
        const reachedOffer = offers;
        const funnel = [
            { stage: 'Applied', count: reachedApplied },
            { stage: 'OA', count: reachedOA },
            { stage: 'Interview', count: reachedInterview },
            { stage: 'Offer', count: reachedOffer },
        ].map((s, i, arr) => {
            const prev = arr[i - 1];
            return {
                ...s,
                conversionFromPrev: i === 0
                    ? 100
                    : prev && prev.count > 0
                        ? Math.round((s.count / prev.count) * 100)
                        : 0,
            };
        });

        // Response time per top company: avg days between dateApplied and lastContactAt for non-Applied rows.
        const responseTimeRows = await db
            .select({
                company: applications.company,
                avgDays: sql<number>`AVG(EXTRACT(EPOCH FROM (last_contact_at - (date_applied::timestamp))) / 86400)::int`,
                count: sql<number>`count(*)::int`,
            })
            .from(applications)
            .where(and(
                eq(applications.userId, userId),
                sql`${applications.status} != 'Applied'`,
                sql`${applications.lastContactAt} IS NOT NULL`,
                sql`${applications.dateApplied} IS NOT NULL`,
            ))
            .groupBy(applications.company)
            .orderBy(desc(sql`count(*)`))
            .limit(5);

        const responseTimeByCompany = responseTimeRows
            .filter(r => r.avgDays !== null && r.avgDays !== undefined && r.avgDays >= 0)
            .map(r => ({ company: r.company, avgDays: Number(r.avgDays), count: r.count }));

        // Upcoming deadlines: interviewDate or oaDeadline within the next 14 days.
        const todayStr = new Date().toISOString().slice(0, 10);
        const in14Days = new Date();
        in14Days.setDate(in14Days.getDate() + 14);
        const in14Str = in14Days.toISOString().slice(0, 10);

        const upcomingRaw = await db
            .select({
                id: applications.id,
                company: applications.company,
                position: applications.position,
                status: applications.status,
                interviewDate: applications.interviewDate,
                oaDeadline: applications.oaDeadline,
            })
            .from(applications)
            .where(and(
                eq(applications.userId, userId),
                or(
                    and(gte(applications.interviewDate, todayStr), lte(applications.interviewDate, in14Str)),
                    and(gte(applications.oaDeadline, todayStr), lte(applications.oaDeadline, in14Str)),
                )!
            ))
            .orderBy(asc(applications.interviewDate));

        const upcomingDeadlines: Array<{
            id: number;
            company: string;
            position: string;
            type: 'Interview' | 'OA Deadline';
            date: string;
        }> = [];
        for (const row of upcomingRaw) {
            if (row.interviewDate && row.interviewDate >= todayStr && row.interviewDate <= in14Str) {
                upcomingDeadlines.push({ id: row.id, company: row.company, position: row.position, type: 'Interview', date: row.interviewDate });
            }
            if (row.oaDeadline && row.oaDeadline >= todayStr && row.oaDeadline <= in14Str) {
                upcomingDeadlines.push({ id: row.id, company: row.company, position: row.position, type: 'OA Deadline', date: row.oaDeadline });
            }
        }
        upcomingDeadlines.sort((a, b) => a.date.localeCompare(b.date));

        // Follow-up candidates: status=Applied and (lastContactAt or dateApplied or createdAt) > 14 days ago.
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

        const followUpRows = await db
            .select({
                id: applications.id,
                company: applications.company,
                position: applications.position,
                dateApplied: applications.dateApplied,
                lastContactAt: applications.lastContactAt,
                createdAt: applications.createdAt,
            })
            .from(applications)
            .where(and(
                eq(applications.userId, userId),
                eq(applications.status, 'Applied'),
                sql`COALESCE(${applications.lastContactAt}, ${applications.dateApplied}::timestamp, ${applications.createdAt}) < ${fourteenDaysAgo.toISOString()}`,
            ))
            .orderBy(asc(sql`COALESCE(${applications.lastContactAt}, ${applications.dateApplied}::timestamp, ${applications.createdAt})`))
            .limit(10);

        const followUpCandidates = followUpRows.map(r => {
            const lastTouch = r.lastContactAt || (r.dateApplied ? new Date(r.dateApplied) : r.createdAt);
            const days = Math.floor((Date.now() - new Date(lastTouch).getTime()) / (1000 * 60 * 60 * 24));
            return { id: r.id, company: r.company, position: r.position, daysSinceContact: days };
        });

        // Weekly streak: applications added per week (last 8 weeks) + user's weekly goal.
        const userRow = await db.select({ weeklyGoal: users.weeklyGoal }).from(users).where(eq(users.id, userId)).limit(1);
        const weeklyGoal = userRow[0]?.weeklyGoal ?? 5;

        const eightWeeksAgo = new Date();
        eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 8 * 7);
        const weeklyRows = await db
            .select({
                weekStart: sql<string>`to_char(date_trunc('week', created_at), 'YYYY-MM-DD')`,
                count: sql<number>`count(*)::int`,
            })
            .from(applications)
            .where(and(
                eq(applications.userId, userId),
                sql`created_at >= ${eightWeeksAgo.toISOString()}`,
            ))
            .groupBy(sql`date_trunc('week', created_at)`)
            .orderBy(sql`date_trunc('week', created_at)`);

        // Fill in missing weeks with zero.
        const weeks: Array<{ weekStart: string; count: number }> = [];
        for (let i = 7; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i * 7);
            // Monday-anchored week (Postgres default date_trunc('week') is Monday).
            const day = d.getUTCDay() || 7;
            d.setUTCDate(d.getUTCDate() - day + 1);
            const key = d.toISOString().slice(0, 10);
            const found = weeklyRows.find(w => w.weekStart === key);
            weeks.push({ weekStart: key, count: found?.count ?? 0 });
        }
        const currentWeekCount = weeks[weeks.length - 1]?.count ?? 0;
        const weeklyStreak = { currentWeekCount, goal: weeklyGoal, weeks };

        // Daily activity for the last 84 days (12 weeks x 7 = GitHub-style heatmap).
        const eightyFourDaysAgo = new Date();
        eightyFourDaysAgo.setUTCHours(0, 0, 0, 0);
        eightyFourDaysAgo.setUTCDate(eightyFourDaysAgo.getUTCDate() - 83);

        const dailyRows = await db
            .select({
                day: sql<string>`to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
                count: sql<number>`count(*)::int`,
            })
            .from(applications)
            .where(and(
                eq(applications.userId, userId),
                sql`created_at >= ${eightyFourDaysAgo.toISOString()}`,
            ))
            .groupBy(sql`to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')`);

        const dailyMap = new Map(dailyRows.map(r => [r.day, r.count]));
        const dailyActivity: Array<{ date: string; count: number }> = [];
        for (let i = 0; i < 84; i++) {
            const d = new Date(eightyFourDaysAgo);
            d.setUTCDate(d.getUTCDate() + i);
            const key = d.toISOString().slice(0, 10);
            dailyActivity.push({ date: key, count: dailyMap.get(key) ?? 0 });
        }

        const payload = {
            total,
            statusCounts: statusMap,
            monthlyApplications,
            recentApplications,
            responseRate,
            successRate,
            funnel,
            responseTimeByCompany,
            upcomingDeadlines,
            followUpCandidates,
            weeklyStreak,
            dailyActivity,
        };

        statsCache.set(userId, { expiresAt: Date.now() + STATS_CACHE_TTL_MS, payload });

        res.status(200).json({ data: payload });
    } catch (error) {
        console.error("[GET /applications/stats] Error:", error);
        res.status(500).json({ error: "Failed to fetch statistics" });
    }
});

// Valid sort fields
const VALID_SORT_FIELDS = ["dateApplied", "createdAt", "company", "position", "status"] as const;

// Get all applications with optional search, filtering, sorting and pagination
router.get("/", async (req, res) => {
    try {
        // Get userId from middleware
        const userId = (req as any).userId as number | undefined;

        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const {
            search,
            status,
            workType,
            priority,
            requiresSponsorship,
            page = "1",
            limit = "10",
            sort = "dateApplied",
            order = "desc",
        } = req.query;

        // Validate and parse pagination params
        const pageNum = parseInt(page as string, 10);
        const limitNum = parseInt(limit as string, 10);

        if (isNaN(pageNum) || pageNum < 1) {
            return res.status(400).json({ error: "Invalid page number" });
        }

        if (isNaN(limitNum) || limitNum < 1) {
            return res.status(400).json({ error: "Invalid limit" });
        }

        const currentPage = pageNum;
        const limitPerPage = Math.min(limitNum, MAX_LIMIT);

        if (limitNum > MAX_LIMIT) {
            // Inform client that limit was capped
            res.setHeader('X-Limit-Capped', 'true');
        }

        const offset = (currentPage - 1) * limitPerPage;

        // Validate sort field
        const sortField = VALID_SORT_FIELDS.includes(sort as typeof VALID_SORT_FIELDS[number])
            ? (sort as string)
            : "dateApplied";

        // Validate sort order
        const sortOrder = (order === "asc" || order === "desc") ? order : "desc";

        // CRITICAL: Always filter by current user's ID first
        const filterConditions = [eq(applications.userId, userId)];

        // If search query exists, filter by company name
        if (search && typeof search === "string") {
            const trimmedSearch = search.trim();
            if (trimmedSearch) {
                filterConditions.push(
                    or(
                        ilike(applications.company, `%${trimmedSearch}%`)
                        //ilike(applications.position, `%${trimmedSearch}%`)
                    )!
                );
            }
        }

        // If status filter exists, validate and match status
        if (status && typeof status === "string") {
            if (!isValidStatus(status)) {
                return res.status(400).json({
                    error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`
                });
            }
            filterConditions.push(eq(applications.status, status));
        }

        if (workType && typeof workType === "string" && VALID_WORK_TYPES.includes(workType as any)) {
            filterConditions.push(eq(applications.workType, workType as any));
        }
        if (priority && typeof priority === "string" && VALID_PRIORITIES.includes(priority as any)) {
            filterConditions.push(eq(applications.priority, priority as any));
        }
        if (requiresSponsorship === "true" || requiresSponsorship === "false") {
            filterConditions.push(eq(applications.requiresSponsorship, requiresSponsorship === "true"));
        }

        // Combine all filters using AND if any exist
        const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;

        // Get total count for pagination
        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(applications)
            .where(whereClause);

        const totalCount = Number(countResult[0]?.count ?? 0);

        // Build dynamic orderBy clause based on sort field and order
        const getOrderByClause = () => {
            const column = sortField === "dateApplied" ? applications.dateApplied
                : sortField === "createdAt" ? applications.createdAt
                    : sortField === "company" ? applications.company
                        : sortField === "position" ? applications.position
                            : sortField === "status" ? applications.status
                                : applications.dateApplied;

            return sortOrder === "asc" ? asc(column) : desc(column);
        };

        // Get applications list with dynamic sorting
        const applicationsList = await db
            .select()
            .from(applications)
            .where(whereClause)
            .orderBy(getOrderByClause())
            .limit(limitPerPage)
            .offset(offset);

        res.status(200).json({
            data: applicationsList,
            pagination: {
                page: currentPage,
                limit: limitPerPage,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limitPerPage),
            },
        });
    } catch (error) {
        console.error("[GET /applications] Error:", error);
        res.status(500).json({ error: "Failed to fetch applications" });
    }
});

// Get a single application by ID
router.get("/:id", async (req, res) => {
    try {
        // Get userId from middleware
        const userId = (req as any).userId as number | undefined;

        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const { id } = req.params;

        // Validate ID
        const appId = parseInt(id, 10);
        if (isNaN(appId)) {
            return res.status(400).json({ error: "Invalid application ID" });
        }

        // Get application AND verify it belongs to current user
        const application = await db
            .select()
            .from(applications)
            .where(and(
                eq(applications.id, appId),
                eq(applications.userId, userId)
            ))
            .limit(1);

        if (!application || application.length === 0) {
            return res.status(404).json({ error: "Application not found" });
        }

        res.status(200).json({ data: application[0] });
    } catch (error) {
        console.error(`[GET /applications/${req.params.id}] Error:`, error);
        res.status(500).json({ error: "Failed to fetch application" });
    }
});

// Create a new application
router.post("/", async (req, res) => {
    try {
        // Get userId from middleware (authenticated user)
        const userId = (req as any).userId as number | undefined;

        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        // Create schema without userId (it comes from auth, not request)
        const createSchemaWithoutUserId = createApplicationSchema.omit({ userId: true });

        // Validate request body with Zod
        const validationResult = createSchemaWithoutUserId.safeParse(req.body);

        if (!validationResult.success) {
            const errors = validationResult.error.issues.map((err) => ({
                field: err.path.join('.'),
                message: err.message
            }));
            return res.status(400).json({
                error: "Validation failed",
                details: errors
            });
        }

        const validatedData = validationResult.data;

        const newApplication = await db
            .insert(applications)
            .values({
                userId: userId, // Use authenticated user's ID
                company: validatedData.company,
                position: validatedData.position,
                status: validatedData.status,
                dateApplied: validatedData.dateApplied || null,
                jobUrl: validatedData.jobUrl || null,
                notes: validatedData.notes || null,
                interviewDate: validatedData.interviewDate || null,
                oaDeadline: validatedData.oaDeadline || null,
                salary: validatedData.salary || null,
                location: validatedData.location || null,
                workType: (validatedData.workType || null) as any,
                requiresSponsorship: validatedData.requiresSponsorship ?? null,
                priority: (validatedData.priority || null) as any,
            })
            .returning();

        invalidateStatsCache(userId);
        res.status(201).json({ data: newApplication[0] });
    } catch (error) {
        console.error("[POST /applications] Error:", error);
        res.status(500).json({ error: "Failed to create application" });
    }
});

// Update an application
router.put("/:id", async (req, res) => {
    try {
        // Get userId from middleware
        const userId = (req as any).userId as number | undefined;

        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const { id } = req.params;

        // Validate ID
        const appId = parseInt(id, 10);
        if (isNaN(appId)) {
            return res.status(400).json({ error: "Invalid application ID" });
        }

        // Validate request body with Zod
        const validationResult = updateApplicationSchema.safeParse(req.body);

        if (!validationResult.success) {
            const errors = validationResult.error.issues.map((err) => ({
                field: err.path.join('.'),
                message: err.message
            }));
            return res.status(400).json({
                error: "Validation failed",
                details: errors
            });
        }

        const validatedData = validationResult.data;

        if (Object.keys(validatedData).length === 0) {
            return res.status(400).json({ error: "No fields to update" });
        }

        // Normalize empty strings on enum-like fields to null and auto-set lastContactAt on status change
        const updatePayload: any = { ...validatedData };
        if (updatePayload.workType === "") updatePayload.workType = null;
        if (updatePayload.priority === "") updatePayload.priority = null;
        if (updatePayload.status) {
            updatePayload.lastContactAt = new Date();
        }

        // Update application AND verify it belongs to current user
        const updatedApplication = await db
            .update(applications)
            .set(updatePayload)
            .where(and(
                eq(applications.id, appId),
                eq(applications.userId, userId)
            ))
            .returning();

        if (!updatedApplication || updatedApplication.length === 0) {
            return res.status(404).json({ error: "Application not found" });
        }

        invalidateStatsCache(userId);
        res.status(200).json({ data: updatedApplication[0] });
    } catch (error) {
        console.error(`[PUT /applications/${req.params.id}] Error:`, error);
        res.status(500).json({ error: "Failed to update application" });
    }
});

// Mark an application as followed up (touches lastContactAt)
router.post("/:id/mark-followed-up", async (req, res) => {
    try {
        const userId = (req as any).userId as number | undefined;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const appId = parseInt(req.params.id, 10);
        if (isNaN(appId)) return res.status(400).json({ error: "Invalid application ID" });

        const updated = await db
            .update(applications)
            .set({ lastContactAt: new Date() })
            .where(and(eq(applications.id, appId), eq(applications.userId, userId)))
            .returning();

        if (!updated.length) return res.status(404).json({ error: "Application not found" });
        invalidateStatsCache(userId);
        return res.status(200).json({ data: updated[0] });
    } catch (error) {
        console.error("[POST mark-followed-up] Error:", error);
        return res.status(500).json({ error: "Failed to mark as followed up" });
    }
});

// Delete an application
router.delete("/:id", async (req, res) => {
    try {
        // Get userId from middleware
        const userId = (req as any).userId as number | undefined;

        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const { id } = req.params;

        // Validate ID
        const appId = parseInt(id, 10);
        if (isNaN(appId)) {
            return res.status(400).json({ error: "Invalid application ID" });
        }

        // Delete application AND verify it belongs to current user
        const deletedApplication = await db
            .delete(applications)
            .where(and(
                eq(applications.id, appId),
                eq(applications.userId, userId)
            ))
            .returning();

        if (!deletedApplication || deletedApplication.length === 0) {
            return res.status(404).json({ error: "Application not found" });
        }

        invalidateStatsCache(userId);
        res.status(200).json({ data: deletedApplication[0] });
    } catch (error) {
        console.error(`[DELETE /applications/${req.params.id}] Error:`, error);
        res.status(500).json({ error: "Failed to delete application" });
    }
});

export default router;
