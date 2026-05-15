import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useSession, authClient, signOut } from '@/lib/auth-client'
import { useNavigate } from 'react-router'
import { Trash2, Check, Loader2, Sun, Moon, Monitor, LogOut, AtSign, RotateCcw, Sparkles, Terminal, BookOpen, Square, Cloud } from 'lucide-react'
import { useTheme } from '@/components/refine-ui/theme/theme-provider'
import { cn } from '@/lib/utils'
import { API_URL } from '@/constants'
import { GenerativeAvatar } from '@/components/dataviz/GenerativeAvatar'
import {
    useAppearance,
    type Preset,
    type Density,
    type Font,
    type Radius,
    type Accent,
    type Background,
} from '@/lib/appearance'

const accentSwatches: { value: Accent; label: string; color: string }[] = [
    { value: 'default', label: 'Sunset', color: 'oklch(0.6420 0.1691 38.5815)' },
    { value: 'rose', label: 'Rose', color: 'oklch(0.6455 0.2123 12.5913)' },
    { value: 'orange', label: 'Amber', color: 'oklch(0.7050 0.1912 47.6042)' },
    { value: 'green', label: 'Pine', color: 'oklch(0.6237 0.1697 145.4743)' },
    { value: 'blue', label: 'Ocean', color: 'oklch(0.6232 0.1665 253.1006)' },
    { value: 'violet', label: 'Iris', color: 'oklch(0.6058 0.2315 292.7551)' },
]

const presetCards: { value: Exclude<Preset, 'custom'>; label: string; tagline: string; icon: typeof Sparkles }[] = [
    { value: 'default', label: 'Default', tagline: 'Clean and balanced', icon: Sparkles },
    { value: 'terminal', label: 'Terminal', tagline: 'Mono, sharp, grid', icon: Terminal },
    { value: 'editorial', label: 'Editorial', tagline: 'Serif, soft, cozy', icon: BookOpen },
    { value: 'brutal', label: 'Brutal', tagline: 'No corners, raw lines', icon: Square },
    { value: 'soft', label: 'Soft', tagline: 'Pill, noise, violet', icon: Cloud },
]

const modeOptions = [
    { value: 'light' as const, label: 'Light', icon: Sun },
    { value: 'dark' as const, label: 'Dark', icon: Moon },
    { value: 'system' as const, label: 'System', icon: Monitor },
]

const densityOptions: { value: Density; label: string }[] = [
    { value: 'compact', label: 'Compact' },
    { value: 'comfortable', label: 'Comfortable' },
    { value: 'cozy', label: 'Cozy' },
]
const fontOptions: { value: Font; label: string; sample: string }[] = [
    { value: 'sans', label: 'Sans', sample: 'Aa' },
    { value: 'mono', label: 'Mono', sample: '{ }' },
    { value: 'serif', label: 'Serif', sample: 'Aa' },
]
const radiusOptions: { value: Radius; label: string; px: string }[] = [
    { value: 'sharp', label: 'Sharp', px: '0px' },
    { value: 'default', label: 'Default', px: '8px' },
    { value: 'soft', label: 'Soft', px: '14px' },
    { value: 'pill', label: 'Pill', px: '24px' },
]
const bgOptions: { value: Background; label: string }[] = [
    { value: 'none', label: 'None' },
    { value: 'dots', label: 'Dots' },
    { value: 'grid', label: 'Grid' },
    { value: 'lines', label: 'Lines' },
    { value: 'noise', label: 'Noise' },
]

const SectionLabel = ({ label }: { label: string }) => (
    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        // {label}
    </p>
)

