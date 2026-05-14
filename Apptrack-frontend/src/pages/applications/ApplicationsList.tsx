import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router';
import { ListView } from "@/components/refine-ui/views/list-view.tsx";
import { Breadcrumb } from "@/components/refine-ui/layout/breadcrumb.tsx";
import { Search, ChevronDown, X, Pencil, Check, ArrowUp, ArrowDown, Trash2, Edit, LayoutGrid, Table as TableIcon } from "lucide-react";
import { Input } from "@/components/ui/input.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { APPLICATION_STATUS_OPTIONS, APPLICATION_STATUSES, API_URL, WORK_TYPE_OPTIONS, PRIORITY_OPTIONS, statusColors, statusIcons } from "@/constants";
import ApplicationsBoard from "./ApplicationsBoard";
import { CreateButton } from "@/components/refine-ui/buttons/create.tsx";
import { DataTable } from "@/components/refine-ui/data-table/data-table.tsx";
import { useTable } from "@refinedev/react-table";
import { Application, ApplicationStatus } from "@/types";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge.tsx";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";

// Status Badge Component with Dropdown
const StatusBadge = ({
    status,
    applicationId,
    onStatusChange
}: {
    status: ApplicationStatus,
    applicationId: number,
    onStatusChange: (id: number, newStatus: ApplicationStatus) => void
}) => {
    const color = statusColors[status];

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    onClick={(e) => e.stopPropagation()}
                    className="focus:outline-none"
                >
                    <Badge
                        variant="outline"
                        className="cursor-pointer hover:bg-muted/50 transition-colors gap-1"
                        style={{ borderColor: color, color: color }}
                    >
                        {statusIcons[status]}
                        {status}
                        <ChevronDown className="h-3 w-3 ml-0.5 opacity-60" />
                    </Badge>
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-36">
                {APPLICATION_STATUSES.map((s) => (
                    <DropdownMenuItem
                        key={s}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (s !== status) {
                                onStatusChange(applicationId, s);
                            }
                        }}
                        className="flex items-center gap-2 cursor-pointer"
                        style={status === s ? { backgroundColor: 'var(--muted)' } : undefined}
                    >
                        <span style={{ color: statusColors[s] }}>{statusIcons[s]}</span>
                        <span>{s}</span>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

// Editable Notes Cell Component
const EditableNotesCell = ({
    notes,
    applicationId,
    onNotesChange
}: {
    notes: string | null,
    applicationId: number,
    onNotesChange: (id: number, newNotes: string) => void
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(notes || '');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.select();
        }
    }, [isEditing]);

    const handleSave = () => {
        onNotesChange(applicationId, editValue);
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditValue(notes || '');
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSave();
        } else if (e.key === 'Escape') {
            handleCancel();
        }
    };

    if (isEditing) {
        return (
            <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
                <Textarea
                    ref={textareaRef}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="min-h-[60px] text-sm resize-none"
                    placeholder="Add notes..."
                />
                <div className="flex gap-1 justify-end">
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCancel}
                        className="h-6 px-2"
                    >
                        <X className="h-3 w-3" />
                    </Button>
                    <Button
                        size="sm"
                        variant="default"
                        onClick={handleSave}
                        className="h-6 px-2"
                    >
                        <Check className="h-3 w-3" />
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div
            className="group flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 min-h-[28px]"
            onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
            }}
        >
            <span className="truncate line-clamp-2 flex-1">
                {notes || <span className="text-muted-foreground italic">Click to add notes</span>}
            </span>
            <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </div>
    );
};

