import { Link } from "react-router";

const KanbanPreview = () => {
    const columns = [
        {
            label: "Applied",
            color: "var(--chart-1)",
            cards: [
                { c: "Stripe", p: "Software Engineer", days: 2 },
                { c: "Vercel", p: "Frontend Eng", days: 5 },
                { c: "Linear", p: "Eng Intern", days: 9 },
            ],
        },
        {
            label: "Interview",
            color: "var(--chart-2)",
            cards: [
                { c: "Figma", p: "Product Eng", days: 1 },
                { c: "Notion", p: "SWE Intern", days: 3 },
            ],
        },
        {
            label: "Offer",
            color: "#22c55e",
            cards: [{ c: "Shopify", p: "Platform Eng", days: 0 }],
        },
    ];

    return (
        <div className="rounded-xl border border-border/50 bg-card/40 backdrop-blur-sm p-3 shadow-xl">
            <div className="grid grid-cols-3 gap-2">
                {columns.map((col) => (
                    <div key={col.label} className="bg-background/40 rounded-md p-2 min-h-[180px]">
                        <div className="flex items-center justify-between mb-2 pb-1.5 border-b" style={{ borderColor: col.color }}>
                            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: col.color }}>
                                {col.label}
                            </span>
                            <span className="text-[10px] text-muted-foreground bg-background rounded-full px-1.5">
                                {col.cards.length}
                            </span>
                        </div>
                        <div className="space-y-1.5">
                            {col.cards.map((card, i) => (
                                <div key={i} className="bg-card border rounded p-1.5 shadow-sm">
                                    <p className="text-[11px] font-medium truncate">{card.c}</p>
                                    <p className="text-[9px] text-muted-foreground truncate">{card.p}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default function AuthBrandPanel() {
    return (
        <div className="hidden lg:flex flex-col flex-1 p-10 relative overflow-hidden bg-muted/30 border-r">
            {/* Subtle dot grid */}
            <div
                className="absolute inset-0 opacity-[0.15] pointer-events-none"
                style={{
                    backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
                    backgroundSize: "24px 24px",
                }}
            />

            {/* Top: Wordmark */}
            <Link to="/" className="relative inline-flex items-center gap-2 font-mono text-sm font-semibold w-fit">
                <span className="inline-block w-2 h-2 bg-primary" />
                apptrack
                <span className="text-muted-foreground font-normal">/</span>
                <span className="text-muted-foreground font-normal">v1.0</span>
            </Link>

            {/* Middle: tagline + preview */}
            <div className="relative flex-1 flex flex-col justify-center max-w-xl">
                <h2 className="text-5xl font-bold leading-[1.05] tracking-tight">
                    Your job search,
                    <br />
                    <span className="text-primary">finally</span> organized.
                </h2>
                <p className="text-base text-muted-foreground mt-5 max-w-md">
                    A drag-and-drop pipeline, smart job-link imports, and the analytics
                    you actually need to land the offer.
                </p>

                <div className="mt-10">
                    <KanbanPreview />
                </div>
            </div>

            {/* Bottom: stats strip */}
            <div className="relative flex items-center gap-6 text-sm pt-6 border-t border-border/60">
                <div>
                    <p className="font-mono text-2xl font-bold tabular-nums">6</p>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Pipeline stages</p>
                </div>
                <div>
                    <p className="font-mono text-2xl font-bold tabular-nums">3+</p>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">ATS supported</p>
                </div>
                <div>
                    <p className="font-mono text-2xl font-bold tabular-nums">0</p>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Spreadsheets needed</p>
                </div>
            </div>
        </div>
    );
}
