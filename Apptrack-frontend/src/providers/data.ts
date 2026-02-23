import {createDataProvider, CreateDataProviderOptions} from "@refinedev/rest";
import {BACKEND_URL} from "@/constants";
import {ListResponse} from "@/types";

if (!BACKEND_URL) {
    throw new Error('Missing backend URL');
}
const options: CreateDataProviderOptions = {
    getList: {
        getEndpoint: ({resource}) => resource,

        buildQueryParams: async ({resource, pagination, filters}) => {
            const page = pagination?.currentPage ?? 1;
            const pageSize = pagination?.pageSize ?? 10;

            const params: Record<string, string | number> = {page, limit: pageSize};

            filters?.forEach((filter) => {
                const field = 'field' in filter ? filter.field : '';
                const value = String(filter.value);

                if (resource === 'applications') {
                    if (field === 'company') {
                        params.search = value;
                    }
                    if (field === 'status') {
                        params.status = value;
                    }
                }
            });

            return params;
        },

        mapResponse: async (response) => {
            const payload: ListResponse = await response.clone().json();
            return payload.data ?? [];
        },

        getTotalCount: async (response) => {
            const payload: ListResponse = await response.clone().json();
            return payload.pagination?.total ?? payload.data?.length ?? 0;
        }
    }
}

const {dataProvider} = createDataProvider(BACKEND_URL, options);
export {dataProvider};