const KnobRow = ({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) => (
    <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-3 md:gap-10 py-6 border-b border-border last:border-b-0">
        <div>
            <p className="text-sm font-semibold text-foreground">{label}</p>
            <p className="text-xs text-muted-foreground mt-1 leading-snug max-w-[220px]">{hint}</p>
        </div>
        <div>{children}</div>
    </div>
)

const PickButton = ({
    selected,
    onClick,
    children,
    wide,
}: {
    selected: boolean
    onClick: () => void
    children: React.ReactNode
    wide?: boolean
}) => (
    <button
        type="button"
        onClick={onClick}
        className={cn(
            'group relative flex flex-col items-center justify-center gap-1 px-3 transition-all text-sm',
            wide ? 'py-3.5' : 'py-3',
            'rounded-xl border',
            selected
                ? 'border-foreground/80 bg-foreground/[0.03] text-foreground font-medium shadow-sm'
                : 'border-border/60 text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:bg-foreground/[0.02]'
        )}
    >
        {children}
    </button>
)

// Mini visual rendered inside each preset card. Each one is a deliberate
// scene capturing the preset's identity — type, geometry, color, texture.
const PresetVisual = ({ variant }: { variant: Exclude<Preset, 'custom'> }) => {
    switch (variant) {
        case 'default':
            return (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-100 dark:from-zinc-900 dark:to-zinc-800">
                    <div className="bg-white dark:bg-zinc-950 rounded-lg shadow-sm px-3 py-2 flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                        <span className="text-[10px] font-medium text-zinc-900 dark:text-zinc-100">Applied</span>
                    </div>
                </div>
            )
        case 'terminal':
            return (
                <div
                    className="absolute inset-0 bg-zinc-950 flex items-center justify-center"
                    style={{
                        backgroundImage:
                            'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
                        backgroundSize: '12px 12px',
                    }}
                >
                    <div
                        className="text-[11px] flex items-center gap-1"
                        style={{ fontFamily: 'JetBrains Mono, Fira Code, monospace' }}
                    >
                        <span className="text-emerald-400">$</span>
                        <span className="text-zinc-300">apply</span>
                        <span className="inline-block w-1.5 h-3 bg-emerald-400 animate-pulse" />
                    </div>
                </div>
            )
        case 'editorial':
            return (
                <div className="absolute inset-0 flex items-center justify-center bg-amber-50 dark:bg-amber-950/30">
                    <div className="text-center">
                        <p
                            className="text-3xl leading-none"
                            style={{ fontFamily: 'Merriweather, Georgia, serif', fontStyle: 'italic' }}
                        >
                            Aa
                        </p>
                        <p
                            className="text-[9px] tracking-[0.25em] uppercase text-amber-700 dark:text-amber-400 mt-1.5"
                            style={{ fontFamily: 'Merriweather, Georgia, serif' }}
                        >
                            Issue 01
                        </p>
                    </div>
                </div>
            )
        case 'brutal':
            return (
                <div
                    className="absolute inset-0 bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center"
                    style={{
                        backgroundImage:
                            'repeating-linear-gradient(0deg, currentColor 0, currentColor 1px, transparent 1px, transparent 6px)',
                        color: 'rgba(0,0,0,0.08)',
                    }}
                >
                    <div className="bg-foreground text-background text-[10px] font-bold tracking-tight uppercase px-2.5 py-1">
                        Apply now
                    </div>
                </div>
            )
        case 'soft':
            return (
                <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{
                        background:
                            'radial-gradient(circle at 30% 30%, oklch(0.85 0.10 292) 0%, oklch(0.92 0.05 292) 100%)',
                    }}
                >
                    <div className="flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded-full bg-white/90 shadow-sm" />
                        <span className="h-2 w-12 rounded-full bg-violet-600/80" />
                        <span className="h-2 w-6 rounded-full bg-violet-400/60" />
                    </div>
                </div>
            )
    }
}

