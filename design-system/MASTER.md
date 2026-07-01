# Putusan Pro — Master Design System

> **v2 — generated with UI UX Pro Max.** This revision was produced by querying
> the installed `ui-ux-pro-max` skill (`.claude/skills/ui-ux-pro-max`) and
> applying its recommendations. Source queries & results:
>
> - `--design-system "legal research dashboard … dark mode data-dense"` →
>   **Style: Dark Mode (OLED)** (WCAG AAA, dark default); blue + amber direction.
> - `--domain typography "professional editorial trustworthy legal"` →
>   **"Legal Professional"**, **"Corporate Trust" (Lexend, built for
>   readability)**, and **"News Editorial" → Newsreader ("designed for long-form
>   reading")** — adopted for the legal full-text reader.
> - `--domain color "fintech saas professional trust"` → **trust-blue primary
>   (#2563EB / #3B82F6)** on deep-slate background (#0F172A family); **amber
>   reserved for caution**.
> - `--domain ux` / `--domain web` → keyboard nav, **skip links**, semantic HTML
>   before ARIA, virtualize/paginate >50 rows, table overflow wrappers.
> - `--stack shadcn` → use real Tabs/Sidebar primitives, not custom divs.
>
> Anti-patterns the skill flagged and we honor: no light-mode-default, no emoji
> icons (Lucide SVG only), no layout-shifting hover scale, no invisible borders.

---

## 1. Brand personality

**Putusan Pro is a precision instrument for legal research.** It should feel
like Linear's dashboard met Apple's typographic restraint and Arc's calm
motion — serious, trustworthy, quiet, and *fast*. It is emphatically **not a
government portal**: no clutter, no stock imagery, no childish color.

Adjectives we design toward: *calm, authoritative, legible, dense-but-airy,
intelligent, honest.*

Three non-negotiable honesty rules surface in the UI itself:
- "Not an official Mahkamah Agung product." (persistent, in footer/about)
- Original source link is always one tap away on every case.
- AI output always carries: "AI summary may be inaccurate. Always verify with the official source."

---

## 2. Color tokens

Colors are defined as HSL channel triplets in `src/app/globals.css` and consumed
through Tailwind semantic names (`bg-background`, `text-muted-foreground`, …).
Never hard-code hex in components.

Trust-blue primary + amber-for-caution, per the skill's Fintech/SaaS palettes.

### Light (high-contrast, per skill checklist)
| Token | HSL | Hex ~ | Use |
|---|---|---|---|
| `--background` | `210 40% 99%` | #FCFDFE | app canvas |
| `--foreground` | `222 47% 11%` | #0F172A (slate-900) | primary text |
| `--muted-foreground` | `215 16% 38%` | #475569 (slate-600) | secondary text |
| `--card` | `0 0% 100%` | #FFFFFF | surfaces |
| `--border` | `214 32% 91%` | #E2E8F0 (slate-200) | hairlines |
| `--primary` | `221 83% 53%` | #2563EB (blue-600) | actions, focus |
| `--accent` | `199 89% 44%` | #0284C7 (sky) | informational highlight |
| `--success` | `160 84% 30%` | emerald | completed / verified |
| `--warning` | `35 92% 45%` | amber | privacy / caution **only** |
| `--destructive` | `0 72% 48%` | muted red | failed / destructive |

### Dark (default — "Dark Mode (OLED)")
Deep slate-blue canvas `222 47% 6%` (#0B1120 family), elevated cards `222 40% 9%`,
trust-blue primary lifted to `217 91% 60%` (#3B82F6), text not pure white
(`214 32% 91%` ≈ slate-200), low-noise borders `216 30% 16%`. Full values in
`globals.css`. Dark is the **default theme**; light mode is fully supported.

**Semantic mapping (status):** `pending → muted`, `processing → accent`,
`completed → success`, `failed → destructive`, `skipped → muted-foreground`,
`paused/warning → warning`.

Contrast: every text/background pair targets **WCAG AA (4.5:1)** for body,
**3:1** for large text and UI affordances. The indigo primary on white and the
lifted indigo on slate both clear AA.

---

## 3. Typography

Pairing chosen via the skill's typography search (legal/editorial/trust):
- **Sans (UI):** Inter (`--font-sans`). The interface, labels, data. Neutral,
  premium, Linear-like. (Skill alternatives for accessibility: Lexend / Source
  Sans 3 — "Corporate Trust".)
- **Serif (reading):** **Newsreader** (`--font-serif`) — the skill's "News
  Editorial" pick, *"designed for long-form reading."* Used **only** for the
  legal full-text reader at generous measure. Nothing else uses serif.
- **Mono:** JetBrains Mono (`--font-mono`). `nomor_putusan`, dates, IDs, logs.

### Scale (1.20 minor-third, rem)
| Step | Size / line-height | Role |
|---|---|---|
| Display | 2.25 / 1.1 | dashboard hero numbers |
| H1 | 1.75 / 1.2 | page titles |
| H2 | 1.375 / 1.25 | section headers |
| H3 | 1.125 / 1.3 | card titles |
| Body | 0.9375 / 1.55 | default UI text (15px) |
| Body-read | 1.0625 / 1.7 | full-text reader (serif, 17px) |
| Small | 0.8125 / 1.4 | metadata, captions |
| Micro | 0.6875 / 1.3 | chips, badges (uppercase, tracked) |

Tabular numerals (`font-variant-numeric: tabular-nums`) for all stat counters
and dates so columns don't jitter.

---

## 4. Layout grid

- **App shell:** fixed left sidebar (`16rem`, collapsible to `4rem`) + top
  command bar (`3.5rem`) + scrollable content.
- **Content max width:** `1400px` (`container`). Reading column (full text)
  caps at `72ch`.
- **Spacing scale:** 4px base — `0.5 / 1 / 1.5 / 2 / 3 / 4 / 6 / 8` (Tailwind).
  Cards use `p-5`; dense lists use `py-3 px-4`.
- **Bento dashboard:** 12-col grid, `gap-4`. Tiles span 12 / 6 / 4 / 3 cols
  responsively. Hero stats are 3-col tiles; charts span 6–8.
- **Radius:** `--radius: 0.75rem`. Cards `rounded-lg`, chips `rounded-full`,
  inputs `rounded-md`.

---

## 5. Card system

One card primitive, three densities:
- **Surface card** (`Card`): `bg-card`, `border`, `rounded-lg`, soft shadow on
  hover only (`hover:shadow-md transition-shadow`). No heavy drop shadows.
- **Stat tile (bento):** large tabular number + label + delta + sparkline slot.
- **Result card** (`CaseResultCard`): dense, scannable — title row
  (`nomor_putusan` mono) + court + chips row + amar one-liner + footer (year,
  data-quality badge, source button). Hover lifts border to `--ring`, never
  the whole card.

Elevation is communicated by **border + subtle background shift**, not big
shadows (Linear principle).

---

## 6. Table / list density

- Result lists are **virtualizable**, 1 case per row on mobile, comfortable
  cards on desktop.
- Row height target: 96–120px for result cards; 44px for compact data rows.
- Zebra striping is **off**; separation via hairline borders.
- Truncate long values with `line-clamp` (amar: 2 lines, parties: 1 line) and
  reveal full on detail page — never wrap unboundedly in lists.
- Empty cells render an em-dash `—` in `muted-foreground`, never blank or
  "null".

---

## 7. Search interaction

- One **big search bar** owns the top of `/search`, focusable with `/` from
  anywhere.
- **Command palette** (`Cmd/Ctrl+K`) for navigation + quick search + actions.
- Filters are **chips** (Year, Court, Tingkat Proses, Klasifikasi, Amar, Has
  PDF, Has full text, Saved only) that read as removable tokens; active filters
  echo in the URL (shareable, restorable).
- Suggestions appear under the bar (recent searches + matched nomor putusan).
- Results update optimistically; show a thin top progress bar, never a
  full-screen spinner.
- Sort control: relevance · newest decision · oldest decision · recently added.

---

## 8. Legal document readability rules

- Full text renders in **serif, 17px, line-height 1.7, max 72ch**.
- Preserve paragraph breaks from source; collapse runs of blank lines.
- Section headings within a decision (MENGADILI, MENIMBANG, AMAR) are detected
  and emphasized (`font-semibold`, slight letter-spacing).
- A reading-progress indicator and a "jump to AMAR" affordance.
- The **raw source is always reachable** (Source tab / link) for verification —
  parsed views never claim to be authoritative.
- Redaction mode replaces detected party names with `▮▮▮▮` while keeping
  structure intact.

---

## 9. Accessibility rules

- Keyboard-first: every action reachable without a mouse; visible `focus-visible`
  ring (`--ring`, 2px offset). Command palette and `/` shortcut documented in a
  `?` shortcuts sheet.
- Semantic landmarks: `header`, `nav`, `main`, `aside`. Result cards are
  `<article>` with an accessible name = nomor putusan.
- Respect `prefers-reduced-motion`: disable transforms/parallax, keep opacity.
- Color is never the only signal — status uses icon + label + color.
- Hit targets ≥ 40px; chips ≥ 32px with adequate spacing.
- All icons that convey meaning have `aria-label`; decorative ones `aria-hidden`.

---

## 10. Motion rules

Subtle, purposeful, fast. Framer Motion with a shared spring.
- Durations: micro 120ms, standard 200ms, entrance 280ms. Easing
  `cubic-bezier(0.2, 0.8, 0.2, 1)`.
- Page/content enter: fade + 8px rise, staggered 24ms for lists (cap stagger at
  ~12 items).
- Hover: border/opacity only; no scale on dense UI (scale reserved for primary
  CTAs at 1.02).
- Skeletons shimmer at 1.6s; never spin.
- Honor `prefers-reduced-motion` globally (a `MotionConfig` wrapper).

---

## 11. Component inventory (maps to `src/components`)

`AppShell · Sidebar · TopCommandBar · CommandPalette · GlobalSearch · SearchView/
FilterPanel · CaseResultCard · CaseMetadataGrid · CaseTimeline · CaseTabs ·
AmarBlock · IngestionControlPanel · JobProgressCard · JobLogViewer ·
DataQualityBadge · SourceLinkButton · SaveCaseButton · NoteEditor · EmptyState ·
ErrorState · Skeletons · ThemeToggle · PrivacyToggle · StatTile ·
YearDistributionChart`

Each must ship: default, hover, focus, active, disabled, loading, empty, and
error states. No component is "done" until those exist.

---

## 12. Component quality checklist (UI UX Pro Max pre-delivery)

Run before shipping any component or page:

- [ ] **No emoji icons** — Lucide SVG only, consistent 24px viewBox.
- [ ] **cursor-pointer** on every clickable/hoverable element.
- [ ] **Hover = color/border/opacity** transition (150–300ms); never a scale that
      shifts layout (CTA scale 1.02 max, isolated).
- [ ] **Focus-visible** ring on all interactive elements (keyboard).
- [ ] **Semantic HTML before ARIA** — `<button>`/`<a>`/`<label>`, not
      `<div role>`; clickable rows are real links/buttons.
- [ ] **Contrast** — light body ≥ 4.5:1 (text slate-900, muted slate-600);
      borders visible in both modes (no `border-white/10`).
- [ ] **Color never the only signal** — pair with icon + text.
- [ ] **Lists > 50 rows** are paginated or virtualized; wide tables get
      `overflow-x-auto`.
- [ ] **prefers-reduced-motion** respected; skeletons (not spinners) for loads.
- [ ] **Responsive** at 375 / 768 / 1024 / 1440; no horizontal scroll on mobile.
- [ ] **Skip link** + landmarks present in the shell.
