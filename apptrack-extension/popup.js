/**
 * Popup controller. Pipeline:
 *   1. Get the active tab.
 *   2. Inject the content script in that tab, get back the parsed page data.
 *   3. Show the user the editable form pre-filled with detected fields.
 *   4. On submit, POST to AppTrack's /applications endpoint with credentials.
 */

// Defaults to production. Override for local dev by running in the extension's
// service worker DevTools console:
//   chrome.storage.sync.set({ backendUrl: 'http://localhost:8000', frontendUrl: 'http://localhost:5173' })
const BACKEND_URL_DEFAULT = 'https://apptrack.harshithpeta.com';
const FRONTEND_URL_DEFAULT = 'https://apptrack.harshithpeta.com';

const $ = (id) => document.getElementById(id);

const showState = (name) => {
    ['loading', 'form', 'success', 'error', 'not-job', 'not-auth'].forEach((s) => {
        $(`state-${s}`).classList.toggle('hidden', s !== name);
    });
};

const getBackendUrl = async () => {
    try {
        const stored = await chrome.storage.sync.get(['backendUrl']);
        return stored.backendUrl || BACKEND_URL_DEFAULT;
    } catch {
        return BACKEND_URL_DEFAULT;
    }
};

const checkAuth = async (backendUrl) => {
    try {
        const r = await fetch(`${backendUrl}/api/auth/get-session`, {
            method: 'GET',
            credentials: 'include',
        });
        if (!r.ok) return false;
        const data = await r.json();
        return !!data?.user;
    } catch {
        return false;
    }
};

const readPage = async (tabId) => {
    const [result] = await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content-script.js'],
    });
    return result?.result;
};

const populateForm = (data) => {
    $('source-label').textContent = data.source || 'page';
    $('f-company').value = data.company || '';
    $('f-position').value = data.position || '';
    $('f-location').value = data.location || '';
    $('f-salary').value = data.salary || '';
    $('f-workType').value = data.workType || '';
    $('f-url').value = data.jobUrl || '';
};

const handleSubmit = async (e, backendUrl) => {
    e.preventDefault();
    const btn = $('submit-btn');
    btn.disabled = true;
    btn.querySelector('span:last-child').textContent = 'Saving...';

    const payload = {
        company: $('f-company').value.trim(),
        position: $('f-position').value.trim(),
        location: $('f-location').value.trim() || null,
        salary: $('f-salary').value.trim() || null,
        workType: $('f-workType').value || null,
        jobUrl: $('f-url').value || null,
        status: 'Applied',
        dateApplied: new Date().toISOString().slice(0, 10),
    };

    try {
        const r = await fetch(`${backendUrl}/api/applications`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!r.ok) {
            const errJson = await r.json().catch(() => ({}));
            throw new Error(errJson.error || `Backend returned ${r.status}`);
        }
        $('success-subtext').textContent = `${payload.company} — ${payload.position || 'untitled'}`;
        showState('success');
    } catch (err) {
        $('error-text').textContent = err.message || 'Network error';
        showState('error');
    }
};

const openApp = async () => {
    const stored = await chrome.storage.sync.get(['frontendUrl']);
    const url = stored.frontendUrl || FRONTEND_URL_DEFAULT;
    chrome.tabs.create({ url });
};

const init = async () => {
    showState('loading');
    const backendUrl = await getBackendUrl();

    // 1. Auth check
    const authed = await checkAuth(backendUrl);
    if (!authed) {
        showState('not-auth');
        $('open-login').addEventListener('click', openApp);
        return;
    }

    // 2. Read the page
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url || /^chrome:|^about:|^edge:|^chrome-extension:/.test(tab.url)) {
        showState('not-job');
        $('open-app').addEventListener('click', openApp);
        return;
    }

    let pageData;
    try {
        pageData = await readPage(tab.id);
    } catch (e) {
        // Some pages disallow scripting (e.g. chrome:// or protected origins)
        pageData = null;
    }

    if (!pageData || !pageData.looksLikeJob) {
        // Page didn't look like a job posting. Two paths:
        //   - If we at least got a URL, give the user the option to fill in manually.
        //   - Otherwise show the "not a job page" state.
        if (pageData && pageData.jobUrl) {
            populateForm(pageData);
            $('source-label').textContent = pageData.source || 'manual';
            showState('form');
            $('state-form').addEventListener('submit', (e) => handleSubmit(e, backendUrl));
            $('open-app-success').addEventListener('click', openApp);
            $('retry-btn').addEventListener('click', () => location.reload());
            $('f-company').focus();
            return;
        }
        showState('not-job');
        $('open-app').addEventListener('click', openApp);
        return;
    }

    // 3. Happy path — show the pre-filled form
    populateForm(pageData);
    showState('form');
    $('state-form').addEventListener('submit', (e) => handleSubmit(e, backendUrl));
    $('open-app-success').addEventListener('click', openApp);
    $('retry-btn').addEventListener('click', () => location.reload());

    // Focus position if company was auto-filled, otherwise focus company
    if (pageData.company && !pageData.position) {
        $('f-position').focus();
    } else if (!pageData.company) {
        $('f-company').focus();
    }
};

document.addEventListener('DOMContentLoaded', init);
