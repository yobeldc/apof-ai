# Page spec — `/cases/[id]`

The verification + study surface. Premium, readable, honest about provenance.

## Header
- `nomor_putusan` (mono, H1) + court + tingkat proses + year.
- Right cluster: `SaveCaseButton`, "Add note", `SourceLinkButton` (always),
  PDF button (if `has_pdf`), `DataQualityBadge`.
- Persistent line under header: "Not an official Mahkamah Agung product —
  source: putusan3.mahkamahagung.go.id ↗".

## Tabs (`CaseTabs`)
1. **Overview** — `CaseMetadataGrid`: nomor, court, process level, year,
   klasifikasi, important dates, parties, amar one-liner, source + PDF links,
   save + note actions. The at-a-glance card.
2. **Timeline** — `CaseTimeline`: register → musyawarah → putusan, plus any
   AI-extracted procedural events. Vertical rail with dated nodes.
3. **Parties** — pemohon/termohon, penggugat/tergugat, terdakwa, generic pihak.
   Respects redaction mode.
4. **Judges & Court** — hakim list, panitera, lembaga peradilan, jenis, provinsi.
5. **Amar** — the operative ruling, emphasized, large readable type.
6. **Full Text** — serif reader (72ch, 17px/1.7), section detection (MENIMBANG,
   MENGADILI, AMAR), reading progress, "jump to AMAR".
7. **PDF** — embedded viewer of `local_pdf_path` (cached) else `pdf_url`, with a
   download/open-original link. Empty state if none.
8. **AI Summary** — Indonesian summary + legal issues + outcome + timeline +
   similar cases. **Always** prefixed with the inaccuracy disclaimer. A
   "Regenerate" action; clearly labeled deterministic vs LLM.
9. **Notes** — `NoteEditor`: title, body (markdown-ish), tags. Autosaves.

## States
- **Loading:** header skeleton + tab skeletons.
- **Partial extraction:** missing fields show `—`; a banner "Some fields could
  not be parsed — view source to verify" links to the raw HTML/source.
- **Demo case:** a subtle "Demo" chip so fake data is never mistaken for real.

## Readability
- Full text never exceeds 72ch measure; generous paragraph spacing.
- Raw source is one click away at all times (provenance > convenience).
