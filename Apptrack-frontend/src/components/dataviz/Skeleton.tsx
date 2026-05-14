import React from 'react';

type Props = {
    className?: string;
    children?: React.ReactNode;
};

/**
 * Shimmer skeleton block. Pair with `animate-pulse` from Tailwind, or wrap children
 * for the dashboard loading layout shape.
 */
export const Skeleton: React.FC<Props> = ({ className = '', children }) => {
    return (
        <div
            className={`relative overflow-hidden rounded bg-muted/40 ${className}`}
            aria-hidden
        >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/[0.04] to-transparent animate-shimmer" />
            {children}
        </div>
    );
};

/**
 * Layout-shape-matching loading state for the dashboard.
 * Worth more than a generic spinner: it tells the user where things will be.
 */
export const DashboardSkeleton: React.FC = () => {
    return (
        <div className="p-4 md:p-6 space-y-8 max-w-[1400px] mx-auto w-full animate-pulse">
            {/* Header */}
            <div className="flex items-end justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-9 w-64" />
                    <Skeleton className="h-4 w-80" />
                </div>
                <Skeleton className="h-9 w-36 rounded-md" />
            </div>
            {/* Status banner */}
            <Skeleton className="h-9 w-full rounded-lg" />
            {/* KPI strip */}
            <div className="grid grid-cols-4 border-y divide-x divide-border">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="px-4 py-5 space-y-2">
                        <Skeleton className="h-2.5 w-16" />
                        <Skeleton className="h-7 w-20" />
                    </div>
                ))}
            </div>
            {/* Pipeline area */}
            <Skeleton className="h-72 w-full rounded-xl" />
            {/* Activity heatmap */}
            <Skeleton className="h-48 w-full rounded-xl" />
            {/* Two-column row */}
            <div className="grid lg:grid-cols-3 gap-6">
                <Skeleton className="h-80 lg:col-span-2 rounded-xl" />
                <Skeleton className="h-80 rounded-xl" />
            </div>
        </div>
    );
};
