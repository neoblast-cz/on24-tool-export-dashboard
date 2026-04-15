# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Production build → .next/standalone/ (standalone output mode)
npm run start    # Run production build
npm run lint     # ESLint via Next.js
```

**Windows ARM64 note**: SWC binary requires the ARM64 VC++ Redistributable. If `vcruntime140.dll` is missing, run `winget upgrade Microsoft.VCRedist.2015+.arm64`. Do not add `@next/swc-win32-arm64-msvc` as an explicit dependency — Next.js manages it automatically.

## Environment Variables (`.env.local`)

```bash
ON24_CLIENT_ID=         # On24 account ID
ON24_TOKEN_KEY=         # On24 API token key
ON24_TOKEN_SECRET=      # On24 API token secret
ON24_API_BASE_URL=      # https://api.on24.com/v2  (use api.eu.on24.com/v2 for EU)
AUTH_USERNAME=          # Dashboard login username
AUTH_PASSWORD=          # Dashboard login password
AUTH_SESSION_TOKEN=     # Session signing secret
CACHE_TTL_HOURS=24      # Optional, defaults to 24
```

## Architecture

### Data flow

```
On24 API ──► /api/on24/* routes ──► Zustand store (localStorage) ──► React pages
                   │
            On24Client singleton
            (auth headers, retry, pagination)
```

### Key layers

**On24 API client** (`src/lib/on24/client.ts`)
Singleton returned by `getOn24Client()`. Handles auth headers (`accesstokenkey` / `accesstokensecret`), exponential backoff on 429/5xx, and `requestAllPages()` which detects endpoints that ignore pagination params to avoid infinite loops.

**API routes** (`src/app/api/on24/`)
- `events/` — Fetches and normalises events into `WebinarSummary[]`. Splits date ranges into 180-day chunks (On24 API limit), deduplicates by event ID.
- `export-data/` — Enriches individual events with polls, surveys, resources, CTAs, and registrant sources.
- `attendee-metrics/` — Computes per-event `AttendeeMetrics` from raw attendee records (engagement scores, viewing times, interaction counts).
- `registration-sources/` — Channel/source attribution from registrant data.

All routes that use `searchParams` must have `export const dynamic = 'force-dynamic'`.

**Revenue & Marketo routes** (`src/app/api/revenue/`, `src/app/api/marketo/`)
- Files stored in `reports/` directory, differentiated by filename pattern: Revenue files match `/revenue attribution/i`, Marketo files require `/program membership/i`.
- Naming convention enforced on upload: `YYYY-MM-DD Revenue Attribution.xlsx` / `YYYY-MM-DD Program Membership.xlsx`.
- Each has `data/` (GET with optional `?file=` param, defaults to latest), `upload/` (POST), and `files/` (GET list + DELETE) routes.
- Path-traversal protection on delete: reject filenames containing `/`, `\`, or `..`.

**Zustand store** (`src/store/webinar-store.ts`)
Persists dashboard data and date filter to localStorage (24-hour TTL via `isCacheValid()`). Attendee metrics are stored per event after batch loading. `filterVersion` increments to trigger re-fetches when the date filter changes.

**CSV generator** (`src/lib/csv/generator.ts`)
60+ configurable columns. Attendee-derived columns have `am_` prefix and require `attendeeMetrics.loaded`. BOM prefix included for Excel UTF-8 compatibility.

**Insights page** (`src/app/insights/page.tsx`)
Large single-file component (~2000+ lines). Tabs: Setup | Registration | Attendance | Engagement | Revenue. Key computed values:
- `mktMatchedPrograms` — Marketo programs cross-referenced against `filteredWebinars` by campaign code (strips `*suffix` on both sides).
- `mktMissingWebinars` — ON24 events with campaign codes absent from the Marketo report.
- Revenue tab shows Marketo Successes (MT) or New Names (FT) column alongside pipeline/revenue.
- `funnelSlot` prop on `RegistrationSources` injects the Email Invite Funnel into the right column above Best Attendance Rate.

### Types

- `src/types/webinar.ts` — Internal types: `WebinarSummary`, `AttendeeMetrics`, `DashboardData`, `OverallStats`
- `src/types/on24.ts` — On24 API response shapes

### Brand / theme

See **[DESIGN.md](./DESIGN.md)** — the design bible for all visual decisions (colors, typography, spacing, component patterns).

Key implementation notes for this codebase:
- DESIGN.md was written for a vanilla HTML/CSS/JS stack. All HTML class names (`.kpi-card`, `.chart-card`, `.ms-wrap`, etc.) and `ansell.digital.css` are **not used here** — translate the design intent into Tailwind utilities instead. Do not create `ansell.digital.css`.
- `showLoading()` / `showEmpty()` / `showDash()` state machine → React `useState` / `useEffect`.
- Chart.js + `<canvas>` → Recharts (SVG). DESIGN.md color palettes still apply.
- CSS custom properties (`--ansell-blue`, `--ansell-teal`, `--danger-red`, etc.) are defined in `globals.css` and mirrored as Tailwind color tokens (`ansell-blue`, `ansell-teal`) in `tailwind.config.ts`.
- Border radius: `globals.css` applies `8px` globally. Chart/card containers follow the no-radius intent from DESIGN.md via `rounded-none` where needed.
