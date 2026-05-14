import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router';
import gsap from 'gsap';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { APPLICATION_STATUSES } from '@/constants';
import { Loader2, Briefcase, Building2, Calendar, Link2, FileText, ArrowLeft, Send, Sparkles, DollarSign, MapPin, Globe, ShieldAlert, Star } from 'lucide-react';
import { toast } from 'sonner';
import { WORK_TYPE_OPTIONS, PRIORITY_OPTIONS, API_URL } from '@/constants';

const optionalDate = z.union([
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    z.literal(''),
    z.null(),
    z.undefined(),
]).optional();
const optionalText = z.union([z.string(), z.literal(''), z.null(), z.undefined()]).optional();

// Zod schema matching backend validation
// NOTE: userId is NOT included - backend uses authenticated user's ID
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

const ApplicationsCreate = () => {
    const navigate = useNavigate();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [importUrl, setImportUrl] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const cardRef = useRef<HTMLDivElement>(null);
    const headerRef = useRef<HTMLDivElement>(null);
    const importInputRef = useRef<HTMLInputElement>(null);

    // Deep link from command palette: focus the import field when arriving with #import
    useEffect(() => {
        if (window.location.hash === '#import') {
            setTimeout(() => importInputRef.current?.focus(), 300);
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
            setShowDetails(true);
        } catch {
            toast.error("Couldn't reach import service");
        } finally {
            setIsImporting(false);
        }
    };

    // Smooth entrance animation
    useEffect(() => {
        const ctx = gsap.context(() => {
            // Background gradient animation
            gsap.to(containerRef.current, {
                backgroundPosition: '100% 50%',
                duration: 8,
                ease: 'none',
                repeat: -1,
                yoyo: true,
            });

            // Card entrance
            gsap.fromTo(cardRef.current,
                { opacity: 0, y: 40, scale: 0.95 },
                { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: 'power3.out' }
            );

            // Header slide in
            gsap.fromTo(headerRef.current,
                { opacity: 0, x: -20 },
                { opacity: 1, x: 0, duration: 0.5, delay: 0.2, ease: 'power2.out' }
            );

            // Form fields stagger
            gsap.fromTo('.form-field',
                { opacity: 0, y: 15 },
                { opacity: 1, y: 0, duration: 0.4, stagger: 0.08, delay: 0.3, ease: 'power2.out' }
            );
        });

        return () => ctx.revert();
    }, []);

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

            // Success animation
            gsap.to(cardRef.current, {
                scale: 0.98,
                opacity: 0,
                y: -20,
                duration: 0.3,
                ease: 'power2.in',
                onComplete: () => {
                    toast.success('Application added successfully!');
                    navigate('/applications');
                },
            });
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to create application');
            // Shake animation
            gsap.fromTo(cardRef.current,
                { x: -8 },
                { x: 8, duration: 0.08, repeat: 4, yoyo: true, ease: 'power2.inOut' }
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const onError = (formErrors: typeof errors) => {
        // Build a user-friendly list of missing/invalid fields
        const errorMessages: string[] = [];

        if (formErrors.company) {
            errorMessages.push('Company name is required');
        }
        if (formErrors.position) {
            errorMessages.push('Position is required');
        }
        if (formErrors.dateApplied) {
            errorMessages.push('Invalid date format');
        }

        // Show specific error or generic message
        if (errorMessages.length === 1) {
            toast.error(errorMessages[0]);
        } else if (errorMessages.length > 1) {
            toast.error(`Please fix: ${errorMessages.join(', ')}`);
        } else {
            toast.error('Please fill in all required fields');
        }

        gsap.fromTo(cardRef.current,
            { x: -5 },
            { x: 5, duration: 0.08, repeat: 3, yoyo: true, ease: 'power2.inOut' }
        );
    };

    return (
        <div
            ref={containerRef}
            className="min-h-screen p-4 md:p-8"
            style={{
                background: 'linear-gradient(135deg, hsl(var(--background)) 0%, hsl(var(--muted)) 50%, hsl(var(--background)) 100%)',
                backgroundSize: '200% 200%',
            }}
        >
            {/* Header */}
            <div ref={headerRef} className="max-w-2xl mx-auto mb-6">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/applications')}
                    className="mb-4 -ml-2 text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Applications
                </Button>
                <h1 className="text-2xl font-bold text-foreground">Track New Application</h1>
                <p className="text-muted-foreground text-sm mt-1">
                    <span className="text-destructive">*</span> indicates required fields
                </p>
            </div>

            {/* Main Card */}
            <div
                ref={cardRef}
                className="max-w-2xl mx-auto bg-card border border-border rounded-2xl shadow-xl overflow-hidden"
            >
                <form onSubmit={handleSubmit(onSubmit, onError)}>
                    {/* Smart Import */}
                    <div className="form-field px-6 pt-6">
                        <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3">
                            <div className="flex items-center gap-2 mb-2">
                                <Sparkles className="w-4 h-4 text-primary" />
                                <span className="text-sm font-medium">Smart Import</span>
                                <span className="text-xs text-muted-foreground">Greenhouse, Lever, Ashby & most ATS pages</span>
                            </div>
                            <div className="flex gap-2">
                                <Input
                                    ref={importInputRef}
                                    value={importUrl}
                                    onChange={(e) => setImportUrl(e.target.value)}
                                    placeholder="https://boards.greenhouse.io/..."
                                    className="h-9 font-mono text-sm"
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
                                    size="sm"
                                    className="h-9"
                                >
                                    {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Import'}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Form Content */}
                    <div className="p-6 space-y-5">
                        {/* Row 1: Company & Position */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="form-field space-y-1.5">
                                <Label htmlFor="company" className="flex items-center gap-2 text-sm font-medium">
                                    <Building2 className="w-4 h-4 text-muted-foreground" />
                                    Company <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="company"
                                    {...register('company')}
                                    placeholder="Google, Meta, etc."
                                    className={`h-10 ${errors.company ? 'border-destructive ring-1 ring-destructive' : ''}`}
                                />
                                {errors.company && (
                                    <p className="text-xs text-destructive">{errors.company.message}</p>
                                )}
                            </div>

                            <div className="form-field space-y-1.5">
                                <Label htmlFor="position" className="flex items-center gap-2 text-sm font-medium">
                                    <Briefcase className="w-4 h-4 text-muted-foreground" />
                                    Position <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="position"
                                    {...register('position')}
                                    placeholder="Software Engineer"
                                    className={`h-10 ${errors.position ? 'border-destructive ring-1 ring-destructive' : ''}`}
                                />
                                {errors.position && (
                                    <p className="text-xs text-destructive">{errors.position.message}</p>
                                )}
                            </div>
                        </div>

                        {/* Row 2: Status & Date */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="form-field space-y-1.5">
                                <Label className="text-sm font-medium">Status</Label>
                                <Select
                                    value={watchedStatus}
                                    onValueChange={(value) => setValue('status', value as any)}
                                >
                                    <SelectTrigger className="h-10">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {APPLICATION_STATUSES.map((status) => (
                                            <SelectItem key={status} value={status}>
                                                {status}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="form-field space-y-1.5">
                                <Label htmlFor="dateApplied" className="flex items-center gap-2 text-sm font-medium">
                                    <Calendar className="w-4 h-4 text-muted-foreground" />
                                    Date Applied
                                </Label>
                                <Input
                                    id="dateApplied"
                                    type="date"
                                    {...register('dateApplied')}
                                    className="h-10"
                                />
                            </div>
                        </div>

                        {/* Row 3: Job URL */}
                        <div className="form-field space-y-1.5">
                            <Label htmlFor="jobUrl" className="flex items-center gap-2 text-sm font-medium">
                                <Link2 className="w-4 h-4 text-muted-foreground" />
                                Job Posting URL
                            </Label>
                            <Input
                                id="jobUrl"
                                type="url"
                                {...register('jobUrl')}
                                placeholder="https://careers.company.com/job/..."
                                className="h-10"
                            />
                        </div>

                        {/* Row 4: Notes */}
                        <div className="form-field space-y-1.5">
                            <Label htmlFor="notes" className="flex items-center gap-2 text-sm font-medium">
                                <FileText className="w-4 h-4 text-muted-foreground" />
                                Notes
                            </Label>
                            <Textarea
                                id="notes"
                                {...register('notes')}
                                placeholder="Referral contact, interview prep notes, etc."
                                rows={2}
                                className="resize-none"
                            />
                        </div>

                        {/* Details toggle */}
                        <button
                            type="button"
                            onClick={() => setShowDetails((s) => !s)}
                            className="text-sm text-primary hover:underline"
                        >
                            {showDetails ? '− Hide additional details' : '+ Add more details (location, salary, type, deadlines)'}
                        </button>

                        {showDetails && (
                            <div className="space-y-4 pt-2 border-t border-dashed">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="form-field space-y-1.5">
                                        <Label htmlFor="location" className="flex items-center gap-2 text-sm font-medium">
                                            <MapPin className="w-4 h-4 text-muted-foreground" /> Location
                                        </Label>
                                        <Input id="location" {...register('location')} placeholder="San Francisco, CA" className="h-10" />
                                    </div>
                                    <div className="form-field space-y-1.5">
                                        <Label htmlFor="salary" className="flex items-center gap-2 text-sm font-medium">
                                            <DollarSign className="w-4 h-4 text-muted-foreground" /> Salary
                                        </Label>
                                        <Input id="salary" {...register('salary')} placeholder="$120k–$150k" className="h-10" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="form-field space-y-1.5">
                                        <Label className="flex items-center gap-2 text-sm font-medium">
                                            <Globe className="w-4 h-4 text-muted-foreground" /> Work Type
                                        </Label>
                                        <Select
                                            value={watchedWorkType || ''}
                                            onValueChange={(v) => setValue('workType', v as any)}
                                        >
                                            <SelectTrigger className="h-10"><SelectValue placeholder="Pick a type" /></SelectTrigger>
                                            <SelectContent>
                                                {WORK_TYPE_OPTIONS.map(o => (
                                                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="form-field space-y-1.5">
                                        <Label className="flex items-center gap-2 text-sm font-medium">
                                            <Star className="w-4 h-4 text-muted-foreground" /> Priority
                                        </Label>
                                        <Select
                                            value={watchedPriority || ''}
                                            onValueChange={(v) => setValue('priority', v as any)}
                                        >
                                            <SelectTrigger className="h-10"><SelectValue placeholder="Pick a tier" /></SelectTrigger>
                                            <SelectContent>
                                                {PRIORITY_OPTIONS.map(o => (
                                                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="form-field space-y-1.5">
                                        <Label htmlFor="oaDeadline" className="flex items-center gap-2 text-sm font-medium">
                                            <Calendar className="w-4 h-4 text-muted-foreground" /> OA Deadline
                                        </Label>
                                        <Input id="oaDeadline" type="date" {...register('oaDeadline')} className="h-10" />
                                    </div>
                                    <div className="form-field space-y-1.5">
                                        <Label htmlFor="interviewDate" className="flex items-center gap-2 text-sm font-medium">
                                            <Calendar className="w-4 h-4 text-muted-foreground" /> Interview Date
                                        </Label>
                                        <Input id="interviewDate" type="date" {...register('interviewDate')} className="h-10" />
                                    </div>
                                </div>
                                <div className="form-field flex items-center gap-3 p-3 rounded-md bg-muted/30">
                                    <input
                                        id="requiresSponsorship"
                                        type="checkbox"
                                        checked={watchedSponsorship === true}
                                        onChange={(e) => setValue('requiresSponsorship', e.target.checked)}
                                        className="h-4 w-4"
                                    />
                                    <Label htmlFor="requiresSponsorship" className="flex items-center gap-2 cursor-pointer text-sm">
                                        <ShieldAlert className="w-4 h-4 text-muted-foreground" />
                                        I need visa sponsorship for this role
                                    </Label>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer / Actions */}
                    <div className="px-6 py-4 bg-muted/30 border-t border-border flex items-center justify-end gap-3">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => navigate('/applications')}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="min-w-[140px]"
                        >
                            {isSubmitting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    <Send className="w-4 h-4 mr-2" />
                                    Add Application
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ApplicationsCreate;
