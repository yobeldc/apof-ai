# Page spec — `/ingestion`

Safe, transparent, resumable. The UI must make *polite* the path of least
resistance.

## Top banner (persistent, warning tone)
> ⚠️ **Use polite ingestion. Do not overload the public court system.**
> Concurrency 1 · randomized 8–20s delay · backoff on errors · respects
> robots.txt. Mahkamah Agung is the source of truth.

## Sections
1. **IngestionControlPanel** — start / pause / stop, current rate display,
   "Dry run" toggle (discover URLs without fetching detail pages).
2. **Modes** (tabs or segmented control):
   - **Seed Explorer** — discover from MA listing/search/category pages.
     Choose run size: **Small (≤100)** · Medium (≤1,000) · Large (≤10,000,
     very slow & resumable). Default **Small**. Optional court/year/klasifikasi
     filters when discoverable.
   - **Import CSV/TXT** — upload a file of URLs (one per line, or a `url` column).
   - **Paste URLs** — textarea, many at once.
   - **Single URL** — one field.
   - **Re-ingest failed** — requeue everything in `failed`.
3. **Live job list** — `JobProgressCard` per job: mode, status pill, progress
   (done / failed / total), elapsed, rate, actions (open, pause, stop).
4. **Queue health (bento)** — counts by status: pending · processing · completed
   · failed · skipped. Click to filter.

## Settings (inline + `/settings`)
- max listing pages per run · max detail pages per run · delay min/max ·
  concurrency · allowed hours.
- All persisted; per-job config snapshot stored in `IngestionJob.config_json`.

## Job detail — `/ingestion/jobs/[id]`
- Header: mode, status, config snapshot, started/finished, totals.
- Streaming **log console** (mono, leveled lines) with autoscroll + pause.
- Discovered-URL table for the job (status, attempts, last error) with
  "retry failed".

## States
- **Empty:** "No ingestion yet" with the three quick actions and an explicit
  reminder that the app ships usable with **demo data** first.
- **Running:** control panel shows live rate + next-request countdown.
- **Throttled/backoff:** an amber notice "Backing off after 429/timeout — next
  attempt in N s".
- **Outside allowed hours:** jobs pause automatically with a clear reason.
