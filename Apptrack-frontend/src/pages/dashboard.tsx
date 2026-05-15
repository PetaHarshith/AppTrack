import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    ArrowRight,
    Pencil,
    Plus,
    ChevronRight,
    Sparkles,
    Zap,
} from 'lucide-react'
import { API_URL, statusColors } from '@/constants'
import type { ApplicationStatus } from '@/types'
import { toast } from 'sonner'
import { ActivityHeatmap } from '@/components/dataviz/ActivityHeatmap'
import { DashboardSkeleton } from '@/components/dataviz/Skeleton'
import { cn } from '@/lib/utils'

type StatsData = {
    total: number;
    statusCounts: Record<string, number>;
    monthlyApplications: Array<{ month: string; count: number }>;
    recentApplications: Array<{
        id: number;
        company: string;
        position: string;
        status: string;
        dateApplied: string | null;
        createdAt: string;
    }>;
    responseRate: number;
    successRate: number;
    funnel: Array<{ stage: string; count: number; conversionFromPrev: number }>;
    responseTimeByCompany: Array<{ company: string; avgDays: number; count: number }>;
    upcomingDeadlines: Array<{ id: number; company: string; position: string; type: 'Interview' | 'OA Deadline'; date: string }>;
    followUpCandidates: Array<{ id: number; company: string; position: string; daysSinceContact: number }>;
    weeklyStreak: { currentWeekCount: number; goal: number; weeks: Array<{ weekStart: string; count: number }> };
    dailyActivity: Array<{ date: string; count: number }>;
}

// Pipeline stages — always rendered in this order so the grid is visually
// stable even when some statuses are at zero.
const pipelineStages: { key: ApplicationStatus; label: string }[] = [
    { key: 'Applied', label: 'Applied' },
    { key: 'OA', label: 'OA' },
    { key: 'Interview', label: 'Interview' },
    { key: 'Offer', label: 'Offer' },
];

const SectionLabel = ({ label }: { label: string }) => (
    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        // {label}
    </p>
);

