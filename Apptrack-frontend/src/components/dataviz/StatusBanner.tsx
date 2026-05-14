import React from 'react';
import { Link } from 'react-router';

export type StatusFact = {
    label: string;
    /** Optional href to drill in */
    to?: string;
    /** Optional accent color for the value */
    tone?: 'normal' | 'success' | 'warn' | 'danger';
};

type Props = {
    facts: StatusFact[];
};

const toneClass = {
    normal: 'text-foreground',
    success: 'text-emerald-500',
    warn: 'text-amber-500',
    danger: 'text-destructive',
};

/**
 * Slim status line at the top of the dashboard. Compact, scannable, mono.
 *   // status   1 interview today · 4 apps this week · 2 follow-ups overdue
 */
export const StatusBanner: React.FC<Props> = ({ facts }) => {
    return (
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg border bg-card/60 backdrop-blur-sm overflow-x-auto">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground shrink-0">
                // status
            </span>
            <div className="flex items-center gap-1.5 font-mono text-xs">
                {facts.length === 0 ? (
                    <span className="text-muted-foreground">all quiet</span>
                ) : (
                    facts.map((f, i) => {
                        const inner = (
                            <span className={`${toneClass[f.tone || 'normal']} font-medium`}>
                                {f.label}
                            </span>
                        );
                        return (
                            <React.Fragment key={i}>
                                {i > 0 && <span className="text-muted-foreground/40">·</span>}
                                {f.to ? (
                                    <Link
                                        to={f.to}
                                        className="hover:underline underline-offset-4 decoration-muted-foreground/40"
                                    >
                                        {inner}
                                    </Link>
                                ) : (
                                    inner
                                )}
                            </React.Fragment>
                        );
                    })
                )}
            </div>
        </div>
    );
};
