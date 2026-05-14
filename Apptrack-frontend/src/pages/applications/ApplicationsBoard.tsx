import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
    DndContext,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
    PointerSensor,
    KeyboardSensor,
    useSensor,
    useSensors,
    useDroppable,
    useDraggable,
} from '@dnd-kit/core';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Application, ApplicationStatus } from '@/types';
import {
    APPLICATION_STATUSES,
    API_URL,
    statusColors,
    statusIcons,
} from '@/constants';
import { Card } from '@/components/ui/card';

type Props = {
    onApplicationClick?: (id: number) => void;
};

const guessDomain = (company: string): string => {
    const c = company.toLowerCase().replace(/[^a-z0-9]/g, '');
    return c ? `${c}.com` : '';
};

const daysSince = (dateStr: string | null): number | null => {
    if (!dateStr) return null;
    const ms = Date.now() - new Date(dateStr).getTime();
    return Math.floor(ms / (1000 * 60 * 60 * 24));
};

const heatColor = (days: number | null): string => {
    if (days === null) return 'var(--muted-foreground)';
    if (days <= 7) return '#22c55e';
    if (days <= 21) return '#f59e0b';
    return '#ef4444';
};

const ApplicationCard: React.FC<{
    application: Application;
    isDragging?: boolean;
    onClick?: () => void;
}> = ({ application, isDragging, onClick }) => {
    const days = daysSince(application.dateApplied);
    const [logoError, setLogoError] = useState(false);
    const domain = guessDomain(application.company);
    const heat = heatColor(days);
    const statusColor = statusColors[application.status];

    const priorityChar = application.priority === 'Dream'
        ? '★'
        : application.priority === 'Target'
        ? '◆'
        : application.priority === 'Safety'
        ? '○'
        : null;

    return (
        <Card
            onClick={onClick}
            className={`relative p-3 cursor-grab active:cursor-grabbing hover:shadow-lg transition-all bg-card border-border overflow-hidden ${
                isDragging ? 'shadow-2xl ring-2 ring-primary opacity-90 -rotate-1' : ''
            }`}
        >
            {/* Status accent stripe */}
            <span
                className="absolute left-0 top-0 bottom-0 w-0.5"
                style={{ backgroundColor: statusColor }}
            />

            <div className="flex items-start gap-2.5">
                {domain && !logoError ? (
                    <img
                        src={`https://logo.clearbit.com/${domain}`}
                        alt={application.company}
                        className="h-9 w-9 rounded shrink-0 object-contain bg-muted border"
                        onError={() => setLogoError(true)}
                    />
                ) : (
                    <div
                        className="h-9 w-9 rounded shrink-0 flex items-center justify-center text-white font-bold text-base"
                        style={{ backgroundColor: statusColor }}
                    >
                        {application.company.charAt(0).toUpperCase()}
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-sm truncate leading-tight" title={application.company}>
                            {application.company}
                        </p>
                        {application.source === 'email' && (
                            <span
                                className="font-mono text-[8px] uppercase tracking-wider px-1 py-px rounded bg-muted text-muted-foreground shrink-0"
                                title="Imported from Gmail"
                            >
                                ✉
                            </span>
                        )}
                    </div>
                    {application.position && application.position !== '(needs review)' ? (
                        <p className="text-xs text-muted-foreground truncate mt-0.5" title={application.position}>
                            {application.position}
                        </p>
                    ) : (
                        <p className="text-xs text-muted-foreground/40 italic mt-0.5">
                            Position TBD
                        </p>
                    )}
                </div>
                {priorityChar && (
                    <span
                        className="font-mono text-sm shrink-0 leading-none"
                        style={{
                            color: application.priority === 'Dream'
                                ? '#fbbf24'
                                : application.priority === 'Target'
                                ? 'var(--primary)'
                                : 'var(--muted-foreground)',
                        }}
                        title={application.priority || ''}
                    >
                        {priorityChar}
                    </span>
                )}
            </div>

            <div className="mt-2.5 flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-wider">
                {application.status === 'Applied' && days !== null ? (
                    <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-medium"
                        style={{ backgroundColor: `${heat}1f`, color: heat }}
                    >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: heat }} />
                        {days}d
                    </span>
                ) : application.dateApplied ? (
                    <span className="text-muted-foreground">
                        {new Date(application.dateApplied + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                ) : (
                    <span className="text-muted-foreground/50">—</span>
                )}
                {application.workType && (
                    <span className="text-muted-foreground">{application.workType === 'FullTime' ? 'FT' : application.workType.slice(0, 4).toLowerCase()}</span>
                )}
                {application.location && (
                    <span className="text-muted-foreground truncate max-w-[80px]" title={application.location}>
                        {application.location}
                    </span>
                )}
            </div>
        </Card>
    );
};

const DraggableCard: React.FC<{ application: Application; onClick: () => void }> = ({ application, onClick }) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: application.id.toString(),
        data: { application },
    });

    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            style={{ opacity: isDragging ? 0 : 1 }}
        >
            <ApplicationCard application={application} onClick={onClick} />
        </div>
    );
};

