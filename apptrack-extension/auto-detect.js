/**
 * Auto-detection content script. Runs in the page on common job-site domains.
 *
 * Strategy:
 *   1. Decide if this page is a job-application *confirmation* page (URL + text patterns).
 *   2. If yes, try to extract whatever job info is on the page (same parsers as the popup).
 *   3. Inject a small floating widget offering to add the application to AppTrack.
 *   4. On click, message the background service worker to do the authenticated POST.
 *
 * We deliberately avoid auto-saving. The user always sees the prompt and confirms.
 */

(() => {
    // Guard against running twice (e.g. on SPA re-render)
    if (window.__apptrack_injected) return;
    window.__apptrack_injected = true;

    // ---------- helpers ----------
    const text = (sel) => {
        const el = document.querySelector(sel);
        return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
    };
    const attr = (sel, name) => {
        const el = document.querySelector(sel);
        return el ? el.getAttribute(name) || '' : '';
    };
    const titleCase = (s) =>
        String(s || '').replace(/\s+/g, ' ').trim().replace(/\b\w/g, (c) => c.toUpperCase());

    // ---------- detection ----------
    const URL_PATTERNS = [
        /myworkdayjobs\.com\/.*\/(application|applied|confirmation|success|submitted|thanks)/i,
        /workday\.com\/.*\/(application|applied|confirmation|success|submitted|thanks)/i,
        /(boards|job-boards)\.greenhouse\.io\/.*\/(submitted|applications\/new|thanks)/i,
        /jobs\.lever\.co\/.*\/(apply\/thanks|apply\/confirmation)/i,
        /jobs\.ashbyhq\.com\/.*\/application-(confirmation|submitted)/i,
        /smartrecruiters\.com\/.*\/(thanks|application-submitted)/i,
        /workable\.com\/.*\/(thank|applied|success)/i,
    ];

    const TEXT_PATTERNS = [
        /you(?:'ve| have)? (?:successfully )?submitted your application/i,
        /thank(?:s| you) for (?:applying|your application)/i,
        /your application (?:has been|was|is) (?:submitted|received|sent|in)/i,
        /we(?:'ve| have)? received your application/i,
        /application (?:has been )?(?:submitted|received|confirmed) successfully/i,
        /your application to .+ (?:has been )?(?:submitted|received)/i,
    ];

    const detectByUrl = () => URL_PATTERNS.some((p) => p.test(location.href));

    const detectByText = () => {
        const body = document.body?.innerText || '';
        if (!body || body.length < 30 || body.length > 100_000) return false;
        return TEXT_PATTERNS.some((p) => p.test(body));
    };

    const isConfirmationPage = () => detectByUrl() || detectByText();

    if (!isConfirmationPage()) return;

    // ---------- extract job info ----------
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
                    }
                }
            } catch { /* ignore */ }
        }
        return out;
    };

    const parseHostSpecific = () => {
        const host = location.hostname.toLowerCase();
        const out = {};
        if (/linkedin\.com$/.test(host)) {
            out.position =
                text('h1.top-card-layout__title') ||
                text('.jobs-unified-top-card__job-title') ||
                text('.job-details-jobs-unified-top-card__job-title');
            out.company =
                text('.topcard__org-name-link') ||
                text('.jobs-unified-top-card__company-name a') ||
                text('.jobs-unified-top-card__company-name') ||
                text('.job-details-jobs-unified-top-card__company-name a');
        } else if (/greenhouse\.io$/.test(host)) {
            out.position = text('.app-title') || text('h1.section-header') || text('h1');
            out.company =
                text('.company-name')?.replace(/^at\s+/i, '') ||
                attr('meta[property="og:site_name"]', 'content');
            if (!out.company || /greenhouse/i.test(out.company)) {
                const parts = location.pathname.split('/').filter(Boolean);
                if (parts.length) out.company = titleCase(parts[0].replace(/[-_]/g, ' '));
            }
        } else if (/lever\.co$/.test(host)) {
            out.position = text('.posting-headline h2') || text('h2');
            const parts = location.pathname.split('/').filter(Boolean);
            if (parts.length) out.company = titleCase(parts[0].replace(/[-_]/g, ' '));
        } else if (/ashbyhq\.com$/.test(host)) {
            out.position = text('h1');
            const parts = location.pathname.split('/').filter(Boolean);
            if (parts.length) out.company = titleCase(parts[0].replace(/[-_]/g, ' '));
        } else if (/myworkdayjobs\.com$/.test(host) || /workday\.com$/.test(host)) {
            out.position =
                text('[data-automation-id="jobPostingHeader"]') ||
                text('h2[data-automation-id]') ||
                text('h1');
            const subParts = host.split('.');
            if (subParts.length >= 3 && subParts[0] && subParts[0] !== 'www') {
                out.company = titleCase(subParts[0].replace(/[-_]/g, ' '));
            }
        }
        return out;
    };

    const parseFromConfirmationText = () => {
        // Many confirmation pages say "Thank you for applying to <Company>" — pluck that out.
        const body = document.body?.innerText || '';
        const out = {};
        const m =
            body.match(/(?:thank(?:s| you) for applying (?:to|with|at))\s+([A-Z][\w&.\- ]{1,60})/i) ||
            body.match(/your application (?:to|for)\s+([A-Z][\w&.\- ]{1,60})/i);
        if (m && m[1]) {
            out.company = m[1].replace(/[.,!?]+$/, '').trim();
        }
        return out;
    };

    const parseFromTitle = () => {
        const out = {};
        const title = (document.title || '').trim();
        if (!title) return out;
        const m = title.match(/^(.+?)\s+(?:at|@|-|–|—|\|)\s+(.+)$/i);
        if (m && m[2] && !/thank/i.test(m[2])) {
            out.position = m[1].trim();
            out.company = m[2].trim();
        }
        return out;
    };

    const jobData = (() => {
        const host = parseHostSpecific();
        const jsonLd = parseJsonLd();
        const fromText = parseFromConfirmationText();
        const fromTitle = parseFromTitle();
        // Priority: host-specific → JSON-LD → confirmation-text regex → page title
        const merged = { ...fromTitle, ...fromText, ...jsonLd, ...host };
        return {
            company: merged.company ? String(merged.company).slice(0, 120).trim() : '',
            position: merged.position ? String(merged.position).slice(0, 150).trim() : '',
            location: merged.location ? String(merged.location).slice(0, 120).trim() : '',
            salary: merged.salary ? String(merged.salary).slice(0, 120).trim() : '',
            workType: merged.workType || '',
            jobUrl: document.referrer && /^https?:/.test(document.referrer) ? document.referrer : location.href,
        };
    })();

    // ---------- dismissal storage ----------
    const dismissKey = `apptrack-dismissed-${location.hostname}`;
    chrome.storage.sync.get([dismissKey], (data) => {
        if (data[dismissKey]) return; // user said don't show on this site
        // Defer so we don't fight the page's own load animations
        setTimeout(injectWidget, 600);
    });

    // ---------- widget ----------
    function injectWidget() {
        // Authenticate before showing — if user isn't logged in, prompt them to open AppTrack
        chrome.runtime.sendMessage({ type: 'APPTRACK_CHECK_AUTH' }, (resp) => {
            if (!resp?.authed) {
                renderWidget({ authed: false });
                return;
            }
            renderWidget({ authed: true });
        });
    }

    function renderWidget({ authed }) {
        const host = document.createElement('div');
        host.id = 'apptrack-widget-root';
        host.style.all = 'initial';
        document.documentElement.appendChild(host);

        // Shadow root so the host page's CSS can't bleed in
        const shadow = host.attachShadow({ mode: 'open' });

        const style = document.createElement('style');
        style.textContent = `
            :host { all: initial; }
            .card {
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 320px;
                background: #1d1d1f;
                color: #f5f5f7;
                border: 1px solid #36363a;
                border-radius: 12px;
                padding: 14px 14px 12px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 13px;
                line-height: 1.4;
                box-shadow: 0 10px 30px rgba(0,0,0,0.35);
                z-index: 2147483647;
                opacity: 0;
                transform: translateY(12px);
                transition: opacity 220ms ease-out, transform 220ms ease-out;
            }
            .card.shown {
                opacity: 1;
                transform: translateY(0);
            }
            .head {
                display: flex;
                align-items: center;
                gap: 6px;
                margin-bottom: 8px;
            }
            .brand-dot {
                display: inline-block;
                width: 7px;
                height: 7px;
                background: #f97316;
            }
            .brand {
                font-family: 'SF Mono','JetBrains Mono','Fira Code',ui-monospace,monospace;
                font-size: 11px;
                font-weight: 600;
                letter-spacing: 0.02em;
            }
            .close-x {
                margin-left: auto;
                background: transparent;
                border: 0;
                color: #9a9aa1;
                font-size: 16px;
                cursor: pointer;
                padding: 0 4px;
                line-height: 1;
            }
            .close-x:hover { color: #f5f5f7; }
            .title {
                font-size: 14px;
                font-weight: 600;
                margin-bottom: 4px;
            }
            .meta {
                font-size: 12px;
                color: #c0c0c5;
                margin-bottom: 12px;
                word-break: break-word;
            }
            .meta b { color: #f5f5f7; font-weight: 600; }
            .row {
                display: flex;
                gap: 6px;
                align-items: center;
            }
            .btn-primary {
                flex: 1;
                background: #f97316;
                color: white;
                border: 0;
                padding: 8px 12px;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                border-radius: 6px;
                transition: background 0.15s;
                font-family: inherit;
            }
            .btn-primary:hover { background: #ea6b0e; }
            .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
            .btn-ghost {
                background: transparent;
                color: #9a9aa1;
                border: 1px solid #36363a;
                padding: 8px 10px;
                font-size: 12px;
                cursor: pointer;
                border-radius: 6px;
                font-family: inherit;
            }
            .btn-ghost:hover { color: #f5f5f7; border-color: #6a6a70; }
            .footer {
                margin-top: 10px;
                font-family: 'SF Mono','JetBrains Mono','Fira Code',ui-monospace,monospace;
                font-size: 10px;
                color: #6a6a70;
                text-align: right;
            }
            .footer a {
                color: #6a6a70;
                text-decoration: underline;
                text-underline-offset: 2px;
                cursor: pointer;
            }
            .footer a:hover { color: #c0c0c5; }
            .success {
                display: flex;
                align-items: center;
                gap: 8px;
                color: #22c55e;
                font-weight: 600;
                font-size: 14px;
            }
            .success-icon {
                width: 22px; height: 22px;
                border-radius: 50%;
                background: rgba(34,197,94,0.15);
                display: flex; align-items: center; justify-content: center;
            }
            .error {
                color: #ef4444;
                font-size: 12px;
                margin-bottom: 8px;
            }
        `;
        shadow.appendChild(style);

        const card = document.createElement('div');
        card.className = 'card';
        shadow.appendChild(card);

        if (!authed) {
            renderNotAuth(card);
        } else if (!jobData.company && !jobData.position) {
            renderManual(card);
        } else {
            renderConfirm(card);
        }

        // animate in
        requestAnimationFrame(() => card.classList.add('shown'));
    }

    function dismiss(card) {
        const root = document.getElementById('apptrack-widget-root');
        card.classList.remove('shown');
        setTimeout(() => root?.remove(), 240);
    }

    function dontShowAgain() {
        chrome.storage.sync.set({ [dismissKey]: true });
        const root = document.getElementById('apptrack-widget-root');
        root?.remove();
    }

    function renderConfirm(card) {
        const meta = jobData.position && jobData.company
            ? `<b>${escapeHtml(jobData.position)}</b> at <b>${escapeHtml(jobData.company)}</b>`
            : jobData.company
                ? `at <b>${escapeHtml(jobData.company)}</b>`
                : jobData.position
                    ? `<b>${escapeHtml(jobData.position)}</b>`
                    : 'this application';

        card.innerHTML = `
            <div class="head">
                <span class="brand-dot"></span>
                <span class="brand">apptrack</span>
                <button class="close-x" aria-label="Dismiss">×</button>
            </div>
            <div class="title">Did you just apply?</div>
            <div class="meta">${meta}</div>
            <div class="row">
                <button class="btn-primary">+ Add to AppTrack</button>
                <button class="btn-ghost">Not now</button>
            </div>
            <div class="footer"><a class="dontshow">don't show on this site</a></div>
        `;

        const btnSave = card.querySelector('.btn-primary');
        const btnSkip = card.querySelector('.btn-ghost');
        const close = card.querySelector('.close-x');
        const dont = card.querySelector('.dontshow');

        close.addEventListener('click', () => dismiss(card));
        btnSkip.addEventListener('click', () => dismiss(card));
        dont.addEventListener('click', dontShowAgain);

        btnSave.addEventListener('click', async () => {
            btnSave.disabled = true;
            btnSave.textContent = 'Saving...';

            const payload = {
                company: jobData.company || 'Untitled',
                position: jobData.position || '',
                location: jobData.location || null,
                salary: jobData.salary || null,
                workType: jobData.workType || null,
                jobUrl: jobData.jobUrl || location.href,
                status: 'Applied',
                dateApplied: new Date().toISOString().slice(0, 10),
            };

            chrome.runtime.sendMessage({ type: 'APPTRACK_SAVE', payload }, (resp) => {
                if (resp?.ok) {
                    renderSuccess(card);
                    setTimeout(() => dismiss(card), 2500);
                } else {
                    btnSave.disabled = false;
                    btnSave.textContent = '+ Add to AppTrack';
                    showError(card, resp?.error || 'Save failed');
                }
            });
        });
    }

    function renderManual(card) {
        card.innerHTML = `
            <div class="head">
                <span class="brand-dot"></span>
                <span class="brand">apptrack</span>
                <button class="close-x" aria-label="Dismiss">×</button>
            </div>
            <div class="title">Looks like you just applied</div>
            <div class="meta">Couldn't auto-detect the job details. Open AppTrack to add manually.</div>
            <div class="row">
                <button class="btn-primary">Open AppTrack</button>
                <button class="btn-ghost">Dismiss</button>
            </div>
            <div class="footer"><a class="dontshow">don't show on this site</a></div>
        `;

        const btnOpen = card.querySelector('.btn-primary');
        const btnSkip = card.querySelector('.btn-ghost');
        const close = card.querySelector('.close-x');
        const dont = card.querySelector('.dontshow');

        btnOpen.addEventListener('click', () => {
            chrome.storage.sync.get(['frontendUrl'], ({ frontendUrl }) => {
                window.open(`${frontendUrl || 'https://apptrack.harshithpeta.com'}/applications/create`, '_blank');
                dismiss(card);
            });
        });
        btnSkip.addEventListener('click', () => dismiss(card));
        close.addEventListener('click', () => dismiss(card));
        dont.addEventListener('click', dontShowAgain);
    }

    function renderNotAuth(card) {
        card.innerHTML = `
            <div class="head">
                <span class="brand-dot"></span>
                <span class="brand">apptrack</span>
                <button class="close-x" aria-label="Dismiss">×</button>
            </div>
            <div class="title">Did you just apply?</div>
            <div class="meta">Sign in to AppTrack to track this one.</div>
            <div class="row">
                <button class="btn-primary">Open AppTrack</button>
                <button class="btn-ghost">Not now</button>
            </div>
        `;
        const btnOpen = card.querySelector('.btn-primary');
        const btnSkip = card.querySelector('.btn-ghost');
        const close = card.querySelector('.close-x');
        btnOpen.addEventListener('click', () => {
            chrome.storage.sync.get(['frontendUrl'], ({ frontendUrl }) => {
                window.open(`${frontendUrl || 'https://apptrack.harshithpeta.com'}/login`, '_blank');
                dismiss(card);
            });
        });
        btnSkip.addEventListener('click', () => dismiss(card));
        close.addEventListener('click', () => dismiss(card));
    }

    function renderSuccess(card) {
        card.innerHTML = `
            <div class="head">
                <span class="brand-dot"></span>
                <span class="brand">apptrack</span>
            </div>
            <div class="success">
                <span class="success-icon" style="color:#22c55e;">✓</span>
                <span>Added to pipeline</span>
            </div>
        `;
    }

    function showError(card, msg) {
        let errBox = card.querySelector('.error');
        if (!errBox) {
            errBox = document.createElement('div');
            errBox.className = 'error';
            card.querySelector('.row').insertAdjacentElement('beforebegin', errBox);
        }
        errBox.textContent = msg;
    }

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
})();
