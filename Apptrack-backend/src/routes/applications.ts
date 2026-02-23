import express from "express";
import {and, desc, eq, ilike, or, sql} from "drizzle-orm";
import {applications} from "../db/schema";
import {db} from "../db";

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

// Get all applications with optional search, filtering and pagination
router.get("/", async (req, res) => {
    try {
        const {search, status, page = "1", limit = "10"} = req.query;

        // Validate and parse pagination params
        const pageNum = parseInt(page as string, 10);
        const limitNum = parseInt(limit as string, 10);

        if (isNaN(pageNum) || pageNum < 1) {
            return res.status(400).json({error: "Invalid page number"});
        }

        if (isNaN(limitNum) || limitNum < 1) {
            return res.status(400).json({error: "Invalid limit"});
        }

        const currentPage = pageNum;
        const limitPerPage = Math.min(limitNum, MAX_LIMIT);

        if (limitNum > MAX_LIMIT) {
            // Inform client that limit was capped
            res.setHeader('X-Limit-Capped', 'true');
        }

        const offset = (currentPage - 1) * limitPerPage;

        const filterConditions = [];

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

        // Combine all filters using AND if any exist
        const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;

        // Get total count for pagination
        const countResult = await db
            .select({count: sql<number>`count(*)`})
            .from(applications)
            .where(whereClause);

        const totalCount = Number(countResult[0]?.count ?? 0);

        // Get applications list
        const applicationsList = await db
            .select()
            .from(applications)
            .where(whereClause)
            .orderBy(desc(applications.createdAt))
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
        res.status(500).json({error: "Failed to fetch applications"});
    }
});

// Get a single application by ID
router.get("/:id", async (req, res) => {
    try {
        const {id} = req.params;

        // Validate ID
        const appId = parseInt(id, 10);
        if (isNaN(appId)) {
            return res.status(400).json({error: "Invalid application ID"});
        }

        const application = await db
            .select()
            .from(applications)
            .where(eq(applications.id, appId))
            .limit(1);

        if (!application || application.length === 0) {
            return res.status(404).json({error: "Application not found"});
        }

        res.status(200).json({data: application[0]});
    } catch (error) {
        console.error(`[GET /applications/${req.params.id}] Error:`, error);
        res.status(500).json({error: "Failed to fetch application"});
    }
});

// Create a new application
router.post("/", async (req, res) => {
    try {
        const {userId, company, position, status, dateApplied, jobUrl, notes} = req.body;

        // Validate required fields exist
        if (!userId || !company || !position) {
            return res.status(400).json({
                error: "Missing required fields: userId, company, and position are required"
            });
        }

        // Validate field types
        if (typeof userId !== "number") {
            return res.status(400).json({error: "userId must be a number"});
        }
        if (typeof company !== "string" || company.trim().length === 0) {
            return res.status(400).json({error: "company must be a non-empty string"});
        }
        if (typeof position !== "string" || position.trim().length === 0) {
            return res.status(400).json({error: "position must be a non-empty string"});
        }

        // Validate status if provided
        if (status !== undefined && status !== null) {
            if (typeof status !== "string" || !isValidStatus(status)) {
                return res.status(400).json({
                    error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`
                });
            }
        }

        // Validate dateApplied if provided
        if (dateApplied !== undefined && dateApplied !== null) {
            if (typeof dateApplied !== "string" || !isValidDate(dateApplied)) {
                return res.status(400).json({
                    error: "dateApplied must be a valid date in YYYY-MM-DD format"
                });
            }
        }

        // Validate jobUrl if provided
        if (jobUrl !== undefined && jobUrl !== null && typeof jobUrl !== "string") {
            return res.status(400).json({error: "jobUrl must be a string"});
        }

        // Validate notes if provided
        if (notes !== undefined && notes !== null && typeof notes !== "string") {
            return res.status(400).json({error: "notes must be a string"});
        }

        const newApplication = await db
            .insert(applications)
            .values({
                userId,
                company: company.trim(),
                position: position.trim(),
                status: status || "Applied",
                dateApplied: dateApplied || null,
                jobUrl: jobUrl || null,
                notes: notes || null,
            })
            .returning();

        res.status(201).json({data: newApplication[0]});
    } catch (error) {
        console.error("[POST /applications] Error:", error);
        res.status(500).json({error: "Failed to create application"});
    }
});

// Update an application
router.put("/:id", async (req, res) => {
    try {
        const {id} = req.params;
        const {company, position, status, dateApplied, jobUrl, notes} = req.body;

        // Validate ID
        const appId = parseInt(id, 10);
        if (isNaN(appId)) {
            return res.status(400).json({error: "Invalid application ID"});
        }

        // Check if there's anything to update
        const updateData: any = {};

        // Validate and add company if provided
        if (company !== undefined) {
            if (typeof company !== "string" || company.trim().length === 0) {
                return res.status(400).json({error: "company must be a non-empty string"});
            }
            updateData.company = company.trim();
        }

        // Validate and add position if provided
        if (position !== undefined) {
            if (typeof position !== "string" || position.trim().length === 0) {
                return res.status(400).json({error: "position must be a non-empty string"});
            }
            updateData.position = position.trim();
        }

        // Validate and add status if provided
        if (status !== undefined) {
            if (typeof status !== "string" || !isValidStatus(status)) {
                return res.status(400).json({
                    error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`
                });
            }
            updateData.status = status;
        }

        // Validate and add dateApplied if provided
        if (dateApplied !== undefined) {
            if (dateApplied !== null && (typeof dateApplied !== "string" || !isValidDate(dateApplied))) {
                return res.status(400).json({
                    error: "dateApplied must be null or a valid date in YYYY-MM-DD format"
                });
            }
            updateData.dateApplied = dateApplied;
        }

        // Validate and add jobUrl if provided
        if (jobUrl !== undefined) {
            if (jobUrl !== null && typeof jobUrl !== "string") {
                return res.status(400).json({error: "jobUrl must be null or a string"});
            }
            updateData.jobUrl = jobUrl;
        }

        // Validate and add notes if provided
        if (notes !== undefined) {
            if (notes !== null && typeof notes !== "string") {
                return res.status(400).json({error: "notes must be null or a string"});
            }
            updateData.notes = notes;
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({error: "No fields to update"});
        }

        const updatedApplication = await db
            .update(applications)
            .set(updateData)
            .where(eq(applications.id, appId))
            .returning();

        if (!updatedApplication || updatedApplication.length === 0) {
            return res.status(404).json({error: "Application not found"});
        }

        res.status(200).json({data: updatedApplication[0]});
    } catch (error) {
        console.error(`[PUT /applications/${req.params.id}] Error:`, error);
        res.status(500).json({error: "Failed to update application"});
    }
});

// Delete an application
router.delete("/:id", async (req, res) => {
    try {
        const {id} = req.params;

        // Validate ID
        const appId = parseInt(id, 10);
        if (isNaN(appId)) {
            return res.status(400).json({error: "Invalid application ID"});
        }

        const deletedApplication = await db
            .delete(applications)
            .where(eq(applications.id, appId))
            .returning();

        if (!deletedApplication || deletedApplication.length === 0) {
            return res.status(404).json({error: "Application not found"});
        }

        res.status(200).json({data: deletedApplication[0]});
    } catch (error) {
        console.error(`[DELETE /applications/${req.params.id}] Error:`, error);
        res.status(500).json({error: "Failed to delete application"});
    }
});

export default router;

