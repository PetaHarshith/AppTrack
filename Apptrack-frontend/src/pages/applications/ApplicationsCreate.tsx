import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Breadcrumb } from '@/components/refine-ui/layout/breadcrumb';
import { APPLICATION_STATUSES, statusColors, statusIcons } from '@/constants';
import { Loader2, ArrowLeft, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { WORK_TYPE_OPTIONS, PRIORITY_OPTIONS, API_URL } from '@/constants';
import { cn } from '@/lib/utils';

const optionalDate = z.union([
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    z.literal(''),
    z.null(),
    z.undefined(),
]).optional();
const optionalText = z.union([z.string(), z.literal(''), z.null(), z.undefined()]).optional();

const createApplicationSchema = z.object({
    company: z.string().trim().min(1, 'Company name is required').max(120, 'Company name too long'),
    position: z.string().trim().min(1, 'Position is required').max(150, 'Position too long'),
    status: z.enum(['Applied', 'OA', 'Interview', 'Offer', 'Rejected', 'Withdrawn']).optional(),
    dateApplied: optionalDate,
    jobUrl: optionalText,
    notes: optionalText,
    interviewDate: optionalDate,
    oaDeadline: optionalDate,
    salary: optionalText,
    location: optionalText,
    workType: z.union([z.enum(['Internship', 'FullTime', 'Coop', 'Contract']), z.literal(''), z.null(), z.undefined()]).optional(),
    requiresSponsorship: z.union([z.boolean(), z.null(), z.undefined()]).optional(),
    priority: z.union([z.enum(['Dream', 'Target', 'Safety']), z.literal(''), z.null(), z.undefined()]).optional(),
});

type CreateApplicationFormData = z.infer<typeof createApplicationSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Section header — mono small-caps, matches list page's `// applications`
// ─────────────────────────────────────────────────────────────────────────────
const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        // {children}
    </p>
);

const FieldLabel = ({ htmlFor, children, required }: { htmlFor?: string; children: React.ReactNode; required?: boolean }) => (
    <label htmlFor={htmlFor} className="text-xs font-medium text-foreground mb-1.5 block">
        {children}
        {required && <span className="text-destructive ml-0.5">*</span>}
    </label>
);

// ─────────────────────────────────────────────────────────────────────────────
// Chip group — used for status / work type / priority
// ─────────────────────────────────────────────────────────────────────────────
type ChipOption = { value: string; label: string };
type ChipGroupProps = {
    options: ChipOption[];
    value: string | undefined;
    onChange: (v: string) => void;
    colorFor?: (v: string) => string | undefined;
    iconFor?: (v: string) => React.ReactNode;
    clearable?: boolean;
};

