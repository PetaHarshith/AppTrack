import * as cheerio from "cheerio";

export type ImportResult = {
    ok: true;
    data: {
        company?: string;
        position?: string;
        location?: string;
        salary?: string;
        workType?: "Internship" | "FullTime" | "Coop" | "Contract";
        jobUrl: string;
        source: string;
    };
} | {
    ok: false;
    reason: "site_requires_login" | "fetch_failed" | "parse_failed" | "invalid_url" | "timeout";
    message?: string;
};

const FETCH_TIMEOUT_MS = 8000;
const USER_AGENT =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

type WorkTypeStr = "Internship" | "FullTime" | "Coop" | "Contract";

const detectWorkType = (text: string): WorkTypeStr | undefined => {
    const t = text.toLowerCase();
    if (/\bintern(ship)?\b/.test(t)) return "Internship";
    if (/\bco-?op\b/.test(t)) return "Coop";
    if (/\bcontract(or)?\b|\bcontract-to-hire\b/.test(t)) return "Contract";
    if (/\bfull[- ]?time\b/.test(t)) return "FullTime";
    return undefined;
};

const fetchHtml = async (url: string): Promise<{ html: string; finalUrl: string } | null> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            signal: controller.signal,
            redirect: "follow",
            headers: {
                "User-Agent": USER_AGENT,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
            },
        });

        if (!response.ok) return null;

        const html = await response.text();
        return { html, finalUrl: response.url };
    } catch {
        return null;
    } finally {
        clearTimeout(timeoutId);
    }
};

const parseJsonLdJobPosting = ($: cheerio.CheerioAPI): Record<string, any> => {
    const out: Record<string, any> = {};
    $('script[type="application/ld+json"]').each((_, el) => {
        try {
            const raw = $(el).contents().text();
            if (!raw) return;
            const data = JSON.parse(raw);
            const items = Array.isArray(data) ? data : [data];
            for (const item of items) {
                const flat = item["@graph"] ? item["@graph"] : [item];
                for (const entry of flat) {
                    if (entry && (entry["@type"] === "JobPosting" || (Array.isArray(entry["@type"]) && entry["@type"].includes("JobPosting")))) {
                        if (!out.position && entry.title) out.position = String(entry.title).trim();
                        if (!out.company && entry.hiringOrganization?.name) {
                            out.company = String(entry.hiringOrganization.name).trim();
                        }
                        if (!out.location && entry.jobLocation) {
                            const loc = Array.isArray(entry.jobLocation) ? entry.jobLocation[0] : entry.jobLocation;
                            const addr = loc?.address;
                            if (addr) {
                                const parts = [addr.addressLocality, addr.addressRegion, addr.addressCountry].filter(Boolean);
                                if (parts.length) out.location = parts.join(", ");
                            }
                        }
                        if (!out.salary && entry.baseSalary?.value) {
                            const v = entry.baseSalary.value;
                            if (v.minValue && v.maxValue) {
                                out.salary = `${v.minValue}-${v.maxValue} ${entry.baseSalary.currency || ""}`.trim();
                            } else if (v.value) {
                                out.salary = `${v.value} ${entry.baseSalary.currency || ""}`.trim();
                            }
                        }
                        if (!out.workType && entry.employmentType) {
                            const et = Array.isArray(entry.employmentType) ? entry.employmentType.join(" ") : String(entry.employmentType);
                            out.workType = detectWorkType(et);
                        }
                    }
                }
            }
        } catch {
            // ignore JSON parse errors
        }
    });
    return out;
};

const slugToTitleCase = (slug: string): string => {
    return slug
        .split(/[-_]/)
        .filter(Boolean)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(" ");
};

