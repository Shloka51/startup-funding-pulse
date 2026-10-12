# Startup Funding Pulse

**A weekly Indian startup-funding intelligence digest, ready every Monday morning.**

Built for Aarav, a venture scout at a Bengaluru family office. He used to skim 2–3
publications a day, catch about 60% of notable deals, and keep a spreadsheet that ran three
weeks behind. Startup Funding Pulse reads the whole week's funding news for him, pulls out
the signal with **Google Gemini Flash**, puts his focus sectors and stages first, spots
patterns in where capital is moving, and flags any watchlist company the moment it shows up.

- **Live URL:** https://startup-funding-pulse-ivory.vercel.app
- **Architecture:** see [`COMPONENTS_MAP.md`](COMPONENTS_MAP.md)

---

## What it does

1. **Pulls the previous 7 days** of Indian startup-funding news live from Google News RSS
   (6 broad searches + 1 per focus sector). No hardcoded deals.
2. **Extracts structured deals with Gemini Flash**, one call per article: company, sector,
   stage, amount, lead investor, date, one-line summary, and source link.
3. **Ranks focus deals first**: sector **and** stage match, then either, then everything else.
4. **Detects 2–4 patterns** across the week in one more Gemini Flash call, each backed by real deals.
5. **Flags watchlist companies** whether they're raising, investing, or named in the headline.
6. **Renders a scannable brief**: watchlist alerts → patterns → focus deals → other deals.

**AI provider: Google Gemini Flash only** (`@google/genai`, model `gemini-3.8-flash`).

## Aarav can change his focus himself

Open **Settings** in the app to edit focus sectors, focus stages and watchlist companies.
They're saved to Supabase and applied instantly. Without a database, the app reads
[`config/default-config.json`](config/default-config.json) instead.

## Delivery cadence

- **Monday 07:00 IST:** Vercel Cron (`vercel.json`) regenerates and caches the brief.
- **On demand:** the **Refresh digest** button re-runs the pipeline (about a minute).
- **Always current:** if the cached brief is more than 12 h old, a visit triggers a background rebuild.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, Tailwind CSS 4 |
| Backend | Next.js route handlers |
| Database | Supabase (Postgres) |
| APIs | Google News RSS · Google Gemini Flash · Supabase · Vercel Cron |
| Hosting / VCS | Vercel · GitHub |

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in real values (never commit this file)
npm run dev
```

Then:

1. In Supabase → **SQL Editor**, run [`supabase/schema.sql`](supabase/schema.sql) once.
2. Open http://localhost:3000, and the first visit generates the brief.

### Environment variables

| Name | Purpose |
|---|---|
| `GEMINI_API_KEY` | Google AI Studio key for Gemini Flash |
| `GEMINI_MODEL` | Gemini Flash model id (default `gemini-3.8-flash`) |
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase public key (not used to read data; tables are locked by RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key used for all database access |
| `CRON_SECRET` | Random string; protects `/api/cron` |

## Useful endpoints

| Endpoint | What it returns |
|---|---|
| `GET /api/news` | The raw live news feed (before AI), with per-search status |
| `GET /api/digest` | The latest cached digest as JSON |
| `POST /api/digest` | Re-runs the full pipeline |
| `GET/PUT /api/config` | Read / save Aarav's settings |

## Reliability

The page never crashes or goes blank. Failed news searches, malformed Gemini output, a
missing Gemini key, an empty week, or no focus matches each have a designed state, and the
last good brief is always kept as a fallback. See section 6 of `COMPONENTS_MAP.md`.
