import React from 'react';
import { Send, FileText, Briefcase, Award, XCircle, Clock } from 'lucide-react';
import type { ApplicationStatus } from '@/types';

export const statusColors: Record<ApplicationStatus, string> = {
    Applied: 'var(--chart-1)',
    OA: 'var(--chart-4)',
    Interview: 'var(--chart-2)',
    Offer: '#22c55e',
    Rejected: 'var(--chart-3)',
    Withdrawn: 'var(--chart-5)',
};

export const statusIcons: Record<ApplicationStatus, React.ReactNode> = {
    Applied: <Send className="h-3 w-3" />,
    OA: <FileText className="h-3 w-3" />,
    Interview: <Briefcase className="h-3 w-3" />,
    Offer: <Award className="h-3 w-3" />,
    Rejected: <XCircle className="h-3 w-3" />,
    Withdrawn: <Clock className="h-3 w-3" />,
};

export const statusIconsLarge: Record<ApplicationStatus, React.ReactNode> = {
    Applied: <Send className="h-4 w-4" />,
    OA: <FileText className="h-4 w-4" />,
    Interview: <Briefcase className="h-4 w-4" />,
    Offer: <Award className="h-4 w-4" />,
    Rejected: <XCircle className="h-4 w-4" />,
    Withdrawn: <Clock className="h-4 w-4" />,
};

export const statusChartConfig = {
    Applied: { label: 'Applied', color: 'var(--chart-1)' },
    OA: { label: 'Online Assessment', color: 'var(--chart-4)' },
    Interview: { label: 'Interview', color: 'var(--chart-2)' },
    Offer: { label: 'Offer', color: '#22c55e' },
    Rejected: { label: 'Rejected', color: 'var(--chart-3)' },
    Withdrawn: { label: 'Withdrawn', color: 'var(--chart-5)' },
    count: { label: 'Applications', color: 'var(--primary)' },
};
