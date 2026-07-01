# Page spec — `/` (Dashboard)

The research command center. Must impress at first launch — even on demo data —
while staying calm and information-dense (UI UX Pro Max: bento grid + data
discipline).

## Layout
```
┌───────────────────────────────────────────────────────────────┐
│  HERO  (gradient + subtle grid, primary glow)                  │
│  Putusan Pro · "local research command center"                 │
│  [ 🔍  big GlobalSearch ───────────────── Enter ]   [Ingest]   │
├───────────────────────────────────────────────────────────────┤
│  Indexed │ With PDF │ Saved │ Failed URLs     ← 4 StatTiles     │
├──────────────────────────────┬────────────────────────────────┤
│  Decisions by year (chart)   │  Latest ingestion (progress)    │
├──────────────────────────────┼────────────────────────────────┤
│  Recently added (list)       │  Top classifications            │
│                              │  Recent searches (chips)        │
└──────────────────────────────┴────────────────────────────────┘
```

## Bento widgets
- **Hero/search** — gradient surface (`from-card to-muted/40`), faint `bg-grid`,
  one soft primary blur. Houses `GlobalSearch` (routes to `/search`). Not loud.
- **StatTiles** (4) — Indexed decisions · With PDF · Saved cases · Failed URLs.
  Tabular numerals, accent-tinted icon chip with inset ring, hover lifts border.
  Failed tile turns destructive accent when > 0.
- **Year distribution** — Recharts bar, theme-driven colors, tooltip in popover
  tokens; spans 2 cols.
- **Latest ingestion** — mode + status pill + progress bar + done/failed/total;
  deep-links to the job. Mirrors `/ingestion` semantics.
- **Recently added** — last 6 cases, mono nomor + court/klasifikasi/year +
  `DataQualityBadge`; row links to detail.
- **Top classifications** — ranked counts, each a filter link to `/search`.
- **Recent searches** — dedup chips linking back to the query.

## Data quality
- Every case row carries a `DataQualityBadge` (complete/partial/pending/failed)
  so trust is visible at a glance. Demo rows show a "Demo" chip elsewhere.

## States
- **Empty (no cases)** — beautiful `EmptyState`: "No decisions indexed yet" with
  two CTAs (Start ingestion · `npm run db:seed`). The dashboard never looks
  broken before data exists.
- **No ingestion yet** — Latest-ingestion widget explains the app is fully
  usable on demo data first.
- **Loading** — server-rendered (`force-dynamic`); skeletons used on client
  widgets if added later.

## Responsive
- 4-col stat row → 2-col on tablet → 1–2 on mobile. Charts/lists stack. Hero
  search stays full-width and thumb-reachable. No horizontal scroll.
