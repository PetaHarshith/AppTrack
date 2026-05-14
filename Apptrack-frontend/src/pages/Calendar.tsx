import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Briefcase, FileText, Loader2 } from 'lucide-react';
import { API_URL } from '@/constants';
import type { Application } from '@/types';
import { toast } from 'sonner';

type CalEvent = {
    id: number;
    appId: number;
    date: Date;
    company: string;
    position: string;
    type: 'Interview' | 'OA Deadline';
};

const monthLabel = (d: Date) =>
    d.toLocaleString('en-US', { month: 'long', year: 'numeric' });

const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

const CalendarPage = () => {
    const [applications, setApplications] = useState<Application[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentMonth, setCurrentMonth] = useState(() => {
        const d = new Date();
        d.setDate(1);
        return d;
    });

    const fetchAll = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/applications?limit=100&page=1`, {
                credentials: 'include',
            });
            if (!res.ok) throw new Error();
            const json = await res.json();
            setApplications(json.data);
        } catch {
            toast.error('Failed to load applications');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    const events: CalEvent[] = useMemo(() => {
        const out: CalEvent[] = [];
        for (const app of applications) {
            if (app.interviewDate) {
                out.push({
                    id: app.id * 2,
                    appId: app.id,
                    date: new Date(app.interviewDate + 'T00:00:00'),
                    company: app.company,
                    position: app.position,
                    type: 'Interview',
                });
            }
            if (app.oaDeadline) {
                out.push({
                    id: app.id * 2 + 1,
                    appId: app.id,
                    date: new Date(app.oaDeadline + 'T00:00:00'),
                    company: app.company,
                    position: app.position,
                    type: 'OA Deadline',
                });
            }
        }
        return out;
    }, [applications]);

    const calendarCells = useMemo(() => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const startWeekday = firstDay.getDay(); // 0=Sun
        const cells: Array<{ date: Date; inMonth: boolean }> = [];

        const prevMonthLast = new Date(year, month, 0).getDate();
        for (let i = startWeekday - 1; i >= 0; i--) {
            cells.push({
                date: new Date(year, month - 1, prevMonthLast - i),
                inMonth: false,
            });
        }

        const daysInMonth = new Date(year, month + 1, 0).getDate();
        for (let d = 1; d <= daysInMonth; d++) {
            cells.push({ date: new Date(year, month, d), inMonth: true });
        }

        while (cells.length % 7 !== 0) {
            const last = cells[cells.length - 1]!.date;
            cells.push({
                date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1),
                inMonth: false,
            });
        }
        return cells;
    }, [currentMonth]);

    const today = new Date();

    const upcomingEvents = useMemo(() => {
        const now = Date.now();
        return events
            .filter((e) => e.date.getTime() >= now - 24 * 60 * 60 * 1000)
            .sort((a, b) => a.date.getTime() - b.date.getTime())
            .slice(0, 6);
    }, [events]);

    const totalInMonth = useMemo(() => {
        return events.filter((e) =>
            e.date.getFullYear() === currentMonth.getFullYear() &&
            e.date.getMonth() === currentMonth.getMonth()
        ).length;
    }, [events, currentMonth]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 max-w-[1400px] mx-auto w-full space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {totalInMonth > 0
                            ? `${totalInMonth} event${totalInMonth === 1 ? '' : 's'} in ${monthLabel(currentMonth)}`
                            : `No events scheduled in ${monthLabel(currentMonth)}`}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        size="icon"
                        variant="outline"
                        className="h-9 w-9"
                        onClick={() =>
                            setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
                        }
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-9 min-w-[180px] font-medium"
                        onClick={() => {
                            const d = new Date();
                            d.setDate(1);
                            setCurrentMonth(d);
                        }}
                    >
                        {monthLabel(currentMonth)}
                    </Button>
                    <Button
                        size="icon"
                        variant="outline"
                        className="h-9 w-9"
                        onClick={() =>
                            setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
                        }
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Upcoming strip */}
            {upcomingEvents.length > 0 && (
                <div className="flex gap-3 overflow-x-auto pb-1">
                    {upcomingEvents.map((e) => {
                        const days = Math.ceil((e.date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                        const isInterview = e.type === 'Interview';
                        return (
                            <Link
                                key={e.id}
                                to={`/applications/edit/${e.appId}`}
                                className={`flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/40 transition-colors min-w-[260px] shrink-0`}
                            >
                                <div
                                    className={`flex flex-col items-center justify-center w-12 h-12 rounded-md shrink-0 ${
                                        isInterview ? 'bg-chart-2/15 text-chart-2' : 'bg-chart-4/15 text-chart-4'
                                    }`}
                                >
                                    <span className="text-[10px] uppercase font-medium">
                                        {e.date.toLocaleString('en-US', { month: 'short' })}
                                    </span>
                                    <span className="text-sm font-bold">{e.date.getDate()}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold truncate">{e.company}</p>
                                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                        {isInterview ? <Briefcase className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                                        {e.type}
                                    </p>
                                </div>
                                <Badge variant="outline" className="text-xs shrink-0">
                                    {days <= 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days}d`}
                                </Badge>
                            </Link>
                        );
                    })}
                </div>
            )}

            {/* Calendar grid */}
            <div className="rounded-xl border bg-card overflow-hidden">
                {/* Day-of-week header */}
                <div className="grid grid-cols-7 border-b bg-muted/30">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                        <div
                            key={d}
                            className="text-center py-3 text-xs font-semibold tracking-wide uppercase text-muted-foreground"
                        >
                            {d}
                        </div>
                    ))}
                </div>

                {/* Day cells */}
                <div className="grid grid-cols-7">
                    {calendarCells.map((cell, idx) => {
                        const dayEvents = events.filter((e) => sameDay(e.date, cell.date));
                        const isToday = sameDay(cell.date, today);
                        const isWeekend = cell.date.getDay() === 0 || cell.date.getDay() === 6;
                        const isLastRow = idx >= calendarCells.length - 7;
                        const isLastCol = (idx + 1) % 7 === 0;
                        return (
                            <div
                                key={idx}
                                className={`min-h-[120px] p-2 ${!isLastRow ? 'border-b' : ''} ${
                                    !isLastCol ? 'border-r' : ''
                                } ${cell.inMonth ? '' : 'bg-muted/10'} ${isWeekend && cell.inMonth ? 'bg-muted/5' : ''}`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span
                                        className={`text-sm font-medium ${
                                            isToday
                                                ? 'bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center'
                                                : cell.inMonth
                                                ? 'text-foreground'
                                                : 'text-muted-foreground/40'
                                        }`}
                                    >
                                        {cell.date.getDate()}
                                    </span>
                                </div>
                                <div className="space-y-1">
                                    {dayEvents.slice(0, 3).map((e) => (
                                        <Link
                                            key={e.id}
                                            to={`/applications/edit/${e.appId}`}
                                            className={`block px-2 py-1 rounded text-[11px] font-medium truncate transition-colors ${
                                                e.type === 'Interview'
                                                    ? 'bg-chart-2/15 text-chart-2 hover:bg-chart-2/25'
                                                    : 'bg-chart-4/15 text-chart-4 hover:bg-chart-4/25'
                                            }`}
                                            title={`${e.type}: ${e.company} — ${e.position}`}
                                        >
                                            <span className="opacity-70 mr-1">
                                                {e.type === 'Interview' ? '●' : '◆'}
                                            </span>
                                            {e.company}
                                        </Link>
                                    ))}
                                    {dayEvents.length > 3 && (
                                        <div className="text-[11px] text-muted-foreground px-2">
                                            +{dayEvents.length - 3} more
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-6 text-xs text-muted-foreground px-1">
                <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-chart-2" />
                    Interview
                </div>
                <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-chart-4" />
                    OA Deadline
                </div>
                <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                    Today
                </div>
            </div>
        </div>
    );
};

export default CalendarPage;
