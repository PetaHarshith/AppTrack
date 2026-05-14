import {
    pgTable,
    pgEnum,
    integer,
    varchar,
    text,
    timestamp,
    date,
    boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// reusable timestamps
const timestamps = {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
        .defaultNow()
        .$onUpdate(() => new Date())
        .notNull(),
};

// status enum
export const applicationStatusEnum = pgEnum("application_status", [
    "Applied",
    "OA",
    "Interview",
    "Offer",
    "Rejected",
    "Withdrawn",
]);

export const workTypeEnum = pgEnum("work_type", [
    "Internship",
    "FullTime",
    "Coop",
    "Contract",
]);

export const priorityEnum = pgEnum("priority", [
    "Dream",
    "Target",
    "Safety",
]);

export const applicationSourceEnum = pgEnum("application_source", [
    "manual",
    "email",
    "url_import",
]);

// users table
export const users = pgTable("users", {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),

    authUserId: varchar("auth_user_id", { length: 255 }).notNull().unique(),

    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 120 }),

    weeklyGoal: integer("weekly_goal").default(5).notNull(),

    ...timestamps,
});

// applications table
export const applications = pgTable("applications", {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),

    userId: integer("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),

    company: varchar("company", { length: 120 }).notNull(),
    position: varchar("position", { length: 150 }).notNull(),

    status: applicationStatusEnum("status").notNull().default("Applied"),
    dateApplied: date("date_applied"),

    jobUrl: text("job_url"),
    notes: text("notes"),

    interviewDate: date("interview_date"),
    oaDeadline: date("oa_deadline"),
    salary: varchar("salary", { length: 120 }),
    location: varchar("location", { length: 120 }),
    workType: workTypeEnum("work_type"),
    requiresSponsorship: boolean("requires_sponsorship"),
    priority: priorityEnum("priority"),
    lastContactAt: timestamp("last_contact_at"),

    // Tracking the origin of an application, plus a review queue flag for auto-imports.
    source: applicationSourceEnum("source").notNull().default("manual"),
    needsReview: boolean("needs_review").default(false).notNull(),
    // If imported from email, the Gmail message id — used to dedupe across syncs.
    externalId: varchar("external_id", { length: 255 }),

    ...timestamps,
});

export const usersRelations = relations(users, ({ many }) => ({
    applications: many(applications),
}));

export const applicationsRelations = relations(applications, ({ one }) => ({
    user: one(users, {
        fields: [applications.userId],
        references: [users.id],
    }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Application = typeof applications.$inferSelect;
export type NewApplication = typeof applications.$inferInsert;