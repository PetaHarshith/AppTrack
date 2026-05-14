export const APPLICATION_STATUSES = ['Applied', 'OA', 'Interview', 'Offer', 'Rejected', 'Withdrawn'] as const;

export const APPLICATION_STATUS_OPTIONS = APPLICATION_STATUSES.map((status) => ({
    value: status,
    label: status,
}));

export const WORK_TYPES = ['Internship', 'FullTime', 'Coop', 'Contract'] as const;
export const WORK_TYPE_OPTIONS = [
    { value: 'Internship', label: 'Internship' },
    { value: 'FullTime', label: 'Full-Time' },
    { value: 'Coop', label: 'Co-op' },
    { value: 'Contract', label: 'Contract' },
];

export const PRIORITIES = ['Dream', 'Target', 'Safety'] as const;
export const PRIORITY_OPTIONS = PRIORITIES.map((p) => ({ value: p, label: p }));

/**
 * URL handling:
 *   - In local dev: VITE_BACKEND_URL=http://localhost:8000 → fetches hit the standalone Express server.
 *   - In production (Vercel): VITE_BACKEND_URL is unset; we fall back to the current window origin
 *     so requests go to the same Vercel deployment that serves the frontend.
 *
 * BACKEND_URL is the bare origin (used by better-auth which appends its own /api/auth/... path).
 * API_URL is the path-prefixed URL used by the app's own fetch calls.
 */
const RAW_BACKEND =
    (import.meta.env.VITE_BACKEND_URL as string | undefined) ??
    (typeof window !== 'undefined' ? window.location.origin : '');

export const BACKEND_URL = RAW_BACKEND;
export const API_URL = `${RAW_BACKEND}/api`;

export { statusColors, statusIcons, statusIconsLarge, statusChartConfig } from './status';