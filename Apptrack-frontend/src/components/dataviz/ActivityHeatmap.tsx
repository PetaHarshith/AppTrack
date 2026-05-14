import React, { useMemo, useState } from 'react';

type DayCell = { date: string; count: number };

type Props = {
    /** 84 day-level entries ending today. Backend returns this in `/stats.dailyActivity`. */
    data: DayCell[];
    cellSize?: number;
    gap?: number;
    colorBase?: string;
};

type HoverState = {
    date: string;
    count: number;
    x: number;
    y: number;
    pinned: boolean;
};

const DOW_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

const formatDate = (iso: string): string => {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    });
};

/**
 * GitHub-style contribution heatmap with interactive tooltip on hover + click-to-pin.
 */
export const ActivityHeatmap: React.FC<Props> = ({
    data,
    cellSize = 18,
    gap = 4,
    colorBase = 'var(--primary)',
}) => {
    const [hover, setHover] = useState<HoverState | null>(null);

    const { grid, weekLabels, max, totalApps, busiestDay } = useMemo(() => {
        if (!data || data.length === 0) {
            return {
                grid: [] as Array<DayCell | null>[],
                weekLabels: [] as Array<{ x: number; label: string }>,
                max: 1,
                totalApps: 0,
                busiestDay: null as DayCell | null,
            };
        }
        const firstDate = new Date(data[0]!.date + 'T00:00:00');
        const firstWeekday = firstDate.getDay();
        const padded: Array<DayCell | null> = Array(firstWeekday).fill(null).concat(data);
        while (padded.length % 7 !== 0) padded.push(null);
        const cols = padded.length / 7;
        const grid: Array<DayCell | null>[] = Array.from({ length: 7 }, () => Array(cols).fill(null));
        for (let i = 0; i < padded.length; i++) {
            const col = Math.floor(i / 7);
            const row = i % 7;
            grid[row]![col] = padded[i] ?? null;
        }
        const seenMonths = new Set<string>();
        const weekLabels: Array<{ x: number; label: string }> = [];
        for (let c = 0; c < cols; c++) {
            for (let r = 0; r < 7; r++) {
                const cell = grid[r]![c];
                if (!cell) continue;
                const d = new Date(cell.date + 'T00:00:00');
                const monthKey = `${d.getFullYear()}-${d.getMonth()}`;
                if (!seenMonths.has(monthKey)) {
                    seenMonths.add(monthKey);
                    weekLabels.push({
                        x: c * (cellSize + gap),
                        label: d.toLocaleString('en-US', { month: 'short' }),
                    });
                }
                break;
            }
        }
        const max = Math.max(...data.map(d => d.count), 1);
        const totalApps = data.reduce((s, d) => s + d.count, 0);
        const busiest = data.reduce((b, d) => (d.count > (b?.count ?? 0) ? d : b), null as DayCell | null);
        return { grid, weekLabels, max, totalApps, busiestDay: busiest };
    }, [data, cellSize, gap]);

    const cols = grid[0]?.length ?? 0;
    const labelGutter = 30;
    const monthBand = 18;
    const width = cols * (cellSize + gap) + labelGutter;
    const height = 7 * (cellSize + gap) + monthBand;

    const intensity = (count: number): number => {
        if (count === 0) return 0;
        const ratio = count / max;
        if (ratio > 0.66) return 3;
        if (ratio > 0.33) return 2;
        return 1;
    };

    const bucketFill = (bucket: number): { fill: string; stroke?: string } => {
        if (bucket === 0) return { fill: 'var(--muted)', stroke: 'var(--border)' };
        if (bucket === 1) return { fill: `color-mix(in oklab, ${colorBase} 35%, transparent)` };
        if (bucket === 2) return { fill: `color-mix(in oklab, ${colorBase} 65%, transparent)` };
        return { fill: colorBase };
    };

    const handleCellEnter = (cell: DayCell, event: React.MouseEvent<SVGRectElement>) => {
        if (hover?.pinned) return;
        const rect = event.currentTarget.getBoundingClientRect();
        setHover({
            date: cell.date,
            count: cell.count,
            x: rect.left + rect.width / 2,
            y: rect.top,
            pinned: false,
        });
    };

    const handleCellClick = (cell: DayCell, event: React.MouseEvent<SVGRectElement>) => {
        event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        // Toggle pin: re-clicking the pinned cell unpins it; clicking a different one re-pins.
        if (hover?.pinned && hover.date === cell.date) {
            setHover(null);
            return;
        }
        setHover({
            date: cell.date,
            count: cell.count,
            x: rect.left + rect.width / 2,
            y: rect.top,
            pinned: true,
        });
    };

    const handleSvgLeave = () => {
        if (!hover?.pinned) setHover(null);
    };

    // Click-anywhere dismisses a pinned tooltip
    React.useEffect(() => {
        if (!hover?.pinned) return;
        const onDocClick = () => setHover(null);
        // Defer so the click that pinned doesn't immediately unpin
        const t = setTimeout(() => document.addEventListener('click', onDocClick, { once: true }), 0);
        return () => {
            clearTimeout(t);
            document.removeEventListener('click', onDocClick);
        };
    }, [hover?.pinned, hover?.date]);

    const busiestLabel = busiestDay
        ? new Date(busiestDay.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : null;

    return (
        <div className="space-y-3 relative">
            {/* Headline numbers */}
            <div className="flex items-baseline gap-6 flex-wrap">
                <div>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">apps · 12 wks</p>
                    <p className="font-mono text-2xl font-bold tabular-nums mt-0.5">{totalApps}</p>
                </div>
                <div>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">peak day</p>
                    <p className="font-mono text-2xl font-bold tabular-nums mt-0.5">
                        {busiestDay && busiestDay.count > 0 ? busiestDay.count : 0}
                        {busiestLabel && busiestDay && busiestDay.count > 0 && (
                            <span className="text-sm font-normal text-muted-foreground ml-2">on {busiestLabel}</span>
                        )}
                    </p>
                </div>
            </div>

            {/* Grid */}
            <div className="overflow-x-auto">
                <svg
                    width={width}
                    height={height}
                    className="block"
                    onMouseLeave={handleSvgLeave}
                >
                    {weekLabels.map((m, i) => (
                        <text
                            key={`${m.label}-${i}`}
                            x={m.x + labelGutter}
                            y={12}
                            className="font-mono fill-current text-muted-foreground"
                            style={{ fontSize: 10 }}
                        >
                            {m.label}
                        </text>
                    ))}
                    {DOW_LABELS.map((label, r) => (
                        <text
                            key={r}
                            x={0}
                            y={monthBand + r * (cellSize + gap) + cellSize - 4}
                            className="font-mono fill-current text-muted-foreground"
                            style={{ fontSize: 10 }}
                        >
                            {label}
                        </text>
                    ))}
                    {grid.map((row, r) =>
                        row.map((cell, c) => {
                            if (!cell) return null;
                            const bucket = intensity(cell.count);
                            const { fill, stroke } = bucketFill(bucket);
                            const isHovered = hover?.date === cell.date;
                            return (
                                <rect
                                    key={`${r}-${c}`}
                                    x={labelGutter + c * (cellSize + gap)}
                                    y={monthBand + r * (cellSize + gap)}
                                    width={cellSize}
                                    height={cellSize}
                                    rx={3}
                                    fill={fill}
                                    stroke={isHovered ? 'var(--foreground)' : stroke}
                                    strokeWidth={isHovered ? 1.5 : stroke ? 1 : 0}
                                    style={{ cursor: 'pointer' }}
                                    onMouseEnter={(e) => handleCellEnter(cell, e)}
                                    onClick={(e) => handleCellClick(cell, e)}
                                />
                            );
                        })
                    )}
                </svg>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <span>each cell = one day · click to pin</span>
                <div className="flex items-center gap-1.5">
                    <span>less</span>
                    {[0, 1, 2, 3].map((b) => {
                        const { fill, stroke } = bucketFill(b);
                        return (
                            <span
                                key={b}
                                className="inline-block w-3.5 h-3.5 rounded-sm"
                                style={{ backgroundColor: fill, border: stroke ? `1px solid ${stroke}` : 'none' }}
                            />
                        );
                    })}
                    <span>more</span>
                </div>
            </div>

            {/* Tooltip */}
            {hover && (
                <div
                    role="tooltip"
                    className="fixed z-50 px-3 py-2 rounded-md border bg-popover text-popover-foreground shadow-lg pointer-events-none"
                    style={{
                        left: hover.x,
                        top: hover.y - 8,
                        transform: 'translate(-50%, -100%)',
                    }}
                >
                    <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        {formatDate(hover.date)}
                    </p>
                    <p className="font-mono text-base font-bold tabular-nums mt-0.5">
                        {hover.count} application{hover.count === 1 ? '' : 's'}
                        {hover.pinned && (
                            <span className="ml-2 text-[10px] font-normal uppercase tracking-wider text-muted-foreground">
                                pinned
                            </span>
                        )}
                    </p>
                    {/* Pointer arrow */}
                    <span
                        className="absolute left-1/2 -bottom-1.5 w-2.5 h-2.5 rotate-45 bg-popover border-r border-b -translate-x-1/2"
                    />
                </div>
            )}
        </div>
    );
};
