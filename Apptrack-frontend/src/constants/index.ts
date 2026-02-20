import CompaniesList from "@/pages/companies/CompaniesList.tsx";

export const DEPARTMENTS = ['SDE', 'Product Manager', 'AI/ML', 'Cloud', 'Data Engineer'];
export const DEPARTMENT_OPTIONS = DEPARTMENTS.map((department) => ({
    value: department,
    label: department,
}));