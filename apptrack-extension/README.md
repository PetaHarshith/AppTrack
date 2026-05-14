# AppTrack Chrome Extension

Save any job posting to your AppTrack pipeline with one click — manually from the toolbar, or *automatically prompted* right after you submit an application.

## Two flows

### 1. Auto-detection (the killer feature)
Apply to a job on LinkedIn, Workday, Greenhouse, Lever, Ashby, SmartRecruiters, or Workable. The moment you land on the "Thank you for applying" page, a small AppTrack widget slides up in the bottom-right corner with the job's details pre-filled. One click → tracked.

The widget can be dismissed for the session, or permanently per-site ("don't show on this site").

### 2. Manual save
Open any job page → click the AppTrack icon → form pre-fills → save. Works even on pages where the auto-detection doesn't fire (or you missed the prompt).

Both flows read the page **from your authenticated browser** — so LinkedIn and other login-gated pages work, bypassing bot walls that block server-side scraping.

## Install (dev mode)

1. Open `chrome://extensions`
2. Toggle **Developer mode** on (top right)
3. Click **Load unpacked**
4. Select the `apptrack-extension/` folder
5. Pin the AppTrack icon to your toolbar (puzzle-piece menu → click the pin next to AppTrack)

## Usage

1. Make sure you're logged into AppTrack at `http://localhost:5173` in the same browser
2. Browse to any job posting
3. Click the AppTrack icon
4. Edit the auto-detected fields if needed → **Save to AppTrack**

If the page isn't a job posting, the popup tells you. If you're not logged in, the popup tells you that too.

## What it talks to

By default, the extension calls `http://localhost:8000` (the backend dev server). To change this for a deployed AppTrack instance, edit `popup.js` or use chrome.storage to set:
```
chrome.storage.sync.set({ backendUrl: 'https://api.your-domain.com', frontendUrl: 'https://app.your-domain.com' })
```

## How auth works

The extension uses the existing AppTrack session cookie via `credentials: 'include'`. No tokens to manage, no separate sign-in. Requires:
- Better-auth cookies set with `SameSite=None; Secure` (configured in `Apptrack-backend/src/lib/auth.ts`)
- Backend CORS allowing `chrome-extension://` origins (configured in `Apptrack-backend/src/index.ts`)

## File map

| File | Purpose |
|---|---|
| `manifest.json` | MV3 manifest, permissions, action popup, content-script match patterns, background service worker |
| `popup.html` / `popup.css` / `popup.js` | The toolbar popup (manual save flow) |
| `content-script.js` | Injected on demand by the popup — site parsers + JSON-LD + OpenGraph fallback |
| `auto-detect.js` | Automatically runs on common job sites. Detects confirmation pages via URL + text patterns and injects a floating widget. |
| `background.js` | Service worker that handles authenticated POSTs to AppTrack (so the page's origin never sees the request) |
| `icons/icon-{16,48,128}.png` | Toolbar / store icons (regenerate with `node generate-icons.js`) |
| `generate-icons.js` | Pure-Node PNG generator for the icons (no deps) |

## Adding new site parsers

Open `content-script.js`, find `SITE_PARSERS`, add an entry:
```js
{
  name: 'YourSite',
  match: (host) => /yoursite\.com$/.test(host),
  parse: () => ({
    company: text('.your-company-selector'),
    position: text('.your-position-selector'),
    location: text('.your-location-selector'),
  }),
}
```

The parser runs in the page's DOM, so `text(sel)` / `attr(sel, attrName)` helpers are available.

## Publishing to Chrome Web Store

When you're ready to ship to real users:
1. Create a developer account: $5 one-time fee at https://chrome.google.com/webstore/devconsole
2. Bump `version` in `manifest.json`
3. Update `host_permissions` in `manifest.json` to point at your production backend URL
4. Zip the folder (excluding `generate-icons.js` and `README.md` is fine)
5. Upload → fill in store listing → submit for review (~3 days)