const Column: React.FC<{
    status: ApplicationStatus;
    applications: Application[];
    onApplicationClick: (id: number) => void;
}> = ({ status, applications, onApplicationClick }) => {
    const { setNodeRef, isOver } = useDroppable({ id: status });
    const color = statusColors[status];

    return (
        <div
            ref={setNodeRef}
            className={`flex flex-col rounded-xl bg-muted/30 border transition-all min-h-[440px] ${
                isOver ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : 'border-border/60'
            }`}
        >
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/60">
                <div className="flex items-center gap-2 min-w-0">
                    <span
                        className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                    />
                    <span
                        className="font-mono text-[11px] uppercase tracking-[0.18em] font-semibold truncate"
                        style={{ color }}
                    >
                        {status}
                    </span>
                </div>
                <span className="font-mono text-[10px] tabular-nums font-bold px-1.5 py-0.5 rounded bg-background/80 border border-border/60">
                    {String(applications.length).padStart(2, '0')}
                </span>
            </div>
            <div className="flex flex-col gap-2 p-2 flex-1 overflow-y-auto">
                {applications.map((app) => (
                    <DraggableCard
                        key={app.id}
                        application={app}
                        onClick={() => onApplicationClick(app.id)}
                    />
                ))}
                {applications.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 px-2 border border-dashed border-border/60 rounded-lg">
                        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
                            drop zone
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

const ApplicationsBoard: React.FC<Props> = ({ onApplicationClick }) => {
    const navigate = useNavigate();
    const [applications, setApplications] = useState<Application[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeApplication, setActiveApplication] = useState<Application | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor),
    );

    const fetchAll = useCallback(async () => {
        try {
            // Fetch up to 100 per status — enough for typical student use
            const res = await fetch(`${API_URL}/applications?limit=100&page=1`, {
                credentials: 'include',
            });
            if (!res.ok) throw new Error('fetch failed');
            const json = await res.json();
            setApplications(json.data);
        } catch {
            toast.error('Failed to load board');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    const grouped = useMemo(() => {
        const out: Record<ApplicationStatus, Application[]> = {
            Applied: [], OA: [], Interview: [], Offer: [], Rejected: [], Withdrawn: [],
        };
        for (const app of applications) {
            out[app.status]?.push(app);
        }
        return out;
    }, [applications]);

    const handleClick = (id: number) => {
        if (onApplicationClick) onApplicationClick(id);
        else navigate(`/applications/edit/${id}`);
    };

    const handleDragStart = (event: DragStartEvent) => {
        const app = event.active.data.current?.application as Application | undefined;
        if (app) setActiveApplication(app);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        setActiveApplication(null);
        const { active, over } = event;
        if (!over) return;

        const appId = parseInt(String(active.id), 10);
        const newStatus = String(over.id) as ApplicationStatus;
        if (!APPLICATION_STATUSES.includes(newStatus)) return;

        const current = applications.find((a) => a.id === appId);
        if (!current || current.status === newStatus) return;

        // Optimistic update
        setApplications((prev) =>
            prev.map((a) => (a.id === appId ? { ...a, status: newStatus } : a)),
        );

        try {
            const res = await fetch(`${API_URL}/applications/${appId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ status: newStatus }),
            });
            if (!res.ok) throw new Error('update failed');

            toast.success(`Moved to ${newStatus}`);

            if (newStatus === 'Offer') {
                confetti({
                    particleCount: 120,
                    spread: 90,
                    origin: { y: 0.6 },
                    colors: ['#22c55e', '#16a34a', '#fbbf24', '#f59e0b'],
                });
            }
        } catch {
            // Revert
            setApplications((prev) =>
                prev.map((a) => (a.id === appId ? { ...a, status: current.status } : a)),
            );
            toast.error('Failed to update status');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 pb-4">
                {APPLICATION_STATUSES.map((status) => (
                    <Column
                        key={status}
                        status={status}
                        applications={grouped[status]}
                        onApplicationClick={handleClick}
                    />
                ))}
            </div>
            <DragOverlay>
                {activeApplication && (
                    <ApplicationCard application={activeApplication} isDragging />
                )}
            </DragOverlay>
        </DndContext>
    );
};

export default ApplicationsBoard;
