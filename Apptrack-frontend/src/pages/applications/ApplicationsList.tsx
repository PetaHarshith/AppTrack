import React, { useMemo, useState } from 'react'
import { ListView } from "@/components/refine-ui/views/list-view.tsx";
import { Breadcrumb } from "@/components/refine-ui/layout/breadcrumb.tsx";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { APPLICATION_STATUS_OPTIONS } from "@/constants";
import { CreateButton } from "@/components/refine-ui/buttons/create.tsx";
import { DataTable } from "@/components/refine-ui/data-table/data-table.tsx";
import { useTable } from "@refinedev/react-table";
import { Application } from "@/types";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge.tsx";

const ApplicationsList = () => {

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedStatus, setSelectedStatus] = useState("all");

    // Filter by status
    const statusFilters = selectedStatus === "all" ? [] : [
        { field: "status", operator: "eq" as const, value: selectedStatus },
    ];

    // Search by company name
    const searchFilters = searchQuery ? [
        { field: 'company', operator: "contains" as const, value: searchQuery },
    ] : [];

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
                cell: ({ getValue }) => <span className="text-foreground">{getValue<string>()}</span>,
            },
            {
                id: 'status',
                accessorKey: 'status',
                size: 120,
                header: () => <p className="column-title">Status</p>,
                cell: ({ getValue }) => <Badge variant="secondary">{getValue<string>()}</Badge>,
            },
            {
                id: 'dateApplied',
                accessorKey: 'dateApplied',
                size: 120,
                header: () => <p className="column-title">Date Applied</p>,
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
                cell: ({ getValue }) => {
                    const notes = getValue<string | null>();
                    return <span className="truncate line-clamp-2">{notes || '-'}</span>;
                },
            }
        ], []),

        refineCoreProps: {
            resource: 'applications',
            pagination: { pageSize: 10, mode: 'server' },
            filters: {
                permanent: [...statusFilters, ...searchFilters],
            },
            sorters: {
                initial: [
                    { field: 'id', order: 'desc' }
                ]
            },
        }
    });

    return (
        <ListView>
            <Breadcrumb />
            <h1 className="page-title">Applications</h1>

            <div className="intro-row">
                <p>Track and manage your job applications in one place.</p>

                <div className="actions-row">
                    <div className="search-field">
                        <Search className="search-icon" />
                        <Input
                            type="text"
                            placeholder="Search by company"
                            className="pl-10 w-full"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                            <SelectTrigger>
                                <SelectValue placeholder="Filter by status..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={"all"}>
                                    All Status
                                </SelectItem>
                                {APPLICATION_STATUS_OPTIONS.map(status => (
                                    <SelectItem key={status.value} value={status.value}>
                                        {status.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <CreateButton />
                    </div>
                </div>
            </div>

            <DataTable table={applicationTable} />
        </ListView>
    )
}
export default ApplicationsList
