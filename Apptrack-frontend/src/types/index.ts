export type Application = {
    id: number;
    userId: number;
    company: string;
    position: string;
    status: 'Applied' | 'OA' | 'Interview' | 'Offer' | 'Rejected' | 'Withdrawn';
    dateApplied: string | null;
    jobUrl: string | null;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
}