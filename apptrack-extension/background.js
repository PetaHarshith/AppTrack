/**
 * Service worker for the AppTrack extension.
 *
 * The injected confirmation-page widget and the popup both send messages here to make
 * the authenticated POST. We make the fetch from the chrome-extension:// origin
 * (which the backend allowlists) instead of the host page's origin.
 *
 * Configuration: backendUrl is read from chrome.storage.sync. To point at production
 * vs dev, run in the extension service worker's DevTools:
 *
 *   chrome.storage.sync.set({ backendUrl: 'https://apptrack.harshithpeta.com' })
 *
 * Default is the production URL.
 */

const BACKEND_URL_DEFAULT = 'https://apptrack.harshithpeta.com';

const getBackendUrl = async () => {
    try {
        const stored = await chrome.storage.sync.get(['backendUrl']);
        return stored.backendUrl || BACKEND_URL_DEFAULT;
    } catch {
        return BACKEND_URL_DEFAULT;
    }
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'APPTRACK_SAVE') {
        (async () => {
            try {
                const backendUrl = await getBackendUrl();
                const r = await fetch(`${backendUrl}/api/applications`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(message.payload),
                });
                if (!r.ok) {
                    const err = await r.json().catch(() => ({}));
                    sendResponse({ ok: false, status: r.status, error: err.error || `HTTP ${r.status}` });
                    return;
                }
                sendResponse({ ok: true });
            } catch (e) {
                sendResponse({ ok: false, error: e?.message || 'Network error' });
            }
        })();
        return true;
    }

    if (message?.type === 'APPTRACK_CHECK_AUTH') {
        (async () => {
            try {
                const backendUrl = await getBackendUrl();
                const r = await fetch(`${backendUrl}/api/auth/get-session`, {
                    credentials: 'include',
                });
                if (!r.ok) {
                    sendResponse({ authed: false });
                    return;
                }
                const data = await r.json();
                sendResponse({ authed: !!data?.user });
            } catch {
                sendResponse({ authed: false });
            }
        })();
        return true;
    }
});