const ChipGroup = ({ options, value, onChange, colorFor, iconFor, clearable }: ChipGroupProps) => (
    <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
            const selected = value === o.value;
            const color = colorFor?.(o.value);
            return (
                <button
                    key={o.value}
                    type="button"
                    onClick={() => onChange(selected && clearable ? '' : o.value)}
                    style={
                        selected && color
                            ? { borderColor: color, color, backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)` }
                            : undefined
                    }
                    className={cn(
                        'inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-xs font-mono transition-colors',
                        selected
                            ? color
                                ? ''
                                : 'bg-foreground text-background border-foreground'
                            : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/40'
                    )}
                >
                    {iconFor?.(o.value)}
                    {o.label}
                </button>
            );
        })}
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
const ApplicationsCreate = () => {
    const navigate = useNavigate();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [importUrl, setImportUrl] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const [showMore, setShowMore] = useState(false);
    const importInputRef = useRef<HTMLInputElement>(null);

    // Deep link from command palette
    useEffect(() => {
        if (window.location.hash === '#import') {
            setTimeout(() => importInputRef.current?.focus(), 100);
        }
    }, []);

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        formState: { errors },
    } = useForm<CreateApplicationFormData>({
        resolver: zodResolver(createApplicationSchema),
        defaultValues: {
            company: '',
            position: '',
            status: 'Applied',
        },
        mode: 'onSubmit',
    });

    const watchedStatus = watch('status');
    const watchedWorkType = watch('workType');
    const watchedPriority = watch('priority');
    const watchedSponsorship = watch('requiresSponsorship');

    const handleImportUrl = async () => {
        if (!importUrl.trim()) {
            toast.error('Paste a job posting URL first');
            return;
        }
        setIsImporting(true);
        try {
            const res = await fetch(`${API_URL}/applications/import-url`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ url: importUrl.trim() }),
            });
            const json = await res.json();
            if (!res.ok || !json.ok) {
                if (json.reason === 'site_requires_login') {
                    toast.error("This site blocks automated reads — fill in manually");
                } else {
                    toast.error(json.message || "Couldn't parse this page — fill it in manually");
                }
                return;
            }
            const d = json.data;
            if (d.company) setValue('company', d.company, { shouldValidate: true });
            if (d.position) setValue('position', d.position, { shouldValidate: true });
            if (d.location) setValue('location', d.location);
            if (d.salary) setValue('salary', d.salary);
            if (d.workType) setValue('workType', d.workType);
            if (d.jobUrl) setValue('jobUrl', d.jobUrl);
            toast.success(`Imported from ${d.source}`);
            setShowMore(true);
        } catch {
            toast.error("Couldn't reach import service");
        } finally {
            setIsImporting(false);
        }
    };

    const onSubmit = async (data: CreateApplicationFormData) => {
        setIsSubmitting(true);
        try {
            const response = await fetch(`${API_URL}/applications`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create application');
            }
            await response.json();
            toast.success('Application added');
            navigate('/applications');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to create application');
        } finally {
            setIsSubmitting(false);
        }
    };

    const onError = (formErrors: typeof errors) => {
        const messages: string[] = [];
        if (formErrors.company) messages.push('Company name is required');
        if (formErrors.position) messages.push('Position is required');
        if (formErrors.dateApplied) messages.push('Invalid date format');
        if (messages.length === 1) toast.error(messages[0]);
        else if (messages.length > 1) toast.error(`Please fix: ${messages.join(', ')}`);
        else toast.error('Please fill in all required fields');
    };

    // ⌘↵ / Ctrl+↵ to submit from anywhere on the page
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                handleSubmit(onSubmit, onError)();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [handleSubmit]);

    const inputCls = 'h-10 font-mono text-sm';
    const errorCls = (hasError: boolean) =>
        hasError ? 'border-destructive focus-visible:ring-destructive' : '';

    return (
        <div className="max-w-3xl mx-auto px-6 pt-6 pb-32">
            <Breadcrumb />

            {/* ── Hero ─────────────────────────────────────────────────── */}
            <header className="mt-4 mb-8">
                <button
                    type="button"
                    onClick={() => navigate('/applications')}
                    className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors mb-3"
                >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    back to applications
                </button>
                <SectionLabel>new application</SectionLabel>
                <h1 className="text-4xl font-bold tracking-tight mt-1">New application</h1>
                <p className="text-sm text-muted-foreground mt-1.5">
                    Paste a job URL to auto-fill, or fill it in manually below.
                </p>
            </header>

            {/* ── Smart import (hero affordance, not a banner) ────────── */}
            <section className="mb-10 border-y border-border py-5">
                <div className="flex items-center justify-between mb-2.5">
                    <SectionLabel>smart import</SectionLabel>
                    <span className="font-mono text-[10px] text-muted-foreground">
                        greenhouse · lever · ashby · most ats
                    </span>
                </div>
                <div className="flex gap-2">
                    <Input
                        ref={importInputRef}
                        value={importUrl}
                        onChange={(e) => setImportUrl(e.target.value)}
                        placeholder="https://boards.greenhouse.io/..."
                        className="h-11 font-mono text-sm"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleImportUrl();
                            }
                        }}
                    />
                    <Button
                        type="button"
                        onClick={handleImportUrl}
                        disabled={isImporting}
                        variant="outline"
                        className="h-11 px-5 font-mono text-xs gap-2"
                    >
                        {isImporting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <>
                                Import
                                <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-border bg-muted/50">↵</kbd>
                            </>
                        )}
                    </Button>
                </div>
            </section>

            {/* ── Form ─────────────────────────────────────────────────── */}
            <form onSubmit={handleSubmit(onSubmit, onError)}>
                {/* Basics */}
                <section className="mb-10">
                    <SectionLabel>basics</SectionLabel>
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <FieldLabel htmlFor="company" required>Company</FieldLabel>
                            <Input
                                id="company"
                                {...register('company')}
                                placeholder="Google"
                                className={cn(inputCls, errorCls(!!errors.company))}
                            />
                            {errors.company && (
                                <p className="text-xs text-destructive mt-1">{errors.company.message}</p>
                            )}
                        </div>
                        <div>
                            <FieldLabel htmlFor="position" required>Position</FieldLabel>
                            <Input
                                id="position"
                                {...register('position')}
                                placeholder="Software Engineer"
                                className={cn(inputCls, errorCls(!!errors.position))}
                            />
                            {errors.position && (
                                <p className="text-xs text-destructive mt-1">{errors.position.message}</p>
                            )}
                        </div>
                    </div>

                    <div className="mt-5">
                        <FieldLabel>Status</FieldLabel>
                        <ChipGroup
                            options={APPLICATION_STATUSES.map((s) => ({ value: s, label: s }))}
                            value={watchedStatus}
                            onChange={(v) => setValue('status', v as CreateApplicationFormData['status'])}
                            colorFor={(v) => statusColors[v as keyof typeof statusColors]}
                            iconFor={(v) => statusIcons[v as keyof typeof statusIcons]}
                        />
                    </div>

                    <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <FieldLabel htmlFor="dateApplied">Date applied</FieldLabel>
                            <Input
                                id="dateApplied"
                                type="date"
                                {...register('dateApplied')}
                                className={inputCls}
                            />
                        </div>
                        <div>
                            <FieldLabel htmlFor="jobUrl">Job posting URL</FieldLabel>
                            <Input
                                id="jobUrl"
                                type="url"
                                {...register('jobUrl')}
                                placeholder="https://careers.company.com/..."
                                className={inputCls}
                            />
                        </div>
                    </div>
                </section>

                {/* Notes */}
                <section className="mb-10 border-t border-border pt-8">
                    <SectionLabel>notes</SectionLabel>
                    <div className="mt-4">
                        <Textarea
                            {...register('notes')}
                            placeholder="Referral contact, prep notes, recruiter name…"
                            rows={3}
                            className="font-mono text-sm resize-none"
                        />
                    </div>
                </section>

                {/* More fields — progressive disclosure */}
                <section className="mb-10 border-t border-border pt-6">
                    <button
                        type="button"
                        onClick={() => setShowMore((s) => !s)}
                        className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ChevronDown
                            className={cn(
                                'w-3.5 h-3.5 transition-transform',
                                showMore && 'rotate-180'
                            )}
                        />
                        {showMore ? '// hide more fields' : '// more fields (location, salary, type, priority, deadlines)'}
                    </button>

                    {showMore && (
                        <div className="mt-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <FieldLabel htmlFor="location">Location</FieldLabel>
                                    <Input
                                        id="location"
                                        {...register('location')}
                                        placeholder="San Francisco, CA"
                                        className={inputCls}
                                    />
                                </div>
                                <div>
                                    <FieldLabel htmlFor="salary">Salary</FieldLabel>
                                    <Input
                                        id="salary"
                                        {...register('salary')}
                                        placeholder="$120k – $150k"
                                        className={inputCls}
                                    />
                                </div>
                            </div>

                            <div>
                                <FieldLabel>Work type</FieldLabel>
                                <ChipGroup
                                    options={WORK_TYPE_OPTIONS}
                                    value={watchedWorkType || ''}
                                    onChange={(v) => setValue('workType', v as CreateApplicationFormData['workType'])}
                                    clearable
                                />
                            </div>

                            <div>
                                <FieldLabel>Priority</FieldLabel>
                                <ChipGroup
                                    options={PRIORITY_OPTIONS}
                                    value={watchedPriority || ''}
                                    onChange={(v) => setValue('priority', v as CreateApplicationFormData['priority'])}
                                    clearable
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <FieldLabel htmlFor="oaDeadline">OA deadline</FieldLabel>
                                    <Input
                                        id="oaDeadline"
                                        type="date"
                                        {...register('oaDeadline')}
                                        className={inputCls}
                                    />
                                </div>
                                <div>
                                    <FieldLabel htmlFor="interviewDate">Interview date</FieldLabel>
                                    <Input
                                        id="interviewDate"
                                        type="date"
                                        {...register('interviewDate')}
                                        className={inputCls}
                                    />
                                </div>
                            </div>

                            <label
                                htmlFor="requiresSponsorship"
                                className="flex items-center gap-2.5 cursor-pointer select-none"
                            >
                                <input
                                    id="requiresSponsorship"
                                    type="checkbox"
                                    checked={watchedSponsorship === true}
                                    onChange={(e) => setValue('requiresSponsorship', e.target.checked)}
                                    className="h-4 w-4 accent-foreground"
                                />
                                <span className="text-sm">I need visa sponsorship for this role</span>
                            </label>
                        </div>
                    )}
                </section>
            </form>

            {/* ── Sticky action bar ───────────────────────────────────── */}
            <div className="fixed bottom-0 left-0 right-0 md:left-[var(--sidebar-width,16rem)] border-t border-border bg-background/95 backdrop-blur z-30">
                <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
                    <span className="font-mono text-[10px] text-muted-foreground hidden sm:inline">
                        <span className="text-destructive">*</span> required
                    </span>
                    <div className="flex items-center gap-2 ml-auto">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => navigate('/applications')}
                            disabled={isSubmitting}
                            className="h-9 font-mono text-xs"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={handleSubmit(onSubmit, onError)}
                            disabled={isSubmitting}
                            className="h-9 font-mono text-xs gap-2 min-w-[170px]"
                        >
                            {isSubmitting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    Create application
                                    <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-foreground/20 bg-background/20">
                                        ⌘↵
                                    </kbd>
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ApplicationsCreate;
