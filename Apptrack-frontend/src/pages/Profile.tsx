import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { Trash2, Check, Loader2, Sun, Moon, Monitor, LogOut, AtSign } from 'lucide-react'
import { useTheme } from '@/components/refine-ui/theme/theme-provider'
import { cn } from '@/lib/utils'
import { API_URL } from '@/constants'
import { GenerativeAvatar } from '@/components/dataviz/GenerativeAvatar'

const colorThemes = [
    { name: 'Default', primary: 'oklch(0.6420 0.1691 38.5815)', accent: 'oklch(0.4138 0.0846 259.8759)', class: 'theme-default' },
    { name: 'Rose', primary: 'oklch(0.6455 0.2123 12.5913)', accent: 'oklch(0.5693 0.1458 4.6328)', class: 'theme-rose' },
    { name: 'Blue', primary: 'oklch(0.6232 0.1665 253.1006)', accent: 'oklch(0.5445 0.1925 262.8812)', class: 'theme-blue' },
    { name: 'Green', primary: 'oklch(0.6237 0.1697 145.4743)', accent: 'oklch(0.5188 0.1334 154.0291)', class: 'theme-green' },
    { name: 'Violet', primary: 'oklch(0.6058 0.2315 292.7551)', accent: 'oklch(0.5309 0.2231 296.8247)', class: 'theme-violet' },
    { name: 'Orange', primary: 'oklch(0.7050 0.1912 47.6042)', accent: 'oklch(0.6469 0.1998 38.4042)', class: 'theme-orange' },
]

const modeOptions = [
    { value: 'light' as const, label: 'Light', icon: Sun },
    { value: 'dark' as const, label: 'Dark', icon: Moon },
    { value: 'system' as const, label: 'System', icon: Monitor },
]

const SectionLabel = ({ label }: { label: string }) => (
    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        // {label}
    </p>
)

const Profile = () => {
    const { data: session, isPending } = useSession()
    const navigate = useNavigate()
    const { theme, setTheme } = useTheme()

    const [name, setName] = useState(session?.user?.name || '')
    const [isUpdating, setIsUpdating] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [updateSuccess, setUpdateSuccess] = useState(false)
    const [selectedColorTheme, setSelectedColorTheme] = useState('theme-default')

    const [accountStats, setAccountStats] = useState<{ totalApps: number; offers: number; memberSince: string | null }>({
        totalApps: 0, offers: 0, memberSince: null,
    })

    useEffect(() => {
        const savedTheme = localStorage.getItem('color-theme') || 'theme-default'
        setSelectedColorTheme(savedTheme)
        if (savedTheme !== 'theme-default') {
            document.documentElement.classList.add(savedTheme)
        }
    }, [])

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

    const applyColorTheme = (themeClass: string) => {
        setSelectedColorTheme(themeClass)
        document.documentElement.classList.remove(...colorThemes.map(t => t.class))
        if (themeClass !== 'theme-default') {
            document.documentElement.classList.add(themeClass)
        }
        localStorage.setItem('color-theme', themeClass)
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

            {/* ---------- Appearance section ---------- */}
            <section>
                <SectionLabel label="appearance" />
                <h2 className="text-xl font-bold tracking-tight mt-1">Look & feel</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Make AppTrack feel like yours.</p>

                <div className="mt-5 rounded-xl border bg-card p-5 md:p-6 space-y-7">
                    {/* Mode */}
                    <div>
                        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                            Mode
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                            {modeOptions.map((option) => {
                                const Icon = option.icon
                                const isSelected = theme === option.value
                                return (
                                    <button
                                        key={option.value}
                                        onClick={() => setTheme(option.value)}
                                        className={cn(
                                            'flex flex-col items-center justify-center gap-2 py-4 rounded-lg border-2 transition-all',
                                            isSelected
                                                ? 'border-primary bg-primary/5'
                                                : 'border-border hover:border-primary/40 hover:bg-muted/40'
                                        )}
                                    >
                                        <Icon className={cn('h-5 w-5', isSelected ? 'text-primary' : 'text-muted-foreground')} />
                                        <span className={cn('font-mono text-xs uppercase tracking-wider', isSelected ? 'text-foreground font-semibold' : 'text-muted-foreground')}>
                                            {option.label}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Color theme */}
                    <div>
                        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                            Accent color
                        </p>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                            {colorThemes.map((colorTheme) => {
                                const isSelected = selectedColorTheme === colorTheme.class
                                return (
                                    <button
                                        key={colorTheme.class}
                                        onClick={() => applyColorTheme(colorTheme.class)}
                                        className={cn(
                                            'relative flex flex-col items-center gap-2 py-3 rounded-lg border-2 transition-all',
                                            isSelected
                                                ? 'border-primary'
                                                : 'border-border hover:border-primary/40'
                                        )}
                                    >
                                        <div className="flex">
                                            <div
                                                className="w-7 h-7 rounded-full ring-2 ring-background"
                                                style={{ backgroundColor: colorTheme.primary }}
                                            />
                                            <div
                                                className="w-7 h-7 rounded-full -ml-2.5 ring-2 ring-background"
                                                style={{ backgroundColor: colorTheme.accent }}
                                            />
                                        </div>
                                        <span className={cn('font-mono text-[10px] uppercase tracking-wider', isSelected ? 'text-foreground font-semibold' : 'text-muted-foreground')}>
                                            {colorTheme.name}
                                        </span>
                                        {isSelected && (
                                            <div className="absolute top-1.5 right-1.5 h-4 w-4 bg-primary rounded-full flex items-center justify-center">
                                                <Check className="h-2.5 w-2.5 text-primary-foreground" />
                                            </div>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
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