const extractCompanyFromGreenhouseUrl = (url: string): string | undefined => {
    try {
        const u = new URL(url);
        // Patterns:
        //   boards.greenhouse.io/<slug>/jobs/<id>
        //   job-boards.greenhouse.io/<slug>/jobs/<id>
        //   <company>.greenhouse.io/...
        const host = u.hostname.toLowerCase();
        const parts = u.pathname.split("/").filter(Boolean);
        if ((host === "boards.greenhouse.io" || host === "job-boards.greenhouse.io") && parts.length > 0) {
            return slugToTitleCase(parts[0]!);
        }
        // <subdomain>.greenhouse.io style
        const sub = host.split(".")[0];
        if (sub && host.endsWith(".greenhouse.io") && !["boards", "job-boards", "www"].includes(sub)) {
            return slugToTitleCase(sub);
        }
    } catch { /* ignore */ }
    return undefined;
};

const parseGreenhouse = ($: cheerio.CheerioAPI, url: string): Record<string, any> => {
    const out: Record<string, any> = {};

    // Position: try the canonical Greenhouse selectors, then fall back to h1.
    const titleCandidates = [
        $(".app-title").first().text().trim(),
        $("h1.section-header").first().text().trim(),
        $("h1#header").first().text().trim(),
        $('[data-mapped="app-title"]').first().text().trim(),
        $("h1").first().text().trim(),
    ].filter(Boolean);
    if (titleCandidates[0]) out.position = titleCandidates[0];

    // Company: try common selectors, then meta tags, then the URL slug.
    let company = $(".company-name").first().text().replace(/^at\s+/i, "").trim();
    if (!company) {
        company = $('meta[property="og:site_name"]').attr("content")?.trim() || "";
        // og:site_name is often just "Greenhouse" — reject that.
        if (/^greenhouse$/i.test(company)) company = "";
    }
    if (!company) {
        // Parse from <title>: typical formats are
        //   "Career Site - Company"
        //   "Position - Company"
        //   "Job Application for Position at Company"
        const titleTag = $("title").first().text().trim();
        const atMatch = titleTag.match(/\s+at\s+([^|\-–—]+?)\s*$/i);
        if (atMatch && atMatch[1]) company = atMatch[1].trim();
        if (!company) {
            const dashMatch = titleTag.match(/^(?:.+?)\s*[-–—|]\s*(.+)$/);
            if (dashMatch && dashMatch[1] && !/greenhouse/i.test(dashMatch[1])) company = dashMatch[1].trim();
        }
    }
    if (!company) {
        // Last resort: derive from the URL slug.
        company = extractCompanyFromGreenhouseUrl(url) || "";
    }
    if (company) out.company = company;

    const location = $(".location").first().text().trim() || $('[class*="location" i]').first().text().trim();
    if (location) out.location = location;

    return out;
};

const parseLever = ($: cheerio.CheerioAPI, url: string): Record<string, any> => {
    const out: Record<string, any> = {};
    const title = $(".posting-headline h2").first().text().trim() || $("h2").first().text().trim();
    if (title) out.position = title;
    const location = $(".posting-categories .location").first().text().trim() || $(".sort-by-time .posting-category-link").first().text().trim();
    if (location) out.location = location;
    const commitment = $(".posting-categories .commitment").first().text().trim();
    if (commitment) out.workType = detectWorkType(commitment);

    // Lever URL: jobs.lever.co/<company-slug>/<id>
    try {
        const u = new URL(url);
        if (u.hostname === "jobs.lever.co") {
            const parts = u.pathname.split("/").filter(Boolean);
            if (parts.length > 0) out.company = slugToTitleCase(parts[0]!);
        }
    } catch { /* ignore */ }
    return out;
};

const parseAshby = ($: cheerio.CheerioAPI, url: string): Record<string, any> => {
    const out: Record<string, any> = {};
    const title = $('h1').first().text().trim();
    if (title) out.position = title;

    // Ashby URL: jobs.ashbyhq.com/<company-slug>/...
    try {
        const u = new URL(url);
        if (u.hostname === "jobs.ashbyhq.com") {
            const parts = u.pathname.split("/").filter(Boolean);
            if (parts.length > 0) out.company = slugToTitleCase(parts[0]!);
        }
    } catch { /* ignore */ }
    return out;
};

