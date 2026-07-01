# Graph Report - C:\Users\Yobel\Documents\code stuff\putusan-ai\src  (2026-06-30)

## Corpus Check
- Corpus is ~24,287 words - fits in a single context window. You may not need a graph.

## Summary
- 295 nodes · 709 edges · 14 communities (13 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Dashboard & Status Pages|Dashboard & Status Pages]]
- [[_COMMUNITY_Case API & Serialization|Case API & Serialization]]
- [[_COMMUNITY_Ingestion UI & Form Controls|Ingestion UI & Form Controls]]
- [[_COMMUNITY_App Shell & Navigation|App Shell & Navigation]]
- [[_COMMUNITY_Search UI & States|Search UI & States]]
- [[_COMMUNITY_Case Detail View|Case Detail View]]
- [[_COMMUNITY_URL Discovery & Normalization|URL Discovery & Normalization]]
- [[_COMMUNITY_Search Engine & API|Search Engine & API]]
- [[_COMMUNITY_Polite Fetcher|Polite Fetcher]]
- [[_COMMUNITY_Offline Import (HTMLPDF)|Offline Import (HTML/PDF)]]
- [[_COMMUNITY_Ingestion Orchestration|Ingestion Orchestration]]
- [[_COMMUNITY_Decision Parser|Decision Parser]]
- [[_COMMUNITY_Environment Config|Environment Config]]
- [[_COMMUNITY_Demo Data|Demo Data]]

## God Nodes (most connected - your core abstractions)
1. `cn()` - 39 edges
2. `normalizeUrl()` - 20 edges
3. `Button` - 14 edges
4. `fetchWithPoliteDelay()` - 14 edges
5. `usePrivacy()` - 12 edges
6. `isAllowedSource()` - 12 edges
7. `Badge()` - 11 edges
8. `importPdf()` - 11 edges
9. `runIngestionJob()` - 10 edges
10. `Card` - 9 edges

## Surprising Connections (you probably didn't know these)
- `Item()` --calls--> `cn()`  [EXTRACTED]
  components/command-palette.tsx → lib/utils.ts
- `NavLink()` --calls--> `cn()`  [EXTRACTED]
  components/sidebar.tsx → lib/utils.ts
- `DialogHeader()` --calls--> `cn()`  [EXTRACTED]
  components/ui/dialog.tsx → lib/utils.ts
- `POST()` --calls--> `runIngestionJob()`  [EXTRACTED]
  app/api/ingestion/jobs/route.ts → lib/ingest.ts
- `POST()` --calls--> `toJsonList()`  [EXTRACTED]
  app/api/notes/route.ts → lib/serialize.ts

## Import Cycles
- None detected.

## Communities (14 total, 1 thin omitted)

### Community 0 - "Dashboard & Status Pages"
Cohesion: 0.09
Nodes (20): metadata, metadata, DashboardPage(), metadata, DataQualityBadge(), MAP, JobDetail, JobLogsView() (+12 more)

### Community 1 - "Case API & Serialization"
Cohesion: 0.10
Nodes (22): POST(), GET(), POST(), schema, schema, CasePage(), generateMetadata(), ClientCase (+14 more)

### Community 2 - "Ingestion UI & Form Controls"
Cohesion: 0.11
Nodes (17): metadata, FileImportPanel(), ImportResult, GlobalSearch(), IngestionView(), Job, MODES, Queue (+9 more)

### Community 3 - "App Shell & Navigation"
Cohesion: 0.08
Nodes (24): inter, metadata, mono, serif, AppShell(), MOBILE_NAV, CommandPalette(), Item() (+16 more)

### Community 4 - "Search UI & States"
Cohesion: 0.10
Nodes (13): metadata, metadata, EmptyState(), ErrorState(), PrivacyToggle(), Filters, SearchView(), SORT_OPTIONS (+5 more)

### Community 5 - "Case Detail View"
Cohesion: 0.11
Nodes (17): CaseDetail(), JudgesTab(), OverviewTab(), PartiesTab(), SENSITIVE, SimilarCase, CaseResultCard(), SENSITIVE (+9 more)

### Community 6 - "URL Discovery & Normalization"
Cohesion: 0.22
Nodes (15): createSchema, POST(), discoverDecisionUrls(), DiscoverOptions, DiscoverResult, extractDetailLinks(), extractNextPage(), SEED_PRESETS (+7 more)

### Community 7 - "Search Engine & API"
Cohesion: 0.18
Nodes (15): GET(), parseList(), metadata, SavedPage(), buildFacets(), Facets, localSearch(), meiliSearch() (+7 more)

### Community 8 - "Polite Fetcher"
Cohesion: 0.25
Nodes (14): awaitTurn(), cachePathFor(), FetchOptions, FetchResult, fetchWithPoliteDelay(), getDisallowedPaths(), inFlight, isDisallowedByRobots() (+6 more)

### Community 9 - "Offline Import (HTML/PDF)"
Cohesion: 0.32
Nodes (12): POST(), canonicalUrlFromHtml(), escapeHtml(), exists(), guessNomorFromText(), importHtml(), ImportOutcome, importPdf() (+4 more)

### Community 10 - "Ingestion Orchestration"
Cohesion: 0.27
Nodes (11): POST(), listingPagesForSize(), isWithinAllowedHours(), appendLog(), JobConfig, jobControllers, LogLevel, LogLine (+3 more)

### Community 11 - "Decision Parser"
Cohesion: 0.43
Nodes (5): extractPdfUrl(), LABEL_MAP, norm(), parseDecisionPage(), yearFrom()

### Community 13 - "Demo Data"
Cohesion: 0.40
Nodes (3): DEMO_CASES, DemoCase, ParsedDecision

## Knowledge Gaps
- **59 isolated node(s):** `metadata`, `createSchema`, `schema`, `schema`, `metadata` (+54 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Ingestion UI & Form Controls` to `Dashboard & Status Pages`, `App Shell & Navigation`, `Search UI & States`, `Case Detail View`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **Why does `normalizeUrl()` connect `URL Discovery & Normalization` to `Polite Fetcher`, `Offline Import (HTML/PDF)`, `Ingestion Orchestration`, `Decision Parser`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `Button` connect `Search UI & States` to `Dashboard & Status Pages`, `Ingestion UI & Form Controls`, `Case Detail View`, `Search Engine & API`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **What connects `metadata`, `createSchema`, `schema` to the rest of the system?**
  _59 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Dashboard & Status Pages` be split into smaller, more focused modules?**
  _Cohesion score 0.0945945945945946 - nodes in this community are weakly interconnected._
- **Should `Case API & Serialization` be split into smaller, more focused modules?**
  _Cohesion score 0.09915966386554621 - nodes in this community are weakly interconnected._
- **Should `Ingestion UI & Form Controls` be split into smaller, more focused modules?**
  _Cohesion score 0.11428571428571428 - nodes in this community are weakly interconnected._