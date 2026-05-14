import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Flame,
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
import { PipelineFlow } from '@/components/dataviz/PipelineFlow'
import { ActivityHeatmap } from '@/components/dataviz/ActivityHeatmap'
import { Sparkline } from '@/components/dataviz/Sparkline'
import { StatusBanner, type StatusFact } from '@/components/dataviz/StatusBanner'
import { DashboardSkeleton } from '@/components/dataviz/Skeleton'

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

const pipelineStages: { key: ApplicationStatus; label: string; short: string }[] = [
    { key: 'Applied', label: 'Applied', short: 'APL' },
    { key: 'OA', label: 'OA', short: 'OA' },
    { key: 'Interview', label: 'Interview', short: 'INT' },
    { key: 'Offer', label: 'Offer', short: 'OFR' },
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

    // Pipeline data
    const pipelineCounts = pipelineStages.map(s => {
        const f = stats.funnel.find(x => x.stage === s.key);
        return { ...s, count: f?.count ?? 0, conv: f?.conversionFromPrev ?? 100 };
    });

    // Today summary for the status banner
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayInterviews = (stats.upcomingDeadlines || []).filter(d => d.type === 'Interview' && d.date === todayStr).length;
    const todayOAs = (stats.upcomingDeadlines || []).filter(d => d.type === 'OA Deadline' && d.date === todayStr).length;
    const overdueFollowups = (stats.followUpCandidates || []).length;

    const facts: StatusFact[] = [];
    if (todayInterviews > 0) facts.push({ label: `${todayInterviews} interview${todayInterviews > 1 ? 's' : ''} today`, tone: 'warn', to: '/calendar' });
    if (todayOAs > 0) facts.push({ label: `${todayOAs} OA due today`, tone: 'danger', to: '/calendar' });
    facts.push({
        label: `${stats.weeklyStreak.currentWeekCount} this week`,
        tone: stats.weeklyStreak.currentWeekCount >= stats.weeklyStreak.goal ? 'success' : 'normal',
    });
    if (overdueFollowups > 0) facts.push({ label: `${overdueFollowups} follow-up${overdueFollowups > 1 ? 's' : ''} overdue`, tone: 'warn' });
    if (offerCount > 0) facts.push({ label: `${offerCount} live offer${offerCount > 1 ? 's' : ''}`, tone: 'success', to: '/applications' });

    // Sparkline data: derive cumulative totals over the 8 weekly buckets
    const weeklyCounts = stats.weeklyStreak.weeks.map(w => w.count);
    let runningTotal = stats.total - weeklyCounts.reduce((s, c) => s + c, 0);
    const cumulativeTotals = weeklyCounts.map(c => (runningTotal += c));
    const weeklyPending = weeklyCounts; // approximation — visualize cadence as pending proxy

    // Personality summary line
    const summary = (() => {
        if (stats.total === 0) return "Let's get your first application in. ";
        if (offerCount > 0) return `${offerCount} offer${offerCount > 1 ? 's' : ''} on the table. Don't blow it.`;
        if (overdueFollowups >= 3) return `${overdueFollowups} applications have gone quiet. Time to nudge.`;
        if (pendingCount > 0) return `${stats.total} tracked. ${pendingCount} in motion.`;
        return `${stats.total} tracked. Keep planting seeds.`;
    })();

    return (
        <div className="p-4 md:p-6 space-y-10 max-w-[1400px] mx-auto w-full">
            {/* ---------- Hero ---------- */}
            <div className="flex items-end justify-between flex-wrap gap-4 animate-fade-rise">
                <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                        // {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </p>
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight mt-1">
                        {greeting}.
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        {summary}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {stats.weeklyStreak.currentWeekCount > 0 && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                            <Flame className="h-3.5 w-3.5" />
                            <span className="font-mono text-xs font-medium tabular-nums">
                                {stats.weeklyStreak.currentWeekCount} this week
                            </span>
                        </div>
                    )}
                    <Button onClick={() => navigate('/applications/create')} className="gap-1.5">
                        <Plus className="h-4 w-4" />
                        New application
                    </Button>
                </div>
            </div>

            {/* ---------- Status banner ---------- */}
            <div className="animate-fade-rise" style={{ animationDelay: '60ms' }}>
                <StatusBanner facts={facts} />
            </div>

            {/* Email review queue removed — auto-imports now go straight to the pipeline,
                so reviewing is just editing any "Position TBD" rows in the list/board. */}

            {/* ---------- KPI strip with sparklines ---------- */}
            <div className="grid grid-cols-2 md:grid-cols-4 border-y divide-x divide-border animate-fade-rise" style={{ animationDelay: '120ms' }}>
                <KpiBlock
                    label="total"
                    value={stats.total}
                    sparkData={cumulativeTotals}
                    sparkColor="var(--foreground)"
                />
                <KpiBlock
                    label="in pipeline"
                    value={pendingCount}
                    valueClass="text-chart-1"
                    sparkData={weeklyPending}
                    sparkColor="var(--chart-1)"
                />
                <KpiBlock
                    label="response rate"
                    value={`${stats.responseRate}%`}
                    valueClass="text-chart-2"
                />
                <KpiBlock
                    label="offers"
                    value={offerCount}
                    valueClass={offerCount > 0 ? 'text-emerald-500' : 'text-muted-foreground'}
                    highlight={offerCount > 0}
                />
            </div>

            {/* ---------- Pipeline flow (signature visual) ---------- */}
            <section className="animate-fade-rise" style={{ animationDelay: '180ms' }}>
                <div className="flex items-end justify-between flex-wrap gap-2 mb-4">
                    <div>
                        <SectionLabel label="pipeline" />
                        <div className="flex items-baseline gap-2 mt-1">
                            <h2 className="text-2xl font-bold tracking-tight">The flow</h2>
                            <span className="font-mono text-xs text-muted-foreground">where everything stands</span>
                        </div>
                    </div>
                    <Link
                        to="/applications"
                        className="font-mono text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors"
                    >
                        view all <ChevronRight className="h-3 w-3" />
                    </Link>
                </div>
                <div className="rounded-xl border bg-card p-6">
                    {stats.total === 0 ? (
                        <div className="text-center py-14">
                            <Sparkles className="h-7 w-7 mx-auto text-muted-foreground/40 mb-3" />
                            <p className="text-sm text-muted-foreground">
                                Your pipeline shows up here.
                            </p>
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
                        <PipelineFlow
                            stages={pipelineCounts}
                            rejected={stats.statusCounts['Rejected'] || 0}
                            withdrawn={stats.statusCounts['Withdrawn'] || 0}
                        />
                    )}
                </div>
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

// ---------- KPI block with sparkline ----------
const KpiBlock = ({
    label,
    value,
    valueClass = '',
    sparkData,
    sparkColor = 'currentColor',
    highlight = false,
}: {
    label: string;
    value: number | string;
    valueClass?: string;
    sparkData?: number[];
    sparkColor?: string;
    highlight?: boolean;
}) => {
    return (
        <div className={`px-4 py-5 ${highlight ? 'bg-emerald-500/5' : ''}`}>
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {label}
            </p>
            <div className="flex items-end justify-between gap-2 mt-1">
                <p className={`font-mono text-3xl font-bold tabular-nums ${valueClass}`}>
                    {value}
                </p>
                {sparkData && sparkData.length > 1 && (
                    <div style={{ color: sparkColor }}>
                        <Sparkline data={sparkData} width={70} height={26} fill={sparkColor} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard
