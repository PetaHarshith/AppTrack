import { BaseRecord, DataProvider, GetListParams } from "@refinedev/core";
import { API_URL } from "@/constants";
import { ListResponse } from "@/types";

// Custom data provider that includes credentials for cookie-based auth
export const dataProvider: DataProvider = {
    getList: async <TData extends BaseRecord = BaseRecord>(listParams: GetListParams) => {
        const { resource, pagination, filters, sorters } = listParams;
        const page = (pagination as any)?.current ?? (pagination as any)?.currentPage ?? 1;
        const pageSize = pagination?.pageSize ?? 10;

        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('limit', String(pageSize));

        // Handle filters
        filters?.forEach((filter) => {
            const field = 'field' in filter ? filter.field : '';
            const value = filter.value;

            if (!value || value === '' || value === 'undefined' || value === 'null') {
                return;
            }

            if (resource === 'applications') {
                if (field === 'company') {
                    params.set('search', String(value));
                }
                if (field === 'status') {
                    params.set('status', String(value));
                }
            }
        });

        // Handle sorters
        if (sorters && sorters.length > 0) {
            const primarySorter = sorters[0];
            params.set('sort', primarySorter.field);
            params.set('order', primarySorter.order);
        }

        const response = await fetch(`${API_URL}/${resource}?${params.toString()}`, {
            credentials: 'include',
        });

        const payload: ListResponse<TData> = await response.json();

        return {
            data: payload.data ?? [],
            total: payload.pagination?.total ?? payload.data?.length ?? 0,
        };
    },

    getOne: async ({ resource, id }) => {
        const response = await fetch(`${API_URL}/${resource}/${id}`, {
            credentials: 'include',
        });
        const payload = await response.json();
        return { data: payload.data };
    },

    create: async ({ resource, variables }) => {
        const response = await fetch(`${API_URL}/${resource}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(variables),
        });
        const payload = await response.json();
        return { data: payload.data };
    },

    update: async ({ resource, id, variables }) => {
        const response = await fetch(`${API_URL}/${resource}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(variables),
        });
        const payload = await response.json();
        return { data: payload.data };
    },

    deleteOne: async ({ resource, id }) => {
        const response = await fetch(`${API_URL}/${resource}/${id}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        const payload = await response.json();
        return { data: payload.data };
    },

    getApiUrl: () => API_URL,
};
