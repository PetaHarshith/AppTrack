import React, {useMemo, useState} from 'react'
import {ListView} from "@/components/refine-ui/views/list-view.tsx";
import {Breadcrumb} from "@/components/refine-ui/layout/breadcrumb.tsx";
import {Search} from "lucide-react";
import {Input} from "@/components/ui/input.tsx";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select.tsx";
import {DEPARTMENT_OPTIONS} from "@/constants";
import {CreateButton} from "@/components/refine-ui/buttons/create.tsx";
import {DataTable} from "@/components/refine-ui/data-table/data-table.tsx";
import {useTable} from "@refinedev/react-table";
import {Company} from "@/types";
import {ColumnDef} from "@tanstack/react-table";
import {Badge} from "@/components/ui/badge.tsx";

const CompaniesList = () => {

    const [searchQuery, setSearchQuery] = useState("");
    const [selectDept, setSelectDept] = useState("all");

    // Task: we need to filter by company and department
    const departmentFilters = selectDept === "all" ? [] : [
        {field: "department", operator: "eq" as const, value: selectDept},
    ];

    const searchFilters = searchQuery ? [
        {field: 'name', operator: "contains" as const, value: searchQuery},
    ] : [];

    const companyTable = useTable<Company>({
        columns: useMemo<ColumnDef<Company>[]>(() => [
            {
                id: 'code',
                accessorKey: 'code',
                size: 100,
                header: () => <p className="column-title ml-2">Code</p>,
                cell: ({getValue}) => <Badge>{getValue<string>()}</Badge>
            },
            {
                id: 'name',
                accessorKey: 'name',
                size: 100,
                header: () => <p className="column-title">Name</p>,
                cell: ({getValue}) => <span className="text-foreground">{getValue<string>()}</span>,
                filterFn: 'includesString'
            },
            {
                id: 'department',
                accessorKey: 'department',
                size: 150,
                header: () => <p className="column-title">Department</p>,
                cell: ({getValue}) => <Badge variant="secondary">{getValue<string>()}</Badge>,
            },
            {
                id: 'description',
                accessorKey: 'description',
                size: 300,
                header: () => <p className="column-title">Description</p>,
                cell: ({getValue}) => <span className="truncate line-clamp-2">{getValue<string>()}</span>,
            }
        ], []),

        refineCoreProps: {
            resource: 'companies',
            pagination: {pageSize: 10, mode: 'server'},
            filters: {
                permanent: [...departmentFilters, ...searchFilters],
            },
            sorters: {
                initial: [
                    {field: 'id', order: 'desc'}
                ]
            },
        }
    });

    return (
        <ListView>
            <Breadcrumb/>
            <h1 className="page-title">Companies</h1>

            <div className="intro-row">
                <p>Quick access to essential metrics and management tools.</p>

                <div className="actions-row">
                    <div className="search-field">
                        <Search className="search-icon"/>
                        <Input
                            type="text"
                            placeholder="Search by company...."
                            className="pl-10 w-full"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Select value={selectDept} onValueChange={setSelectDept}>
                            <SelectTrigger>
                                <SelectValue placeholder="Filter by department...."/>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={"all"}>
                                    All Roles
                                </SelectItem>
                                {DEPARTMENT_OPTIONS.map(dept => (
                                    <SelectItem key={dept.value} value={dept.value}>
                                        {dept.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <CreateButton/>
                    </div>
                </div>
            </div>

            <DataTable table={companyTable}/>
        </ListView>
    )
}
export default CompaniesList
