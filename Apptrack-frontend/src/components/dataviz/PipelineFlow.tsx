import React from 'react';
import { ArrowRight } from 'lucide-react';
import { statusColors } from '@/constants';
import type { ApplicationStatus } from '@/types';

type Stage = {
    key: ApplicationStatus;
    label: string;
    short: string;
    count: number;
    conv?: number;
};

type Props = {
    stages: Stage[];
    rejected: number;
    withdrawn: number;
};

/**
 * Signature visual: horizontal stage cards with conversion arrows between them.
 * Designed to handle every data shape: zero, one, or many applications.
 * Each card has the status color as a left stripe, big mono count, and a percent-of-total bar.
 */
export const PipelineFlow: React.FC<Props> = ({ stages, rejected, withdrawn }) => {
    const totalReached = stages[0]?.count || 0;

    return (
        <div className="w-full">
            {/* Stage cards + connectors */}
            <div className="flex items-stretch gap-2 md:gap-3 overflow-x-auto pb-1">
                {stages.map((stage, i) => {
                    const color = statusColors[stage.key];
                    const pctOfTotal = totalReached > 0 ? Math.round((stage.count / totalReached) * 100) : 0;
                    const isOffer = stage.key === 'Offer' && stage.count > 0;

                    return (
                        <React.Fragment key={stage.key}>
                            <div
                                className={`relative flex-1 min-w-[140px] rounded-xl border bg-card p-4 md:p-5 transition-all hover:border-foreground/20 ${isOffer ? 'ring-1 ring-emerald-500/30 shadow-[0_0_24px_-6px_rgba(34,197,94,0.35)]' : ''
                                    }`}
                            >
                                {/* Left status accent */}
                                <span
                                    className="absolute left-0 top-3 bottom-3 w-1 rounded-full"
                                    style={{ backgroundColor: color }}
                                />

                                {/* Stage header */}
                                <div className="flex items-center justify-between">
                                    <span
                                        className="font-mono text-[10px] uppercase tracking-[0.18em] font-semibold"
                                        style={{ color }}
                                    >
                                        {stage.label}
                                    </span>
                                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
                                        {stage.short}
                                    </span>
                                </div>

                                {/* Big count */}
                                <p
                                    className="font-mono text-5xl md:text-6xl font-bold tabular-nums leading-none mt-3"
                                    style={{ color }}
                                >
                                    {stage.count}
                                </p>

                                {/* % of total bar */}
                                <div className="mt-4">
                                    <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                                        <span>of total</span>
                                        <span className="tabular-nums">{pctOfTotal}%</span>
                                    </div>
                                    <div className="h-1 mt-1 bg-muted/50 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-700"
                                            style={{
                                                width: `${Math.max(pctOfTotal, 2)}%`,
                                                backgroundColor: color,
                                                opacity: stage.count === 0 ? 0.2 : 1,
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Connector */}
                            {i < stages.length - 1 && (
                                <Connector conv={stages[i + 1]?.conv ?? 0} />
                            )}
                        </React.Fragment>
                    );
                })}
            </div>

            {/* Terminal states footer */}
            {(rejected > 0 || withdrawn > 0) && (
                <div className="mt-5 pt-4 border-t border-dashed border-border flex items-center gap-6 flex-wrap">
                    {rejected > 0 && (
                        <TerminalStat
                            label="rejected"
                            count={rejected}
                            color={statusColors.Rejected}
                        />
                    )}
                    {withdrawn > 0 && (
                        <TerminalStat
                            label="withdrawn"
                            count={withdrawn}
                            color={statusColors.Withdrawn}
                        />
                    )}
                </div>
            )}
        </div>
    );
};

const Connector: React.FC<{ conv: number }> = ({ conv }) => {
    return (
        <div className="hidden md:flex flex-col items-center justify-center px-1 self-stretch w-12 shrink-0">
            <span className="font-mono text-[11px] font-semibold text-foreground/80 tabular-nums mb-1.5">
                {conv}%
            </span>
            <div className="relative w-full h-px bg-border">
                <ArrowRight className="absolute right-[-6px] top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            </div>
            <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/60 mt-1.5">
                conv
            </span>
        </div>
    );
};

const TerminalStat: React.FC<{ label: string; count: number; color: string }> = ({ label, count, color }) => (
    <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {label}
        </span>
        <span className="font-mono text-sm font-bold tabular-nums">{count}</span>
    </div>
);
