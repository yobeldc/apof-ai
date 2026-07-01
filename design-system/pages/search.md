# Page spec — `/search`

The flagship screen. Must feel instant and effortless.

## Layout
```
┌───────────────────────────────────────────────────────────────┐
│  [ /  Search putusan, nomor, parties, court…           ⌘K ]    │  ← SearchBar (sticky)
│  Sort: Relevance ▾        1,284 results · 0.02s                 │
├──────────────┬────────────────────────────────────────────────┤
│ FilterPanel  │  [chip] [chip] [chip]  ← active filters         │
│  Year ▸      │                                                 │
│  Court ▸     │  ┌─ CaseResultCard ─────────────────────────┐   │
│  Tingkat ▸   │  │ No. 123 K/Pid.Sus/2021      [Kasasi]      │   │
│  Klasifikasi │  │ Mahkamah Agung · Pidana Khusus           │   │
│  Amar ▸      │  │ Amar: Menolak permohonan kasasi…         │   │
│  ☑ Has PDF   │  │ 2021 · ◑ Partial · ↗ Source              │   │
│  ☑ Full text │  └──────────────────────────────────────────┘   │
│  ☑ Saved     │  … virtualized list …                           │
└──────────────┴────────────────────────────────────────────────┘
```

## Behavior
- Focus the bar with `/`; open command palette with `⌘K`.
- Typing debounces 180ms; the URL carries `?q=&year=&court=&...` so state is
  shareable and back/forward works.
- Filter chips are removable tokens; the FilterPanel (left, collapsible on
  mobile into a sheet) is the source of truth, chips mirror it.
- Sort: relevance · newest decision date · oldest decision date · recently added.
- A thin determinate top-bar shows query latency; never a blocking spinner.
- Results are **`CaseResultCard`**: nomor putusan (mono) · court · klasifikasi/
  tingkat chips · 2-line amar clamp · footer (year · `DataQualityBadge` ·
  `SourceLinkButton` · `SaveCaseButton`). Respects PrivacyToggle (hide/redact
  party names).

## States
- **Empty (no query):** beautiful zero-state — suggested searches, recent
  searches, total indexed count, and a "Try demo data" hint if DB is empty.
- **No results:** empty illustration + "Clear filters" + tips (search by nomor,
  try broader terms).
- **Loading:** 6 `CaseResultCard` skeletons (shimmer), filter panel stays
  interactive.
- **Error:** inline card with retry; the search box never gets stuck.

## Privacy
- Sensitive klasifikasi (e.g. involving minors / certain pidana) show a small
  caution chip.
- PrivacyToggle in the top bar flips party names to redacted in all list views
  instantly (no refetch).
