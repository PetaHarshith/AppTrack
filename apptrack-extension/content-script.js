/**
 * AppTrack content script.
 * Injected on demand by popup.js via chrome.scripting.executeScript.
 * Reads the page in the user's authenticated browser context and returns
 * { company, position, location, salary, workType, jobUrl, source } — or null
 * if the page doesn't look like a job posting.
 */

(() => {
    const titleCase = (s) =>
        String(s || '')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/\b\w/g, (c) => c.toUpperCase());

    const text = (sel) => {
        const el = document.querySelector(sel);
        return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
    };

    const attr = (sel, name) => {
        const el = document.querySelector(sel);
        return el ? el.getAttribute(name) || '' : '';
    };

    // ---- JSON-LD JobPosting (works on many sites) ----
    const parseJsonLd = () => {
        const out = {};
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        for (const s of scripts) {
            try {
                const raw = s.textContent;
                if (!raw) continue;
                const data = JSON.parse(raw);
                const items = Array.isArray(data) ? data : [data];
                for (const item of items) {
                    const flat = item['@graph'] ? item['@graph'] : [item];
                    for (const entry of flat) {
                        const t = entry?.['@type'];
                        const isJob = t === 'JobPosting' || (Array.isArray(t) && t.includes('JobPosting'));
                        if (!isJob) continue;
                        if (entry.title && !out.position) out.position = String(entry.title).trim();
                        if (entry.hiringOrganization?.name && !out.company) {
                            out.company = String(entry.hiringOrganization.name).trim();
                        }
                        if (entry.jobLocation && !out.location) {
                            const loc = Array.isArray(entry.jobLocation) ? entry.jobLocation[0] : entry.jobLocation;
                            const addr = loc?.address;
                            if (addr) {
                                const parts = [addr.addressLocality, addr.addressRegion, addr.addressCountry].filter(Boolean);
                                if (parts.length) out.location = parts.join(', ');
                            }
                        }
                        if (entry.baseSalary?.value && !out.salary) {
                            const v = entry.baseSalary.value;
                            if (v.minValue && v.maxValue) out.salary = `${v.minValue}-${v.maxValue} ${entry.baseSalary.currency || ''}`.trim();
                            else if (v.value) out.salary = `${v.value} ${entry.baseSalary.currency || ''}`.trim();
                        }
                        if (entry.employmentType && !out.workType) {
                            const et = String(Array.isArray(entry.employmentType) ? entry.employmentType.join(' ') : entry.employmentType).toLowerCase();
                            if (/intern/.test(et)) out.workType = 'Internship';
                            else if (/co-?op/.test(et)) out.workType = 'Coop';
                            else if (/contract/.test(et)) out.workType = 'Contract';
                            else if (/full[- ]?time/.test(et)) out.workType = 'FullTime';
                        }
                    }
                }
            } catch { /* skip invalid JSON */ }
        }
        return out;
    };

    // ---- Site-specific parsers ----
    const SITE_PARSERS = [
        {
            name: 'LinkedIn',
            match: (host) => /(^|\.)linkedin\.com$/.test(host),
            parse: () => {
                // LinkedIn has 2-3 layouts: the public /jobs/view/* page, the logged-in feed view,
                // and the in-feed sliding panel. Selectors cover all of them.
                const position =
                    text('h1.top-card-layout__title') ||
                    text('.jobs-unified-top-card__job-title') ||
                    text('.job-details-jobs-unified-top-card__job-title') ||
                    text('h1.t-24');
                const company =
                    text('.topcard__org-name-link') ||
                    text('.jobs-unified-top-card__company-name a') ||
                    text('.jobs-unified-top-card__company-name') ||
                    text('.job-details-jobs-unified-top-card__company-name a') ||
                    text('.job-details-jobs-unified-top-card__company-name');
                const location =
                    text('.topcard__flavor--bullet') ||
                    text('.jobs-unified-top-card__bullet') ||
                    text('.job-details-jobs-unified-top-card__primary-description-container .tvm__text');
                return { company, position, location };
            },
        },
        {
            name: 'Greenhouse',
            match: (host) => /greenhouse\.io$/.test(host) || /\bgreenhouse\.io\b/.test(host),
            parse: () => {
                const position =
                    text('.app-title') ||
                    text('h1.section-header') ||
                    text('h1#header') ||
                    text('h1');
                let company =
                    text('.company-name')?.replace(/^at\s+/i, '') ||
                    attr('meta[property="og:site_name"]', 'content');
                if (!company || /greenhouse/i.test(company)) {
                    // Fall back to the URL slug: boards.greenhouse.io/<slug>/jobs/<id>
                    const parts = location.pathname.split('/').filter(Boolean);
                    if (parts.length) company = titleCase(parts[0].replace(/[-_]/g, ' '));
                }
                const loc = text('.location');
                return { company, position, location: loc };
            },
        },
        {
            name: 'Lever',
            match: (host) => /lever\.co$/.test(host),
            parse: () => {
                const position = text('.posting-headline h2') || text('h2');
                const parts = location.pathname.split('/').filter(Boolean);
                const company = parts.length ? titleCase(parts[0].replace(/[-_]/g, ' ')) : '';
                const loc =
                    text('.posting-categories .location') ||
                    text('.sort-by-time .posting-category-link');
                const commit = text('.posting-categories .commitment').toLowerCase();
                let workType;
                if (/intern/.test(commit)) workType = 'Internship';
                else if (/co-?op/.test(commit)) workType = 'Coop';
                else if (/contract/.test(commit)) workType = 'Contract';
                else if (/full[- ]?time/.test(commit)) workType = 'FullTime';
                return { company, position, location: loc, workType };
            },
        },
        {
            name: 'Ashby',
            match: (host) => /ashbyhq\.com$/.test(host),
            parse: () => {
                const position = text('h1');
                const parts = location.pathname.split('/').filter(Boolean);
                const company = parts.length ? titleCase(parts[0].replace(/[-_]/g, ' ')) : '';
                return { company, position };
            },
        },
        {
            name: 'Workday',
            match: (host) => /myworkdayjobs\.com$/.test(host) || /workday\.com$/.test(host),
            parse: () => {
                const position =
                    text('[data-automation-id="jobPostingHeader"]') ||
                    text('h2[data-automation-id]') ||
                    text('h1');
                const location =
                    text('[data-automation-id="locations"]') ||
                    text('[data-automation-id="locationsId"]');
                // Workday subdomain often is the company: e.g. stripe.wd1.myworkdayjobs.com
                let company = '';
                const host = window.location.hostname.split('.');
                if (host.length >= 3 && host[0] && !['www'].includes(host[0])) {
                    company = titleCase(host[0].replace(/[-_]/g, ' '));
                }
                return { company, position, location };
            },
        },
    ];

    // ---- OpenGraph fallback ----
    const parseOg = () => {
        const out = {};
        const ogTitle = attr('meta[property="og:title"]', 'content');
        const ogSite = attr('meta[property="og:site_name"]', 'content');

        const title = (ogTitle || document.title || '').trim();
        if (title) {
            const m = title.match(/^(.+?)\s+(?:at|@|-|–|—|\|)\s+(.+)$/i);
            if (m) {
                out.position = m[1].trim();
                out.company = m[2].trim();
            } else {
                out.position = title;
            }
        }
        if (!out.company && ogSite) out.company = ogSite.trim();
        return out;
    };

    // ---- Detect if this even looks like a job page ----
    const looksLikeJobPage = (data) => {
        if (!data || !data.position) return false;
        // Skip homepages, listing pages — they tend to lack a specific role title or have generic titles
        const pos = data.position.toLowerCase();
        const blacklist = ['home', 'careers', 'jobs', 'open positions', 'all jobs', 'login', 'sign in'];
        if (blacklist.some((b) => pos === b)) return false;
        return true;
    };

    // ---- Run parsers (host-specific → JSON-LD → OpenGraph) ----
    const host = window.location.hostname.toLowerCase();
    const fromSite = SITE_PARSERS.find((p) => p.match(host))?.parse() || {};
    const fromJsonLd = parseJsonLd();
    const fromOg = parseOg();
    const sourceName = SITE_PARSERS.find((p) => p.match(host))?.name
        || (Object.keys(fromJsonLd).length > 0 ? 'JSON-LD' : 'page');

    // Merge: site-specific wins, then JSON-LD, then OpenGraph
    const merged = {
        ...fromOg,
        ...fromJsonLd,
        ...fromSite,
    };

    // Clean up
    const result = {
        company: merged.company ? String(merged.company).slice(0, 120).trim() : '',
        position: merged.position ? String(merged.position).slice(0, 150).trim() : '',
        location: merged.location ? String(merged.location).slice(0, 120).trim() : '',
        salary: merged.salary ? String(merged.salary).slice(0, 120).trim() : '',
        workType: merged.workType || '',
        jobUrl: window.location.href,
        source: sourceName,
        looksLikeJob: looksLikeJobPage(merged),
    };

    return result;
})();
