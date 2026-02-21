export const APPLICATION_STATUSES = ['Applied', 'OA', 'Interview', 'Offer', 'Rejected', 'Withdrawn'] as const;

export const APPLICATION_STATUS_OPTIONS = APPLICATION_STATUSES.map((status) => ({
    value: status,
    label: status,
}));