const ApplicationsList = () => {
    const navigate = useNavigate();

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedStatus, setSelectedStatus] = useState("all");
    const [selectedWorkType, setSelectedWorkType] = useState("all");
    const [selectedPriority, setSelectedPriority] = useState("all");
    const [sponsorshipFilter, setSponsorshipFilter] = useState("all"); // 'all' | 'yes' | 'no'
    const [dateSort, setDateSort] = useState<'desc' | 'asc'>('desc'); // desc = newest, asc = oldest
    const [viewMode, setViewMode] = useState<'table' | 'board'>(() => {
        const saved = localStorage.getItem('apptrack:viewMode');
        return saved === 'board' ? 'board' : 'table';
    });

    useEffect(() => {
        localStorage.setItem('apptrack:viewMode', viewMode);
    }, [viewMode]);

    // Live stat counts for the header strip
    const [statCounts, setStatCounts] = useState<{ total: number; inPipeline: number; offers: number }>({
        total: 0, inPipeline: 0, offers: 0,
    });
    useEffect(() => {
        fetch(`${API_URL}/applications/stats`, { credentials: 'include' })
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (!data?.data) return;
                const sc = data.data.statusCounts || {};
                const pending = (sc['Applied'] || 0) + (sc['OA'] || 0) + (sc['Interview'] || 0);
                setStatCounts({
                    total: data.data.total ?? 0,
                    inPipeline: pending,
                    offers: sc['Offer'] || 0,
                });
            })
            .catch(() => { /* non-critical */ });
    }, []);

    // Local state for optimistic status updates (prevents row reordering)
    const [statusOverrides, setStatusOverrides] = useState<Record<number, ApplicationStatus>>({});
    // Local state for optimistic notes updates
    const [notesOverrides, setNotesOverrides] = useState<Record<number, string>>({});

    // Handle delete
    const handleDelete = useCallback(async (
        applicationId: number,
        e: React.MouseEvent,
        onDeleted?: () => Promise<unknown>
    ) => {
        e.stopPropagation(); // Prevent row click
        if (!confirm('Are you sure you want to delete this application?')) return;

        try {
            const response = await fetch(`${API_URL}/applications/${applicationId}`, {
                method: 'DELETE',
                credentials: 'include',
            });

            if (!response.ok) throw new Error('Failed to delete');

            toast.success('Application deleted');
            if (onDeleted) {
                await onDeleted();
            }
        } catch (error) {
            toast.error('Failed to delete application');
        }
    }, []);

    // Filter by status
    const statusFilters = selectedStatus === "all" ? [] : [
        { field: "status", operator: "eq" as const, value: selectedStatus },
    ];
    const workTypeFilters = selectedWorkType === "all" ? [] : [
        { field: "workType", operator: "eq" as const, value: selectedWorkType },
    ];
    const priorityFilters = selectedPriority === "all" ? [] : [
        { field: "priority", operator: "eq" as const, value: selectedPriority },
    ];
    const sponsorshipFilters = sponsorshipFilter === "all" ? [] : [
        { field: "requiresSponsorship", operator: "eq" as const, value: sponsorshipFilter === "yes" ? "true" : "false" },
    ];

    // Search by company name
    const searchFilters = searchQuery ? [
        { field: 'company', operator: "contains" as const, value: searchQuery },
    ] : [];

    // Handle status change - optimistic update (no refetch to prevent row movement)
    const handleStatusChange = useCallback(async (applicationId: number, newStatus: ApplicationStatus) => {
        // Optimistic update - immediately update UI
        setStatusOverrides(prev => ({ ...prev, [applicationId]: newStatus }));

        try {
            const response = await fetch(`${API_URL}/applications/${applicationId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ status: newStatus }),
            });

            if (!response.ok) {
                // Revert optimistic update on error
                setStatusOverrides(prev => {
                    const next = { ...prev };
                    delete next[applicationId];
                    return next;
                });
                throw new Error('Failed to update status');
            }

            toast.success(`Status updated to ${newStatus}`);
        } catch (error) {
            console.error('Failed to update status:', error);
            toast.error('Failed to update status');
        }
    }, []);

    // Handle notes change - optimistic update
    const handleNotesChange = useCallback(async (applicationId: number, newNotes: string) => {
        // Optimistic update - immediately update UI
        setNotesOverrides(prev => ({ ...prev, [applicationId]: newNotes }));

        try {
            const response = await fetch(`${API_URL}/applications/${applicationId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ notes: newNotes }),
            });

            if (!response.ok) {
                // Revert optimistic update on error
                setNotesOverrides(prev => {
                    const next = { ...prev };
                    delete next[applicationId];
                    return next;
                });
                throw new Error('Failed to update notes');
            }

            toast.success('Notes updated');
        } catch (error) {
            console.error('Failed to update notes:', error);
            toast.error('Failed to update notes');
        }
    }, []);

    const applicationTable = useTable<Application>({
        columns: useMemo<ColumnDef<Application>[]>(() => [
            {
                id: 'company',
                accessorKey: 'company',
                size: 150,
                header: () => <p className="column-title">Company</p>,
                cell: ({ getValue }) => <span className="text-foreground font-medium">{getValue<string>()}</span>,
                filterFn: 'includesString'
            },
            {
                id: 'position',
                accessorKey: 'position',
                size: 200,
                header: () => <p className="column-title">Position</p>,
                cell: ({ getValue }) => {
                    const v = getValue<string>();
                    if (!v || v === '(needs review)') {
                        return <span className="text-muted-foreground/50 italic">Position TBD</span>;
                    }
                    return <span className="text-foreground">{v}</span>;
                },
            },
            {
                id: 'status',
                accessorKey: 'status',
                size: 160,
                header: () => <p className="column-title">Status</p>,
                cell: ({ row }) => {
                    // Use optimistic status if available, otherwise use original
                    const displayStatus = statusOverrides[row.original.id] || row.original.status;
                    return (
                        <StatusBadge
                            status={displayStatus}
                            applicationId={row.original.id}
                            onStatusChange={handleStatusChange}
                        />
                    );
                },
            },
            {
                id: 'dateApplied',
                accessorKey: 'dateApplied',
                size: 160,
                header: () => (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="flex items-center gap-1 focus:outline-none hover:text-foreground transition-colors">
                                <p className="column-title">Date Applied</p>
                                {dateSort === 'desc' ? (
                                    <ArrowDown className="h-3 w-3" />
                                ) : (
                                    <ArrowUp className="h-3 w-3" />
                                )}
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                            <DropdownMenuItem
                                onClick={() => setDateSort('desc')}
                                className={dateSort === 'desc' ? 'bg-muted' : ''}
                            >
                                <ArrowDown className="h-4 w-4 mr-2" />
                                Newest First
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => setDateSort('asc')}
                                className={dateSort === 'asc' ? 'bg-muted' : ''}
                            >
                                <ArrowUp className="h-4 w-4 mr-2" />
                                Oldest First
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                ),
                cell: ({ getValue }) => {
                    const date = getValue<string | null>();
                    return date ? new Date(date).toLocaleDateString() : '-';
                },
            },
            {
                id: 'notes',
                accessorKey: 'notes',
                size: 250,
                header: () => <p className="column-title">Notes</p>,
                cell: ({ row }) => {
                    // Use optimistic notes if available, otherwise use original
                    const displayNotes = notesOverrides[row.original.id] ?? row.original.notes;
                    return (
                        <EditableNotesCell
                            notes={displayNotes}
                            applicationId={row.original.id}
                            onNotesChange={handleNotesChange}
                        />
                    );
                },
            },
            {
                id: 'actions',
                size: 120,
                header: () => <p className="column-title">Actions</p>,
                cell: ({ row }) => (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/applications/edit/${row.original.id}`);
                            }}
                            aria-label="Edit application"
                        >
                            <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={(e) => handleDelete(row.original.id, e, applicationTable.refineCore.tableQuery.refetch)}
                            aria-label="Delete application"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                ),
            }
            // eslint-disable-next-line react-hooks/exhaustive-deps
        ], [statusOverrides, handleStatusChange, notesOverrides, handleNotesChange, dateSort, navigate, handleDelete]),

        refineCoreProps: {
            resource: 'applications',
            pagination: { pageSize: 10, mode: 'server' },
            filters: {
                permanent: [...statusFilters, ...searchFilters, ...workTypeFilters, ...priorityFilters, ...sponsorshipFilters],
            },
            sorters: {
                permanent: [
                    { field: 'dateApplied', order: dateSort }
                ]
            },
        }
    });

    const activeFilterCount =
        (selectedStatus !== 'all' ? 1 : 0) +
        (selectedWorkType !== 'all' ? 1 : 0) +
        (selectedPriority !== 'all' ? 1 : 0) +
        (sponsorshipFilter !== 'all' ? 1 : 0) +
        (searchQuery ? 1 : 0);

    const clearFilters = () => {
        setSelectedStatus('all');
        setSelectedWorkType('all');
        setSelectedPriority('all');
        setSponsorshipFilter('all');
        setSearchQuery('');
    };

    return (
        <ListView>
            <Breadcrumb />

            {/* ---------- Hero header ---------- */}
            <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
                <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        // applications
                    </p>
                    <div className="flex items-baseline gap-3 mt-1">
                        <h1 className="text-4xl font-bold tracking-tight">Applications</h1>
                        <span className="font-mono text-2xl font-bold tabular-nums text-muted-foreground">
                            {statCounts.total}
                        </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1.5">
                        Your job-search pipeline, end to end.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0 border rounded-md p-0.5 bg-muted/30">
                        <Button
                            size="sm"
                            variant={viewMode === 'table' ? 'default' : 'ghost'}
                            onClick={() => setViewMode('table')}
                            className="h-7 px-3 gap-1.5 font-mono text-xs"
                            aria-label="Table view"
                        >
                            <TableIcon className="h-3.5 w-3.5" />
                            list
                        </Button>
                        <Button
                            size="sm"
                            variant={viewMode === 'board' ? 'default' : 'ghost'}
                            onClick={() => setViewMode('board')}
                            className="h-7 px-3 gap-1.5 font-mono text-xs"
                            aria-label="Board view"
                        >
                            <LayoutGrid className="h-3.5 w-3.5" />
                            board
                        </Button>
                    </div>
                    <CreateButton />
                </div>
            </div>

            {/* ---------- Live stat strip ---------- */}
            <div className="grid grid-cols-3 border-y divide-x divide-border mb-6">
                <div className="px-4 py-3">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">total</p>
                    <p className="font-mono text-2xl font-bold tabular-nums mt-0.5">{statCounts.total}</p>
                </div>
                <div className="px-4 py-3">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">in pipeline</p>
                    <p className="font-mono text-2xl font-bold tabular-nums mt-0.5 text-chart-1">{statCounts.inPipeline}</p>
                </div>
                <div className="px-4 py-3">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">offers</p>
                    <p className={`font-mono text-2xl font-bold tabular-nums mt-0.5 ${statCounts.offers > 0 ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                        {statCounts.offers}
                    </p>
                </div>
            </div>

            {/* ---------- Filter row ---------- */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
                <div className="relative flex-1 min-w-[220px] max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="text"
                        placeholder="Search by company..."
                        className="pl-9 h-9 font-mono text-sm"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className="h-9 w-[130px]">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={"all"}>All Status</SelectItem>
                        {APPLICATION_STATUS_OPTIONS.map(status => (
                            <SelectItem key={status.value} value={status.value}>
                                {status.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={selectedWorkType} onValueChange={setSelectedWorkType}>
                    <SelectTrigger className="h-9 w-[130px]">
                        <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        {WORK_TYPE_OPTIONS.map(o => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={selectedPriority} onValueChange={setSelectedPriority}>
                    <SelectTrigger className="h-9 w-[130px]">
                        <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Priority</SelectItem>
                        {PRIORITY_OPTIONS.map(o => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={sponsorshipFilter} onValueChange={setSponsorshipFilter}>
                    <SelectTrigger className="h-9 w-[160px]">
                        <SelectValue placeholder="Sponsorship" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Any Sponsorship</SelectItem>
                        <SelectItem value="yes">Needs Sponsorship</SelectItem>
                        <SelectItem value="no">No Sponsorship</SelectItem>
                    </SelectContent>
                </Select>
                {activeFilterCount > 0 && (
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={clearFilters}
                        className="h-9 px-2 text-xs font-mono gap-1"
                    >
                        <X className="h-3.5 w-3.5" />
                        clear {activeFilterCount}
                    </Button>
                )}
            </div>

            {viewMode === 'table' ? (
                <DataTable
                    table={applicationTable}
                    onRowClick={(row) => navigate(`/applications/edit/${row.id}`)}
                />
            ) : (
                <ApplicationsBoard />
            )}
        </ListView>
    )
}
export default ApplicationsList