const BgPreview = ({ kind }: { kind: Background }) => {
    const styles: Record<Background, React.CSSProperties> = {
        none: {},
        dots: {
            backgroundImage: 'radial-gradient(circle, currentColor 0.5px, transparent 0.5px)',
            backgroundSize: '6px 6px',
        },
        grid: {
            backgroundImage:
                'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)',
            backgroundSize: '8px 8px',
        },
        lines: {
            backgroundImage: 'linear-gradient(currentColor 1px, transparent 1px)',
            backgroundSize: '100% 4px',
        },
        noise: {
            backgroundImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.4 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        },
    }
    return (
        <span
            className="block w-7 h-7 mb-1 rounded-md text-foreground/35"
            style={{
                ...styles[kind],
                outline: '1px solid color-mix(in srgb, currentColor 25%, transparent)',
                outlineOffset: '-1px',
            }}
        />
    )
}

const Profile = () => {
    const { data: session, isPending } = useSession()
    const navigate = useNavigate()
    const { theme, setTheme } = useTheme()
    const { appearance, update, applyPreset, reset } = useAppearance()

    const [name, setName] = useState(session?.user?.name || '')
    const [isUpdating, setIsUpdating] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [updateSuccess, setUpdateSuccess] = useState(false)

    const [accountStats, setAccountStats] = useState<{ totalApps: number; offers: number; memberSince: string | null }>({
        totalApps: 0, offers: 0, memberSince: null,
    })

    useEffect(() => {
        if (session?.user?.name) {
            setName(session.user.name)
        }
    }, [session?.user?.name])

    // Pull lightweight account stats from existing endpoints
    useEffect(() => {
        if (!session?.user) return
        fetch(`${API_URL}/applications/stats`, { credentials: 'include' })
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (!data?.data) return
                setAccountStats(prev => ({
                    ...prev,
                    totalApps: data.data.total ?? 0,
                    offers: data.data.statusCounts?.Offer || 0,
                }))
            })
            .catch(() => { /* non-critical */ })

        fetch(`${API_URL}/users/me`, { credentials: 'include' })
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data?.data?.createdAt) {
                    setAccountStats(prev => ({ ...prev, memberSince: data.data.createdAt }))
                }
            })
            .catch(() => { /* non-critical */ })
    }, [session?.user])

    const handleUpdateProfile = async () => {
        if (!name.trim()) return
        setIsUpdating(true)
        setUpdateSuccess(false)
        try {
            await authClient.updateUser({ name: name.trim() })
            setUpdateSuccess(true)
            setTimeout(() => setUpdateSuccess(false), 3000)
        } catch (error) {
            console.error('Failed to update profile:', error)
        } finally {
            setIsUpdating(false)
        }
    }

    const handleDeleteAccount = async () => {
        setIsDeleting(true)
        try {
            await authClient.deleteUser()
            await signOut()
            navigate('/login')
        } catch (error) {
            console.error('Failed to delete account:', error)
            setIsDeleting(false)
        }
    }

    if (isPending) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    const identityKey = session?.user?.name || session?.user?.email || 'user'
    const memberSinceLabel = accountStats.memberSince
        ? new Date(accountStats.memberSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        : '—'
    const username = (session?.user as { username?: string } | undefined)?.username

    return (
        <div className="p-4 md:p-6 max-w-[1100px] mx-auto w-full space-y-10">
            {/* ---------- Hero header ---------- */}
            <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    // profile
                </p>
                <div className="flex items-end justify-between flex-wrap gap-6 mt-3">
                    <div className="flex items-center gap-5">
                        <div className="relative">
                            <GenerativeAvatar name={identityKey} size={80} className="shadow-md" />
                            <span className="absolute -bottom-1 -right-1 inline-block w-3 h-3 bg-emerald-500 rounded-full border-2 border-background" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">
                                {session?.user?.name || 'You'}
                            </h1>
                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                                <span className="font-mono text-sm text-muted-foreground inline-flex items-center gap-1">
                                    <AtSign className="h-3.5 w-3.5" />
                                    {username || session?.user?.email?.split('@')[0] || 'user'}
                                </span>
                                <span className="text-muted-foreground/40">·</span>
                                <span className="text-sm text-muted-foreground">{session?.user?.email}</span>
                            </div>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => { await signOut(); navigate('/login'); }}
                        className="gap-2"
                    >
                        <LogOut className="h-4 w-4" />
                        Sign out
                    </Button>
                </div>
            </div>

            {/* ---------- Account stat strip ---------- */}
            <div className="grid grid-cols-3 border-y divide-x divide-border">
                <div className="px-4 py-4">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">applications</p>
                    <p className="font-mono text-2xl font-bold tabular-nums mt-0.5">{accountStats.totalApps}</p>
                </div>
                <div className="px-4 py-4">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">offers</p>
                    <p className={`font-mono text-2xl font-bold tabular-nums mt-0.5 ${accountStats.offers > 0 ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                        {accountStats.offers}
                    </p>
                </div>
                <div className="px-4 py-4">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">member since</p>
                    <p className="font-mono text-2xl font-bold tabular-nums mt-0.5">{memberSinceLabel}</p>
                </div>
            </div>

            {/* ---------- Account section ---------- */}
            <section>
                <SectionLabel label="account" />
                <h2 className="text-xl font-bold tracking-tight mt-1">Identity</h2>
                <p className="text-sm text-muted-foreground mt-0.5">How you show up in AppTrack.</p>

                <div className="mt-5 rounded-xl border bg-card p-5 md:p-6">
                    <div className="grid gap-5 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <label htmlFor="profile-name" className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                                Display name
                            </label>
                            <Input
                                id="profile-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Your name"
                                className="h-10"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="profile-email" className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                                Email
                            </label>
                            <Input
                                id="profile-email"
                                value={session?.user?.email || ''}
                                disabled
                                className="h-10 font-mono text-sm bg-muted/40"
                            />
                            <p className="font-mono text-[10px] text-muted-foreground/70">read-only</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 mt-5">
                        <Button onClick={handleUpdateProfile} disabled={isUpdating || !name.trim()}>
                            {isUpdating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                            Save changes
                        </Button>
                        {updateSuccess && (
                            <span className="font-mono text-xs uppercase tracking-wider text-emerald-500 flex items-center gap-1">
                                <Check className="h-3.5 w-3.5" /> saved
                            </span>
                        )}
                    </div>
                </div>
            </section>

            {/* ─────────────────────────────────────────────────────────
                 Appearance — Apple-style: hairline borders, sentence case,
                 generous spacing, no decorative mono chrome.
                ───────────────────────────────────────────────────────── */}
            <section>
                <div className="flex items-end justify-between flex-wrap gap-4">
                    <div>
                        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Appearance</h2>
                        <p className="text-base text-muted-foreground mt-2 max-w-xl">
                            Pick a starting point, then fine-tune any detail. Changes apply instantly and travel with you.
                        </p>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={reset}
                        className="gap-1.5 text-muted-foreground hover:text-foreground"
                    >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Reset to default
                    </Button>
                </div>

                {/* ── Presets — each card renders a real preview of its style ─ */}
                <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    {presetCards.map((p) => {
                        const isSelected = appearance.preset === p.value
                        return (
                            <button
                                key={p.value}
                                onClick={() => applyPreset(p.value)}
                                className={cn(
                                    'group relative overflow-hidden rounded-2xl text-left transition-all duration-200',
                                    'border border-border/60 bg-card hover:border-foreground/30',
                                    isSelected
                                        ? 'ring-2 ring-foreground/90 ring-offset-2 ring-offset-background border-transparent shadow-md'
                                        : 'hover:shadow-sm'
                                )}
                            >
                                {/* Visual preview area — shows what the preset actually looks like */}
                                <div className="h-28 relative border-b border-border/60">
                                    <PresetVisual variant={p.value} />
                                </div>
                                <div className="p-4">
                                    <p className="text-base font-semibold tracking-tight">{p.label}</p>
                                    <p className="text-xs text-muted-foreground mt-1 leading-snug">
                                        {p.tagline}
                                    </p>
                                </div>
                                {isSelected && (
                                    <span className="absolute top-3 right-3 h-5 w-5 rounded-full bg-foreground text-background flex items-center justify-center shadow-sm">
                                        <Check className="h-3 w-3" strokeWidth={3} />
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </div>

                {/* ── Live preview — generous, clean, no chrome ─ */}
                <div className="mt-10">
                    <p className="text-xs text-muted-foreground/70 mb-3 ml-1">Preview</p>
                    <div className="rounded-2xl border border-border/60 bg-card p-6 md:p-8">
                        <div className="flex items-center gap-4 mb-5">
                            <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center shrink-0">
                                <Sparkles className="h-5 w-5 text-primary-foreground" />
                            </div>
                            <div className="min-w-0">
                                <p className="font-semibold tracking-tight">Acme Robotics</p>
                                <p className="text-sm text-muted-foreground truncate">Senior Software Engineer</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-5">
                            <Badge
                                variant="outline"
                                style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
                            >
                                Interview
                            </Badge>
                            <Badge variant="secondary">Full-time</Badge>
                            <Badge variant="outline">Remote · SF</Badge>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <Button size="sm">Primary action</Button>
                            <Button size="sm" variant="outline">Secondary</Button>
                            <Button size="sm" variant="ghost">Ghost</Button>
                        </div>
                    </div>
                </div>

                {/* ── Manual knobs — clean rows, no mono prefixes ─ */}
                <div className="mt-10 rounded-2xl border border-border/60 bg-card px-6 md:px-8">
                    <KnobRow label="Mode" hint="Match the system or force one of the two.">
                        <div className="grid grid-cols-3 gap-2 max-w-md">
                            {modeOptions.map((option) => {
                                const Icon = option.icon
                                const isSelected = theme === option.value
                                return (
                                    <PickButton
                                        key={option.value}
                                        selected={isSelected}
                                        onClick={() => setTheme(option.value)}
                                        wide
                                    >
                                        <Icon className={cn('h-4 w-4 mb-1.5', isSelected ? 'text-foreground' : 'text-muted-foreground')} />
                                        <span>{option.label}</span>
                                    </PickButton>
                                )
                            })}
                        </div>
                    </KnobRow>

                    <KnobRow label="Density" hint="Compact fits more on screen; cozy gives everything room to breathe.">
                        <div className="grid grid-cols-3 gap-2 max-w-md">
                            {densityOptions.map((opt) => (
                                <PickButton
                                    key={opt.value}
                                    selected={appearance.density === opt.value}
                                    onClick={() => update({ density: opt.value })}
                                    wide
                                >
                                    {opt.label}
                                </PickButton>
                            ))}
                        </div>
                    </KnobRow>

                    <KnobRow label="Font" hint="Sets the typeface across every label, button, and heading.">
                        <div className="grid grid-cols-3 gap-2 max-w-md">
                            {fontOptions.map((opt) => (
                                <PickButton
                                    key={opt.value}
                                    selected={appearance.font === opt.value}
                                    onClick={() => update({ font: opt.value })}
                                    wide
                                >
                                    <span
                                        className="text-xl leading-none mb-1.5"
                                        style={{
                                            fontFamily:
                                                opt.value === 'mono'
                                                    ? 'JetBrains Mono, Fira Code, monospace'
                                                    : opt.value === 'serif'
                                                    ? 'Merriweather, Georgia, serif'
                                                    : 'Outfit, system-ui, sans-serif',
                                        }}
                                    >
                                        {opt.sample}
                                    </span>
                                    <span>{opt.label}</span>
                                </PickButton>
                            ))}
                        </div>
                    </KnobRow>

                    <KnobRow label="Corner radius" hint="From razor-sharp to fully pilled.">
                        <div className="grid grid-cols-4 gap-2 max-w-md">
                            {radiusOptions.map((opt) => {
                                const isSelected = appearance.radius === opt.value
                                return (
                                    <PickButton
                                        key={opt.value}
                                        selected={isSelected}
                                        onClick={() => update({ radius: opt.value })}
                                        wide
                                    >
                                        <span
                                            className="block w-7 h-7 mb-1.5 border transition-colors"
                                            style={{
                                                borderRadius: opt.px,
                                                borderColor: isSelected ? 'var(--foreground)' : 'var(--border)',
                                                borderWidth: isSelected ? '1.5px' : '1px',
                                            }}
                                        />
                                        <span>{opt.label}</span>
                                    </PickButton>
                                )
                            })}
                        </div>
                    </KnobRow>

                    <KnobRow label="Accent color" hint="Used by buttons, focus rings, sidebar selection, and status chips.">
                        <div className="flex flex-wrap gap-3">
                            {accentSwatches.map((s) => {
                                const isSelected = appearance.accent === s.value
                                return (
                                    <button
                                        key={s.value}
                                        onClick={() => update({ accent: s.value })}
                                        className="group flex flex-col items-center gap-2"
                                        aria-label={s.label}
                                    >
                                        <span
                                            className={cn(
                                                'block h-9 w-9 rounded-full transition-all',
                                                isSelected
                                                    ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground/80'
                                                    : 'ring-1 ring-border/60 group-hover:ring-foreground/30'
                                            )}
                                            style={{ backgroundColor: s.color }}
                                        />
                                        <span className={cn(
                                            'text-[11px] transition-colors',
                                            isSelected ? 'text-foreground font-medium' : 'text-muted-foreground'
                                        )}>
                                            {s.label}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    </KnobRow>

                    <KnobRow label="Background" hint="A subtle texture behind the main scroll area. None is purest.">
                        <div className="grid grid-cols-5 gap-2 max-w-md">
                            {bgOptions.map((opt) => (
                                <PickButton
                                    key={opt.value}
                                    selected={appearance.background === opt.value}
                                    onClick={() => update({ background: opt.value })}
                                    wide
                                >
                                    <BgPreview kind={opt.value} />
                                    <span>{opt.label}</span>
                                </PickButton>
                            ))}
                        </div>
                    </KnobRow>

                    <KnobRow label="Motion" hint="Reduce if animations distract you, or if you prefer instant transitions.">
                        <div className="grid grid-cols-2 gap-2 max-w-md">
                            <PickButton
                                selected={appearance.motion === 'full'}
                                onClick={() => update({ motion: 'full' })}
                                wide
                            >
                                Full
                            </PickButton>
                            <PickButton
                                selected={appearance.motion === 'reduced'}
                                onClick={() => update({ motion: 'reduced' })}
                                wide
                            >
                                Reduced
                            </PickButton>
                        </div>
                    </KnobRow>
                </div>
            </section>

            {/* ---------- Danger zone ---------- */}
            <section>
                <SectionLabel label="danger" />
                <h2 className="text-xl font-bold tracking-tight mt-1 text-destructive">Burn it down</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Irreversible. There's no recycle bin.</p>

                <div className="mt-5 rounded-xl border border-destructive/40 bg-destructive/5 p-5 md:p-6">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <div>
                            <p className="font-semibold">Delete account</p>
                            <p className="text-sm text-muted-foreground mt-0.5">
                                Wipes your profile and every application you've tracked.
                            </p>
                        </div>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" className="gap-2">
                                    <Trash2 className="h-4 w-4" />
                                    Delete account
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This action cannot be undone. This will permanently delete your account
                                        and remove all your data including all job applications.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={handleDeleteAccount}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        disabled={isDeleting}
                                    >
                                        {isDeleting ? (
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        ) : null}
                                        Yes, delete my account
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>
            </section>
        </div>
    )
}

export default Profile
