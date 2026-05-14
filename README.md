# AppTrack

A job application tracker built for students chasing their first big offer — a drag-and-drop pipeline, a Chrome extension that auto-detects when you've applied somewhere, and the dashboard analytics you actually need to land the role.

🌐 **Live**: [apptrack.harshithpeta.com](https://apptrack.harshithpeta.com)

## What's inside

| Feature | Notes |
|---|---|
| **Pipeline tracking** | 6-stage status flow (Applied → OA → Interview → Offer / Rejected / Withdrawn). Drag-drop kanban + sortable table view. |
| **Dashboard** | Conversion funnel visual, daily activity heatmap (12 weeks), action queue (deadlines + follow-ups), weekly cadence chart, response-time leaderboard. |
| **Chrome extension** | One-click save from any job page. Auto-detects "Thank you for applying" pages on LinkedIn, Workday, Greenhouse, Lever, Ashby, and pops up a "Add to AppTrack" widget right in the page. |
| **Smart job URL import** | Paste a Greenhouse / Lever / Ashby URL → server scrapes company/position/location with cheerio + JSON-LD fallback. |
| **Calendar** | Month grid of interview dates + OA deadlines. |
| **Cmd-K command palette** | Jump to any view, switch filters, toggle theme. |
| **Auto-imports** | Pasted-URL imports and extension saves are tagged `source='email|url_import|manual'` for transparency. |

## Tech

| Layer | Stack |
|---|---|
| Frontend | React 19 + TypeScript + Vite + Refine + shadcn/ui + Tailwind + Recharts + @dnd-kit + GSAP |
| Backend  | Node.js + Express 5 + TypeScript + Drizzle ORM + Zod + Better-Auth |
| Database | PostgreSQL |
| Extension | Manifest V3 Chrome extension, vanilla JS + Shadow DOM widget |
| Hosting | Vercel (frontend + backend as serverless), Neon (Postgres) |

## Repo layout

```
AppTrack/
├── api/                       # Vercel serverless entry — re-exports the Express app
├── Apptrack-backend/          # Express app source (routes, db, lib)
│   └── src/
├── Apptrack-frontend/         # Vite + React app
│   └── src/
├── apptrack-extension/        # MV3 Chrome extension
│   ├── popup.{html,css,js}    # toolbar popup (manual save)
│   ├── auto-detect.js         # confirmation-page auto-prompt widget
│   ├── content-script.js      # on-demand parser for popup
│   ├── background.js          # service worker for authenticated POSTs
│   └── icons/                 # 16/48/128 px generated PNGs
├── package.json               # Root: backend deps + workspace scripts
├── vercel.json                # Vercel build + rewrites
└── docker-compose.yml         # Local Postgres + pgAdmin
```

---

## Local development

### Prereqs
- Node 20+, npm 10+
- Docker (for local Postgres)

### Setup
```bash
git clone https://github.com/PetaHarshith/AppTrack.git
cd AppTrack

# 1. Backend deps (root) + frontend deps
npm install
npm --prefix Apptrack-frontend install

# 2. Local Postgres
cp Apptrack-backend/.env.example Apptrack-backend/.env
cp Apptrack-frontend/.env.example Apptrack-frontend/.env
docker compose -f Apptrack-backend/docker-compose.yml up -d

# 3. Apply schema
npm run db:push

# 4. Run both servers (in two terminals)
npm run dev:backend     # → http://localhost:8000
npm run dev:frontend    # → http://localhost:5173
```

Sign up at `localhost:5173/signup` and you're in.

### Chrome extension (dev)
1. `chrome://extensions` → toggle Developer Mode → **Load unpacked** → pick `apptrack-extension/`
2. Open the extension's service-worker DevTools and point it at your local backend:
   ```js
   chrome.storage.sync.set({
     backendUrl: 'http://localhost:8000',
     frontendUrl: 'http://localhost:5173',
   })
   ```
3. The extension is now wired up to your local stack.

---

## Production deployment (Vercel + Neon)

### 1. Provision the database (Neon — 5 min)
1. Sign up at [neon.tech](https://neon.tech) (free tier)
2. Create a new project → call it `apptrack`
3. Copy the **connection string** from the dashboard. It looks like:
   `postgres://user:pass@ep-foo-bar.region.aws.neon.tech/apptrack?sslmode=require`
4. Apply the schema from your local machine:
   ```bash
   DATABASE_URL='paste-neon-connection-string' npm run db:push
   ```

### 2. Deploy on Vercel (10 min)
1. Push the repo to GitHub if you haven't.
2. [Vercel dashboard](https://vercel.com/new) → **Import Git Repository** → pick `AppTrack`
3. **Framework Preset**: leave it on "Other" — `vercel.json` handles everything
4. **Environment Variables** — add these:
   | Name | Value |
   |---|---|
   | `DATABASE_URL` | (the Neon connection string from step 1) |
   | `BETTER_AUTH_SECRET` | run `openssl rand -hex 32` and paste the output |
   | `BETTER_AUTH_URL` | `https://apptrack.harshithpeta.com` |
   | `FRONTEND_URL` | `https://apptrack.harshithpeta.com` |
5. **Deploy**. First build takes ~2 minutes.

### 3. Custom domain (5 min)
1. In the Vercel project → **Settings → Domains** → add `apptrack.harshithpeta.com`
2. Vercel shows you a CNAME record to add. Copy it.
3. In your DNS provider (Cloudflare, Namecheap, etc.) add the CNAME:
   ```
   Type:  CNAME
   Name:  apptrack
   Value: cname.vercel-dns.com
   ```
4. Wait ~1 minute for propagation. Vercel will auto-issue an SSL cert.

### 4. Future deploys
Every push to `main` auto-deploys. Schema changes need `npm run db:push` against the prod `DATABASE_URL` separately (Neon doesn't auto-migrate).

---

## Production checklist

- [x] No hardcoded `localhost` URLs anywhere
- [x] Strong `BETTER_AUTH_SECRET` (not the dev placeholder)
- [x] CORS allowlists production frontend + chrome-extension origins only
- [x] Cookies set with `SameSite=None; Secure` (works because Vercel is HTTPS)
- [x] DB connection pool sized for serverless (`max: 1` on Vercel)
- [x] In-memory stats cache still present (no-op-friendly on cold functions, useful on warm ones)
- [x] `.env` files in `.gitignore`; `.env.example` documents every variable

---

## Project motivation

Job searching means tracking 50+ applications across spreadsheets, emails, and a dozen ATSes. AppTrack centralizes the pipeline, surfaces what actually needs attention today, and ships with a Chrome extension that turns "I just hit submit" into "this is tracked" with one click.

Built by [Harshith Peta](https://harshithpeta.com) — CS, University of Wisconsin–Madison.