const Dashboard = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState<StatsData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [editingGoal, setEditingGoal] = useState(false)
    const [goalInput, setGoalInput] = useState<number>(5)

    const fetchStats = async () => {
        try {
            const response = await fetch(`${API_URL}/applications/stats`, {
                credentials: 'include'
            })
            if (!response.ok) throw new Error('Failed to fetch stats')
            const data = await response.json()
            setStats(data.data)
            setGoalInput(data.data.weeklyStreak?.goal ?? 5)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchStats()
    }, [])

    const handleSaveGoal = async () => {
        try {
            const res = await fetch(`${API_URL}/users/me`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ weeklyGoal: goalInput }),
            })
            if (!res.ok) throw new Error()
            toast.success('Goal updated')
            setEditingGoal(false)
            fetchStats()
        } catch {
            toast.error('Failed to save goal')
        }
    }

    const handleMarkFollowedUp = async (id: number) => {
        try {
            const res = await fetch(`${API_URL}/applications/${id}/mark-followed-up`, {
                method: 'POST',
                credentials: 'include',
            })
            if (!res.ok) throw new Error()
            toast.success('Marked as followed up')
            setStats(prev => prev ? {
                ...prev,
                followUpCandidates: prev.followUpCandidates.filter(c => c.id !== id),
            } : prev)
        } catch {
            toast.error('Failed to update')
        }
    }

    // Action queue: combined deadlines + follow-ups
    const attentionItems = useMemo(() => {
        if (!stats) return [];
        const items: Array<
            | { kind: 'deadline'; id: number; company: string; position: string; type: string; date: string; days: number }
            | { kind: 'followup'; id: number; company: string; position: string; days: number }
        > = [];
        for (const d of stats.upcomingDeadlines || []) {
            const date = new Date(d.date + 'T00:00:00');
            const days = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            items.push({ kind: 'deadline', id: d.id, company: d.company, position: d.position, type: d.type, date: d.date, days });
        }
        for (const c of stats.followUpCandidates || []) {
            items.push({ kind: 'followup', id: c.id, company: c.company, position: c.position, days: c.daysSinceContact });
        }
        items.sort((a, b) => {
            if (a.kind !== b.kind) return a.kind === 'deadline' ? -1 : 1;
            if (a.kind === 'deadline' && b.kind === 'deadline') return a.days - b.days;
            return (b as any).days - (a as any).days;
        });
        return items.slice(0, 7);
    }, [stats]);

    if (loading) {
        return <DashboardSkeleton />
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <p className="text-destructive">{error}</p>
            </div>
        )
    }

    if (!stats) return null

    const greeting = (() => {
        const h = new Date().getHours();
        if (h < 12) return 'Good morning';
        if (h < 18) return 'Good afternoon';
        return 'Good evening';
    })();

    const pendingCount = (stats.statusCounts['Applied'] || 0) +
        (stats.statusCounts['OA'] || 0) +
        (stats.statusCounts['Interview'] || 0)

    const offerCount = stats.statusCounts['Offer'] || 0;
    const weeklyMax = Math.max(...stats.weeklyStreak.weeks.map(w => w.count), stats.weeklyStreak.goal, 1);

    // Today summary used by the hero one-liner
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayInterviews = (stats.upcomingDeadlines || []).filter(d => d.type === 'Interview' && d.date === todayStr).length;
    const todayOAs = (stats.upcomingDeadlines || []).filter(d => d.type === 'OA Deadline' && d.date === todayStr).length;
    const overdueFollowups = (stats.followUpCandidates || []).length;

    const activeCount = (stats.statusCounts['Applied'] || 0)
        + (stats.statusCounts['OA'] || 0)
        + (stats.statusCounts['Interview'] || 0);
    const rejectedCount = stats.statusCounts['Rejected'] || 0;
    const withdrawnCount = stats.statusCounts['Withdrawn'] || 0;

    // Hero one-liner: tells you the single most relevant thing today.
    const summary = (() => {
        if (stats.total === 0) return "No applications yet. Track your first to see things light up.";
        if (todayInterviews > 0) return `Interview${todayInterviews > 1 ? 's' : ''} on the calendar today. Show up sharp.`;
        if (todayOAs > 0) return `OA${todayOAs > 1 ? 's' : ''} due today. Don't let it slip.`;
        if (offerCount > 0) return `${offerCount} live offer${offerCount > 1 ? 's' : ''}. ${activeCount > 0 ? `${activeCount} still in motion.` : 'Decide thoughtfully.'}`;
        if (overdueFollowups >= 3) return `${overdueFollowups} applications have gone quiet. Time to nudge.`;
        if (activeCount > 0) return `${stats.total} tracked · ${activeCount} active.`;
        return `${stats.total} tracked. Keep planting seeds.`;
    })();

    return (
        <div className="p-4 md:p-6 space-y-8 max-w-[1400px] mx-auto w-full">
            {/* ---------- Hero ---------- */}
            <header className="flex items-end justify-between flex-wrap gap-4">
                <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                        // {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </p>
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight mt-1">
                        {greeting}.
                    </h1>
                    <p className="text-muted-foreground mt-2 max-w-xl">
                        {summary}
                    </p>
                </div>
                <Button onClick={() => navigate('/applications/create')} className="gap-1.5">
                    <Plus className="h-4 w-4" />
                    New application
                </Button>
            </header>

            {/* ---------- KPI strip (compact, no decorative sparklines) ---------- */}
            <div className="grid grid-cols-2 md:grid-cols-4 border-y divide-x divide-border">
                <KpiBlock label="total" value={stats.total} />
                <KpiBlock
                    label="active"
                    value={activeCount}
                    sub={activeCount > 0 ? `${stats.statusCounts['Applied'] || 0} applied · ${stats.statusCounts['Interview'] || 0} interview` : undefined}
                />
                <KpiBlock
                    label="response rate"
                    value={`${stats.responseRate}%`}
                    sub={stats.total > 0 ? `${stats.total - (stats.statusCounts['Applied'] || 0)} of ${stats.total} got a reply` : undefined}
                />
                <KpiBlock
                    label="offers"
                    value={offerCount}
                    valueClass={offerCount > 0 ? 'text-emerald-500' : ''}
                    sub={stats.weeklyStreak.currentWeekCount > 0 ? `${stats.weeklyStreak.currentWeekCount} new this week` : undefined}
                />
            </div>

            {/* ---------- Pipeline tile grid ---------- */}
            <section>
                <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
                    <div>
                        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
                            Where everything stands
                        </h2>
                        <p className="text-base text-muted-foreground mt-1.5">
                            A live snapshot of your pipeline.
                        </p>
                    </div>
                    <Link
                        to="/applications"
                        className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
                    >
                        View all
                        <ChevronRight className="h-4 w-4" />
                    </Link>
                </div>

                {stats.total === 0 ? (
                    <div className="rounded-2xl border border-border/60 bg-card p-12 text-center">
                        <Sparkles className="h-7 w-7 mx-auto text-muted-foreground/40 mb-3" />
                        <p className="text-sm text-muted-foreground">Your pipeline shows up here.</p>
                        <Button
                            variant="link"
                            size="sm"
                            onClick={() => navigate('/applications/create')}
                            className="mt-1"
                        >
                            Track your first application →
                        </Button>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            {pipelineStages.map((s) => {
                                const count = stats.statusCounts[s.key] || 0;
                                const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                                const isActive = count > 0;
                                const color = statusColors[s.key];
                                return (
                                    <Link
                                        key={s.key}
                                        to={`/applications?status=${s.key}`}
                                        className={cn(
                                            'group relative overflow-hidden rounded-2xl border bg-card p-5 md:p-6 transition-all',
                                            isActive
                                                ? 'border-border/60 hover:border-foreground/30 hover:shadow-sm'
                                                : 'border-border/40 hover:border-border'
                                        )}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className={cn(
                                                'text-sm font-medium tracking-tight',
                                                isActive ? 'text-foreground' : 'text-muted-foreground'
                                            )}>
                                                {s.label}
                                            </span>
                                            <span
                                                className="h-2 w-2 rounded-full transition-opacity"
                                                style={{
                                                    backgroundColor: color,
                                                    opacity: isActive ? 1 : 0.25,
                                                }}
                                            />
                                        </div>
                                        <div className="mt-4 flex items-baseline gap-2">
                                            <span className={cn(
                                                'text-5xl font-semibold tracking-tight tabular-nums leading-none',
                                                isActive ? 'text-foreground' : 'text-muted-foreground/40'
                                            )}>
                                                {count}
                                            </span>
                                            {isActive && (
                                                <span className="text-sm text-muted-foreground tabular-nums">
                                                    {pct}%
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-5 h-1 rounded-full bg-muted/40 overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-700"
                                                style={{
                                                    width: `${pct}%`,
                                                    backgroundColor: color,
                                                    opacity: isActive ? 1 : 0,
                                                }}
                                            />
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>

                        {(rejectedCount > 0 || withdrawnCount > 0) && (
                            <div className="mt-4 flex items-center gap-6 px-1 text-sm text-muted-foreground">
                                {rejectedCount > 0 && (
                                    <Link
                                        to="/applications?status=Rejected"
                                        className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
                                    >
                                        <span
                                            className="h-1.5 w-1.5 rounded-full"
                                            style={{ backgroundColor: statusColors.Rejected }}
                                        />
                                        <span className="text-foreground font-medium tabular-nums">{rejectedCount}</span>
                                        rejected
                                    </Link>
                                )}
                                {withdrawnCount > 0 && (
                                    <Link
                                        to="/applications?status=Withdrawn"
                                        className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
                                    >
                                        <span
                                            className="h-1.5 w-1.5 rounded-full"
                                            style={{ backgroundColor: statusColors.Withdrawn }}
                                        />
                                        <span className="text-foreground font-medium tabular-nums">{withdrawnCount}</span>
                                        withdrawn
                                    </Link>
                                )}
                            </div>
                        )}
                    </>
                )}
            </section>

            {/* ---------- Activity heatmap ---------- */}
            <section className="animate-fade-rise" style={{ animationDelay: '240ms' }}>
                <div className="flex items-end justify-between flex-wrap gap-2 mb-4">
                    <div>
                        <SectionLabel label="activity" />
                        <div className="flex items-baseline gap-2 mt-1">
                            <h2 className="text-2xl font-bold tracking-tight">Daily activity</h2>
                            <span className="font-mono text-xs text-muted-foreground">when you've been applying</span>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl border bg-card p-5 md:p-6">
                    <ActivityHeatmap data={stats.dailyActivity || []} />
                </div>
            </section>

            {/* ---------- Action queue + Latest ---------- */}
            <div className="grid gap-6 lg:grid-cols-3 animate-fade-rise" style={{ animationDelay: '300ms' }}>
                <section className="lg:col-span-2">
                    <div className="mb-4">
                        <SectionLabel label="next actions" />
                        <div className="flex items-baseline gap-2 mt-1">
                            <h2 className="text-2xl font-bold tracking-tight">Up to bat</h2>
                            <span className="font-mono text-xs text-muted-foreground">deadlines & nudges that need a hand</span>
                        </div>
                    </div>
                    <div className="rounded-xl border bg-card overflow-hidden">
                        {attentionItems.length === 0 ? (
                            <div className="p-10 text-center">
                                <Zap className="h-7 w-7 mx-auto text-emerald-500/60 mb-2" />
                                <p className="text-sm text-muted-foreground">You're all caught up.</p>
                                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60 mt-1">
                                    no deadlines · no stale apps
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y">
                                {attentionItems.map((item, idx) => {
                                    if (item.kind === 'deadline') {
                                        const isInterview = item.type === 'Interview';
                                        const urgent = item.days <= 2;
                                        return (
                                            <Link
                                                key={`d-${item.id}-${idx}`}
                                                to={`/applications/edit/${item.id}`}
                                                className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors group"
                                            >
                                                <div className="font-mono text-[10px] uppercase tracking-wider w-16 shrink-0">
                                                    <span className={urgent ? 'text-destructive font-semibold' : 'text-muted-foreground'}>
                                                        {item.days <= 0 ? 'TODAY' : item.days === 1 ? 'TMRW' : `+${item.days}D`}
                                                    </span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">{item.company}</p>
                                                    <p className="text-xs text-muted-foreground truncate">
                                                        {item.type} · {item.position}
                                                    </p>
                                                </div>
                                                <span
                                                    className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${isInterview
                                                            ? 'bg-chart-2/15 text-chart-2'
                                                            : 'bg-chart-4/15 text-chart-4'
                                                        }`}
                                                >
                                                    {isInterview ? 'interview' : 'oa'}
                                                </span>
                                                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </Link>
                                        );
                                    }
                                    return (
                                        <div
                                            key={`f-${item.id}-${idx}`}
                                            className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors group"
                                        >
                                            <div className="font-mono text-[10px] uppercase tracking-wider w-16 shrink-0">
                                                <span className="text-muted-foreground">{item.days}D AGO</span>
                                            </div>
                                            <Link
                                                to={`/applications/edit/${item.id}`}
                                                className="flex-1 min-w-0"
                                            >
                                                <p className="text-sm font-medium truncate">{item.company}</p>
                                                <p className="text-xs text-muted-foreground truncate">
                                                    Stale · {item.position}
                                                </p>
                                            </Link>
                                            <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-chart-3/15 text-chart-3">
                                                follow up
                                            </span>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-7 text-xs gap-1 shrink-0"
                                                onClick={() => handleMarkFollowedUp(item.id)}
                                            >
                                                <ArrowRight className="h-3 w-3" />
                                                Done
                                            </Button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </section>

                <section>
                    <div className="mb-4">
                        <SectionLabel label="recent" />
                        <div className="flex items-baseline gap-2 mt-1">
                            <h2 className="text-2xl font-bold tracking-tight">Latest</h2>
                        </div>
                    </div>
                    <div className="rounded-xl border bg-card overflow-hidden">
                        {stats.recentApplications.length === 0 ? (
                            <div className="p-10 text-center">
                                <p className="text-sm text-muted-foreground">No applications yet</p>
                                <Button
                                    variant="link"
                                    size="sm"
                                    className="mt-1"
                                    onClick={() => navigate('/applications/create')}
                                >
                                    Track your first one →
                                </Button>
                            </div>
                        ) : (
                            <div className="divide-y">
                                {stats.recentApplications.slice(0, 5).map((app) => (
                                    <Link
                                        key={app.id}
                                        to={`/applications/edit/${app.id}`}
                                        className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
                                    >
                                        <div
                                            className="h-8 w-8 rounded flex items-center justify-center text-white font-semibold text-xs shrink-0"
                                            style={{ backgroundColor: statusColors[app.status as ApplicationStatus] }}
                                        >
                                            {app.company.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{app.company}</p>
                                            <p className="text-xs text-muted-foreground truncate">{app.position}</p>
                                        </div>
                                        <span
                                            className="font-mono text-[10px] uppercase tracking-wider shrink-0"
                                            style={{ color: statusColors[app.status as ApplicationStatus] }}
                                        >
                                            {app.status}
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </section>
            </div>

            {/* ---------- Velocity + Response time ---------- */}
            <div className="grid gap-6 lg:grid-cols-2 animate-fade-rise" style={{ animationDelay: '360ms' }}>
                <section>
                    <div className="flex items-end justify-between flex-wrap gap-2 mb-4">
                        <div>
                            <SectionLabel label="velocity" />
                            <div className="flex items-baseline gap-2 mt-1">
                                <h2 className="text-2xl font-bold tracking-tight">Cadence</h2>
                                <span className="font-mono text-xs text-muted-foreground">
                                    {stats.weeklyStreak.currentWeekCount}/{stats.weeklyStreak.goal} this week
                                </span>
                            </div>
                        </div>
                        {editingGoal ? (
                            <div className="flex items-center gap-1.5">
                                <Input
                                    type="number"
                                    value={goalInput}
                                    onChange={(e) => setGoalInput(parseInt(e.target.value) || 0)}
                                    className="w-16 h-7 text-sm"
                                    min={0}
                                    max={200}
                                />
                                <Button size="sm" onClick={handleSaveGoal} className="h-7 px-2 text-xs">Save</Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => { setEditingGoal(false); setGoalInput(stats.weeklyStreak.goal); }}
                                    className="h-7 px-2 text-xs"
                                >
                                    Cancel
                                </Button>
                            </div>
                        ) : (
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingGoal(true)}
                                className="h-7 gap-1 text-xs font-mono"
                            >
                                <Pencil className="h-3 w-3" />
                                goal: {stats.weeklyStreak.goal}/wk
                            </Button>
                        )}
                    </div>
                    <div className="rounded-xl border bg-card p-5">
                        <div className="flex items-end gap-1.5 h-28">
                            {stats.weeklyStreak.weeks.map((w, i) => {
                                const heightPct = (w.count / weeklyMax) * 100;
                                const metGoal = w.count >= stats.weeklyStreak.goal && stats.weeklyStreak.goal > 0;
                                const isCurrent = i === stats.weeklyStreak.weeks.length - 1;
                                return (
                                    <div key={w.weekStart} className="flex-1 flex flex-col items-center gap-1.5 group">
                                        <div className="w-full flex items-end justify-center h-full relative">
                                            <div
                                                className="w-full rounded-sm transition-all duration-500"
                                                style={{
                                                    height: `${Math.max(heightPct, 3)}%`,
                                                    backgroundColor: metGoal ? '#22c55e' : isCurrent ? 'var(--primary)' : 'var(--muted-foreground)',
                                                    opacity: metGoal ? 1 : isCurrent ? 1 : 0.4,
                                                }}
                                                title={`${w.count} applications`}
                                            />
                                        </div>
                                        <span className={`font-mono text-[10px] tabular-nums ${isCurrent ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                                            {w.count}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex justify-between mt-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                            <span>8w ago</span>
                            <span>this week</span>
                        </div>
                    </div>
                </section>

                <section>
                    <div className="mb-4">
                        <SectionLabel label="responsiveness" />
                        <div className="flex items-baseline gap-2 mt-1">
                            <h2 className="text-2xl font-bold tracking-tight">Who's quickest</h2>
                            <span className="font-mono text-xs text-muted-foreground">avg days to hear back</span>
                        </div>
                    </div>
                    <div className="rounded-xl border bg-card p-5">
                        {stats.responseTimeByCompany && stats.responseTimeByCompany.length > 0 ? (
                            <div className="space-y-3">
                                {stats.responseTimeByCompany.map((row) => {
                                    const max = Math.max(...stats.responseTimeByCompany.map(r => r.avgDays), 1);
                                    const widthPct = (row.avgDays / max) * 100;
                                    return (
                                        <div key={row.company}>
                                            <div className="flex items-center justify-between text-xs mb-1.5">
                                                <span className="font-medium truncate max-w-[60%]" title={row.company}>{row.company}</span>
                                                <span className="font-mono text-muted-foreground tabular-nums">
                                                    {row.avgDays}d <span className="opacity-60">·</span> {row.count} app{row.count > 1 ? 's' : ''}
                                                </span>
                                            </div>
                                            <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-chart-2 transition-all"
                                                    style={{ width: `${widthPct}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground py-8 text-center">
                                Move some applications past <span className="font-mono">Applied</span> to see response data.
                            </p>
                        )}
                    </div>
                </section>
            </div>
        </div>
    )
}

// ---------- KPI block ----------
const KpiBlock = ({
    label,
    value,
    valueClass = '',
    sub,
}: {
    label: string;
    value: number | string;
    valueClass?: string;
    sub?: string;
}) => (
    <div className="px-4 py-4">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {label}
        </p>
        <p className={`font-mono text-3xl font-bold tabular-nums mt-1 ${valueClass}`}>
            {value}
        </p>
        {sub && (
            <p className="font-mono text-[10px] text-muted-foreground/70 mt-1.5 truncate">
                {sub}
            </p>
        )}
    </div>
);


export default Dashboard