const parseOpenGraph = ($: cheerio.CheerioAPI): Record<string, any> => {
    const out: Record<string, any> = {};
    const ogTitle = $('meta[property="og:title"]').attr("content");
    const ogSite = $('meta[property="og:site_name"]').attr("content");
    const ogDesc = $('meta[property="og:description"]').attr("content");
    const twitterTitle = $('meta[name="twitter:title"]').attr("content");
    const titleTag = $("title").first().text().trim();

    const titleText = (ogTitle || twitterTitle || titleTag || "").trim();
    if (titleText) {
        // Heuristic: "Position at Company" or "Position - Company" or "Position | Company"
        const splitMatch = titleText.match(/^(.+?)\s+(?:at|@|-|–|—|\|)\s+(.+)$/i);
        if (splitMatch && splitMatch[1] && splitMatch[2]) {
            out.position = splitMatch[1].trim();
            out.company = splitMatch[2].trim();
        } else {
            out.position = titleText;
        }
    }
    if (!out.company && ogSite) {
        out.company = ogSite.trim();
    }
    if (ogDesc) {
        const wt = detectWorkType(ogDesc);
        if (wt) out.workType = wt;
    }
    return out;
};

const detectLoginWall = (html: string): boolean => {
    const lc = html.toLowerCase();
    // LinkedIn, Indeed, Glassdoor common login indicators
    return (
        lc.includes("sign in to linkedin") ||
        lc.includes("authwall") ||
        lc.includes("please sign in") && lc.includes("linkedin") ||
        lc.includes("captcha") && lc.length < 50000
    );
};

const pickHostStrategy = (url: string): "greenhouse" | "lever" | "ashby" | "workday" | "blocked" | "generic" => {
    let host = "";
    try {
        host = new URL(url).hostname.toLowerCase();
    } catch {
        return "generic";
    }
    if (host.includes("linkedin.com") || host.includes("indeed.com") || host.includes("glassdoor.com")) return "blocked";
    if (host.endsWith("greenhouse.io")) return "greenhouse";
    if (host.endsWith("lever.co")) return "lever";
    if (host.endsWith("ashbyhq.com")) return "ashby";
    if (host.includes("myworkdayjobs.com") || host.includes("workday.com")) return "workday";
    return "generic";
};

export const importJobFromUrl = async (url: string): Promise<ImportResult> => {
    let parsedUrl: URL;
    try {
        parsedUrl = new URL(url);
    } catch {
        return { ok: false, reason: "invalid_url" };
    }
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return { ok: false, reason: "invalid_url" };
    }

    const strategy = pickHostStrategy(url);
    if (strategy === "blocked") {
        return { ok: false, reason: "site_requires_login" };
    }

    const fetched = await fetchHtml(url);
    if (!fetched) {
        return { ok: false, reason: "fetch_failed", message: "Could not fetch the URL. The site may be blocking automated requests." };
    }

    if (detectLoginWall(fetched.html)) {
        return { ok: false, reason: "site_requires_login" };
    }

    const $ = cheerio.load(fetched.html);

    let parsed: Record<string, any> = {};
    if (strategy === "greenhouse") parsed = parseGreenhouse($, fetched.finalUrl);
    else if (strategy === "lever") parsed = parseLever($, fetched.finalUrl);
    else if (strategy === "ashby") parsed = parseAshby($, fetched.finalUrl);

    // Always layer JSON-LD then OpenGraph as fallbacks
    const jsonLd = parseJsonLdJobPosting($);
    const og = parseOpenGraph($);
    parsed = { ...og, ...jsonLd, ...parsed }; // host-specific wins, then jsonLd, then OG

    if (!parsed.company && !parsed.position) {
        return { ok: false, reason: "parse_failed", message: "Could not extract job details from this page." };
    }

    return {
        ok: true,
        data: {
            company: parsed.company,
            position: parsed.position,
            location: parsed.location,
            salary: parsed.salary,
            workType: parsed.workType,
            jobUrl: fetched.finalUrl,
            source: strategy,
        },
    };
};
