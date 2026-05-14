import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams } from 'react-router';
import gsap from 'gsap';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { APPLICATION_STATUSES, API_URL, WORK_TYPE_OPTIONS, PRIORITY_OPTIONS } from '@/constants';
import { Loader2, Briefcase, Building2, Calendar, Link2, FileText, ArrowLeft, Save, Trash2, MapPin, DollarSign, Globe, Star, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Application } from '@/types';

const optionalDate = z.union([
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    z.literal(''),
    z.null(),
    z.undefined(),
]).optional();
const optionalText = z.union([z.string(), z.literal(''), z.null(), z.undefined()]).optional();

const editApplicationSchema = z.object({
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

type EditApplicationFormData = z.infer<typeof editApplicationSchema>;

const ApplicationsEdit = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [loading, setLoading] = useState(true);
    const cardRef = useRef<HTMLDivElement>(null);

    const { register, handleSubmit, setValue, watch, formState: { errors }, reset } = useForm<EditApplicationFormData>({
        resolver: zodResolver(editApplicationSchema),
        mode: 'onSubmit',
    });

    const watchedStatus = watch('status');
    const watchedWorkType = watch('workType');
    const watchedPriority = watch('priority');
    const watchedSponsorship = watch('requiresSponsorship');

    // Fetch application data
    useEffect(() => {
        const fetchApplication = async () => {
            try {
                const response = await fetch(`${API_URL}/applications/${id}`, {
                    credentials: 'include',
                });
                if (!response.ok) throw new Error('Failed to fetch application');
                const data = await response.json();
                const app: Application = data.data;

                reset({
                    company: app.company,
                    position: app.position,
                    status: app.status,
                    dateApplied: app.dateApplied || '',
                    jobUrl: app.jobUrl || '',
                    notes: app.notes || '',
                    interviewDate: app.interviewDate || '',
                    oaDeadline: app.oaDeadline || '',
                    salary: app.salary || '',
                    location: app.location || '',
                    workType: (app.workType as any) || '',
                    requiresSponsorship: app.requiresSponsorship ?? undefined,
                    priority: (app.priority as any) || '',
                });
            } catch (error) {
                toast.error('Failed to load application');
                navigate('/applications');
            } finally {
                setLoading(false);
            }
        };
        fetchApplication();
    }, [id, reset, navigate]);

    // Animation
    useEffect(() => {
        if (!loading && cardRef.current) {
            gsap.fromTo(cardRef.current, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4 });
        }
    }, [loading]);

    const onSubmit = async (data: EditApplicationFormData) => {
        setIsSubmitting(true);
        try {
            const response = await fetch(`${API_URL}/applications/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update application');
            }

            toast.success('Application updated!');
            navigate('/applications');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to update');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this application?')) return;

        setIsDeleting(true);
        try {
            const response = await fetch(`${API_URL}/applications/${id}`, {
                method: 'DELETE',
                credentials: 'include',
            });

            if (!response.ok) throw new Error('Failed to delete');

            toast.success('Application deleted');
            navigate('/applications');
        } catch (error) {
            toast.error('Failed to delete application');
        } finally {
            setIsDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <div className="max-w-2xl mx-auto">
                <Button variant="ghost" onClick={() => navigate('/applications')} className="mb-6 gap-2">
                    <ArrowLeft className="h-4 w-4" /> Back to Applications
                </Button>

                <div ref={cardRef} className="bg-card border border-border rounded-2xl shadow-lg p-6 md:p-8">
                    <div className="flex items-center justify-between mb-6">
                        <h1 className="text-2xl font-bold text-foreground">Edit Application</h1>
                        <Button variant="destructive" size="sm" onClick={handleDelete} disabled={isDeleting} className="gap-2">
                            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            Delete
                        </Button>
                    </div>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                        {/* Company & Position */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="company" className="flex items-center gap-2">
                                    <Building2 className="h-4 w-4 text-muted-foreground" /> Company *
                                </Label>
                                <Input id="company" {...register('company')} placeholder="Google, Meta, etc." />
                                {errors.company && <p className="text-sm text-destructive">{errors.company.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="position" className="flex items-center gap-2">
                                    <Briefcase className="h-4 w-4 text-muted-foreground" /> Position *
                                </Label>
                                <Input id="position" {...register('position')} placeholder="Software Engineer" />
                                {errors.position && <p className="text-sm text-destructive">{errors.position.message}</p>}
                            </div>
                        </div>

                        {/* Status & Date */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">Status</Label>
                                <Select value={watchedStatus} onValueChange={(value) => setValue('status', value as any)}>
                                    <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                                    <SelectContent>
                                        {APPLICATION_STATUSES.map((status) => (
                                            <SelectItem key={status} value={status}>{status}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="dateApplied" className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-muted-foreground" /> Date Applied
                                </Label>
                                <Input id="dateApplied" type="date" {...register('dateApplied')} />
                            </div>
                        </div>

                        {/* Job URL */}
                        <div className="space-y-2">
                            <Label htmlFor="jobUrl" className="flex items-center gap-2">
                                <Link2 className="h-4 w-4 text-muted-foreground" /> Job URL
                            </Label>
                            <Input id="jobUrl" type="url" {...register('jobUrl')} placeholder="https://..." />
                        </div>

                        {/* Notes */}
                        <div className="space-y-2">
                            <Label htmlFor="notes" className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-muted-foreground" /> Notes
                            </Label>
                            <Textarea id="notes" {...register('notes')} placeholder="Any notes..." rows={4} />
                        </div>

                        {/* Additional Details */}
                        <div className="pt-4 border-t border-dashed space-y-4">
                            <p className="text-sm font-medium text-muted-foreground">Additional Details</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="location" className="flex items-center gap-2">
                                        <MapPin className="h-4 w-4 text-muted-foreground" /> Location
                                    </Label>
                                    <Input id="location" {...register('location')} placeholder="San Francisco, CA" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="salary" className="flex items-center gap-2">
                                        <DollarSign className="h-4 w-4 text-muted-foreground" /> Salary
                                    </Label>
                                    <Input id="salary" {...register('salary')} placeholder="$120k–$150k" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <Globe className="h-4 w-4 text-muted-foreground" /> Work Type
                                    </Label>
                                    <Select value={watchedWorkType || ''} onValueChange={(v) => setValue('workType', v as any)}>
                                        <SelectTrigger><SelectValue placeholder="Pick a type" /></SelectTrigger>
                                        <SelectContent>
                                            {WORK_TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <Star className="h-4 w-4 text-muted-foreground" /> Priority
                                    </Label>
                                    <Select value={watchedPriority || ''} onValueChange={(v) => setValue('priority', v as any)}>
                                        <SelectTrigger><SelectValue placeholder="Pick a tier" /></SelectTrigger>
                                        <SelectContent>
                                            {PRIORITY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="oaDeadline" className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-muted-foreground" /> OA Deadline
                                    </Label>
                                    <Input id="oaDeadline" type="date" {...register('oaDeadline')} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="interviewDate" className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-muted-foreground" /> Interview Date
                                    </Label>
                                    <Input id="interviewDate" type="date" {...register('interviewDate')} />
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 rounded-md bg-muted/30">
                                <input
                                    id="requiresSponsorship"
                                    type="checkbox"
                                    checked={watchedSponsorship === true}
                                    onChange={(e) => setValue('requiresSponsorship', e.target.checked)}
                                    className="h-4 w-4"
                                />
                                <Label htmlFor="requiresSponsorship" className="flex items-center gap-2 cursor-pointer text-sm">
                                    <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                                    I need visa sponsorship for this role
                                </Label>
                            </div>
                        </div>

                        {/* Submit */}
                        <Button type="submit" disabled={isSubmitting} className="w-full gap-2">
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            {isSubmitting ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ApplicationsEdit;
