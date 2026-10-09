# APP_SPEC.md — PDF Review Notes

## v1.0.2 — Icon normalization

- Canonical background and matching artwork green: `#16624f`; background x/y radii exactly 25% of their respective dimensions.
- Preserve artwork, padding, app behavior, and synchronized header/favicon/download/loader representations.

## 1. Product identity

- **Name:** PDF Review Notes
- **Version:** 1.0.2
- **Current release:** v1.0.2 — Header consistency
- **Purpose:** Open a local PDF, review selectable text or rectangular regions, manage structured comments, and return to anchored locations without modifying or uploading the original PDF.
- **Primary users:** People reviewing specifications, reports, manuscripts, papers, proposals, manuals, and other PDF documents.
- **Release artifacts:** `dist/index.html` and `dist/index.self-extract.html`.

## 2. Product direction

PDF Review Notes is not a PDF editor. The original PDF remains unchanged while review records are kept separately.

The v1.0 product flow remains:

1. Open a PDF locally.
2. Select text or an area.
3. Add a Change / Question / Check / Good / Note review.
4. Manage Open / Resolved review items.
5. Resume the review locally.
6. Export Markdown, CSV, session JSON, or a standalone HTML review report.

## 3. Current release — v1.0.2

v1.0.0 was the first formal release. v1.0.1 standardizes EN / JA target-language buttons and localized accessible language labels while preserving the existing local-processing badge. It preserves the completed review workflow and focuses on a stable local-first experience across desktop/mobile, Japanese/English, file:// use, session resume, and review exports.

It must:

- Open one `.pdf` through file picker or drag and drop.
- Keep the selected PDF and review text in the browser; no upload or runtime external request.
- Reject non-PDF input using type/extension and `%PDF-` signature checks.
- Reject files larger than 250 MiB and warn above 100 MiB.
- Render the current PDF page with embedded PDF.js.
- Render a selectable PDF.js Text Layer over the canvas.
- Provide previous/next page, page input, zoom, fit width, and fit page controls.
- Let the user select text and choose one of five review types: Change / Question / Check / Good / Note.
- Require a comment before a review is added.
- Store each review in memory with page, exact quote, PDF-space rectangles, type, comment, timestamps, and `open` as the initial status.
- Re-render anchored highlights from PDF coordinates after page/zoom changes.
- Show a review list and navigate from a review item back to its page and anchored location.
- Provide Previous review / Next review controls beside the PDF viewer, using the current status/type filters and Page/Added order without wrapping.
- Let the user delete a review and offer Undo through the canonical template toast.
- Review state is identified by a SHA-256 hash of the PDF, autosaved to IndexedDB, and restored when the same PDF is reopened.
- Review session JSON can be exported/imported for backup and resume.
- Review results can be exported as Markdown, UTF-8 CSV, or standalone HTML after confirming counts and editing the output file name.
- Report exports include all reviews regardless of the review list's filters; filtered navigation does not change export scope.
- HTML reports embed the original PDF by default so the report is usable as a single received file. The report uses the same bundled PDF.js canvas rendering approach as the app, not the browser-native PDF viewer. Review cards navigate to the saved page/anchor. Users may opt out for a lighter report. Area-review crops remain independently optional.
- Generated HTML reports carry the same favicon as the app.
- HTML reports are gzip self-compressed automatically when CompressionStream / DecompressionStream are available; export falls back to normal HTML without user action when unavailable or compression fails.
- Generated HTML reports have no external runtime dependency and provide local Open / Resolved filters.
- HTML report generation captures one immutable set of source PDF, review contents and anchors, language, filename and export options before asynchronous work starts. It must not mix later edits or another PDF into that report.
- While HTML generation is pending, disable all report format buttons and export inputs. Close, Escape, backdrop dismissal, or opening another PDF cancels the pending export; late completions/failures cannot download or change newer UI. Release/cancel owned crop renders and file reads when possible. Localized progress/error feedback remains inside the dialog; failures permit retry.
- Keep the edited basename and options while the same PDF stays open. Opening a new source resets them. Strip known HTML/Markdown/CSV extensions before appending the selected format, sanitize unsafe filename characters, and use a fallback for empty names. This is memory-only, not new persistence.
- Preserve CSV values exactly: seven columns, UTF-8 BOM, CRLF records, and standard quote escaping. Formula-like text is not rewritten; spreadsheet applications may interpret it, so import untrusted review fields as text.
- Invalidate stale async work when the source PDF changes.
- Cancel obsolete render/text-layer tasks during page/source changes.
- Keep the original PDF unchanged.
- Keep `connect-src 'none'` in CSP.
- Work from a built single HTML opened directly through `file://`.
- Provide Japanese and English UI without reload.

## 4. v1.0.0 non-goals

v1.0.0 intentionally does **not** implement:
- OCR.
- PDF annotation embedding or any PDF modification.
- AI review or summarization.
- Cloud sync or collaborative editing.

Those belong to later milestones.

## 5. Input and privacy

- Supported input: one `.pdf` file.
- Hard size limit: 250 MiB.
- Large-file warning threshold: 100 MiB.
- The original PDF is never modified.
- No server upload, login, analytics, telemetry, cloud storage, remote font, CDN, or runtime API request.
- PDF.js main/worker code and the selected Japanese CMap assets are embedded at build time.
- Review records are autosaved in IndexedDB keyed by the local PDF SHA-256 hash.
- Clear saved deletes the current PDF's record and pauses autosave for that open document, including queued autosaves and page-close persistence. Visible reviews remain available for export; opening another PDF or reopening this PDF resumes normal autosave. Pending database writes must reject a stale source generation before creating a transaction.
- Session JSON, Markdown, CSV, and standalone HTML reports are created locally and downloaded directly by the browser.

## 6. Embedded dependency

PDF.js is declared through the template dependency contract:

- Package: `pdfjs-dist`
- Version: `6.2.108`
- License: Apache-2.0
- Embedded assets: `build/pdf.min.mjs`, `build/pdf.worker.min.mjs`, `cmaps/UniJIS-UCS2-H.bcmap`, `cmaps/Adobe-Japan1-UCS2.bcmap`
- Update policy: manual

This milestone deliberately pins the same PDF.js baseline already used by Browser Kitty's existing PDF tooling. Updating PDF.js is a separate dependency-review task rather than part of the Text Review feature change.

v1.0.0 bundles the `UniJIS-UCS2-H` and `Adobe-Japan1-UCS2` CMaps to support common Japanese PDFs whose Adobe-Japan1 fonts are not embedded (for example `HeiseiKakuGo-W5`). Other CMaps, standard-font assets, ICC profiles, and codec WASM are not bundled. PDFs depending on those resources may still have rendering limitations. Runtime fallback to a network resource is not permitted.

## 7. State model

Explicit phases:

- `empty`
- `loading`
- `ready`
- `error`

A new source increments `generation`. Every async continuation checks that generation before changing the UI. Viewer renders also track the current document/page request, including repeated renders of the same page: only the owned request may commit success, show an error, clear loading state, or perform deferred highlight scrolling.

Replacing the source or applying a replacement review session invalidates earlier Undo actions, including retained callbacks. A saved-session database read may apply its record only while its source generation, PDF, session key, and review workspace are still current; a late record cannot overwrite another PDF or a newer imported/restored session. Review navigation state is derived from the current review list, filters, order, and active review id rather than stored in the session schema.

The ready state also contains:

- current page / page count,
- zoom mode,
- current `PDFDocumentProxy`,
- current render task,
- current text-layer task,
- current viewport,
- in-memory review list,
- pending text selection,
- active review id,
- mobile destination (`pdf` / `reviews`).

## 8. Text anchor contract

A text review stores the selected text plus one or more rectangles in **PDF coordinate space**, not screen pixels.

Conceptual record:

```json
{
  "id": "review-...",
  "page": 3,
  "type": "check",
  "status": "open",
  "targetType": "text",
  "quote": "The system stores user data for 30 days.",
  "comment": "Confirm the basis for this retention period.",
  "anchor": {
    "rects": [[x1, y1, x2, y2]]
  },
  "createdAt": "...",
  "updatedAt": "..."
}
```

Selection rectangles are captured from `Range.getClientRects()`, converted with the current PDF.js `PageViewport.convertToPdfPoint()`, and converted back through `convertToViewportPoint()` (with transform fallback) when displaying highlights.

This is required so the anchor survives:

- zoom changes,
- fit-width / fit-page changes,
- desktop/mobile layout differences,
- page re-rendering.

## 9. Review types

Internal IDs are language-neutral:

- `change`
- `question`
- `check`
- `good`
- `note`

Display labels switch between Japanese and English. User-entered comments are never translated.

## 10. Review deletion

Deletion is immediately applied and is reversible through the template Undo toast. Undo restores the review's fields and original list position within the same source/session. Replacing the source or review session clears the obsolete toast action and prevents its callback from restoring an old review into the new workspace. No modal confirmation is used for single-item deletion.

Bulk deletion is not part of v1.0.0.

## 11. Desktop layout

Desktop ready state uses two panes:

- PDF viewer: flexible main area.
- Review Notes: approximately 350 px right pane.

The PDF remains the primary visual area. The review list is secondary and scrolls independently.

Selecting a review:

1. activates the review card,
2. changes to its page if necessary,
3. re-renders the page,
4. emphasizes the anchored highlight,
5. scrolls the highlight into view.

### Filtered review navigation

- Previous review / Next review controls stay next to the viewer, separate from previous/next PDF page controls, with localized labels and a current-position/matching-count marker.
- Use the same filtered list as Review Notes: status and type filters compose, then Page order or Added order applies. Navigation does not mutate filters, review data, timestamps, anchors, or source list order.
- Selecting a matching review follows the existing review-card page/highlight navigation and keeps the mobile PDF destination active.
- Do not wrap: Previous is disabled at the first match and Next at the last. When no matching review is active, show the matching count, disable Previous, and let Next select the first match. With no matches, disable both.
- Recompute the marker and controls after review edits, status changes, deletion/Undo, filters/order changes, session restore/import, and source replacement. If the active review no longer matches, do not silently advance; the next Next action starts at the first match.
- Manual page navigation clears the active review and synchronizes the card, highlight, and navigation state. Normalize the page input to the effective page even when clamping or invalid input leaves the page unchanged; an unchanged page does not need another render.
- Ignore page/review navigation while the add/edit review dialog is open so the captured text/area, comment, and edit draft remain intact.
- Add no global review-navigation shortcuts and leave saved UI preferences and export scope unchanged.

## 12. Smartphone model

v1.0.0 keeps the two-destination mobile model:

- **PDF**
- **Reviews N**

Only one destination is shown at a time under 820 px.

Filtered review navigation remains beside the PDF viewer within the PDF destination.

The text-selection type chooser is fixed above the bottom destination bar so it does not compete with native selection handles or disappear below the viewport.

Dialogs become bottom sheets on narrow screens. Keyboard appearance must not make the Add/Cancel actions unreachable.

## 13. PDF renderer behavior

- Render one current page at a time.
- Avoid rendering every page to Canvas.
- Canvas uses a capped device-pixel ratio for visual sharpness without unbounded memory growth.
- Text Layer is re-created for the current page.
- Fit modes re-render after a debounced viewer resize.
- Source/page changes cancel obsolete canvas/text tasks when possible.
- Late success, failure, and cleanup from an obsolete source/page/render request cannot overwrite the current viewer, its loading state, or its error feedback. A failure owned by the current request still shows a localized error.
- Password-protected PDFs show a localized unsupported message in this milestone.

## 14. Accessibility

- Visible `:focus-visible` treatment.
- Icon-only controls have localized labels/tooltips.
- Status changes use `aria-live`.
- File picker remains available when drag/drop is unavailable.
- Review cards are keyboard activatable.
- Text selection review toolbar has a toolbar role.
- `Esc` clears a text selection and closes native dialogs through their normal cancel behavior.
- Arrow left/right and PageUp/PageDown move between pages when focus is outside interactive controls and dialogs. Global viewer shortcuts ignore input, textarea, button, select, editable content, and other interactive targets, open dialogs, IME composition, and events already handled with `preventDefault()`.
- Desktop viewer exposes shortcut hints for **Shift + drag Area Review** and **Ctrl + wheel zoom**; these shortcuts are not hidden-only interactions.
- Status filters synchronize their visual state with `aria-pressed`.
- Autosave UI describes the user-visible state without exposing internal SHA-256 identifiers.
- Motion respects `prefers-reduced-motion`.

## 15. Browser target

Current stable desktop/mobile Chromium, Firefox, and Safari that satisfy the minimum JavaScript/runtime expectations of the pinned PDF.js build and support the Browser Kitty standalone asset loader.

The app includes small compatibility shims used by Browser Kitty's PDF stack for very new built-in methods required by this PDF.js line.

## 16. Build and release acceptance

- Preserve all htmlapps-template placeholders and canonical app-icon behavior.
- `assets/favicon.svg` remains the source for favicon and app brand icon.
- `dependencies.json` and `dependencies.lock.json` validate.
- The generated HTML embeds PDF.js main/worker assets and the selected Japanese CMaps.
- `connect-src 'none'` remains present.
- No unresolved build placeholder remains.
- Readable and self-extract release files are generated. The default build synchronizes the checked-in `pdf-review-notes.html` download; custom output leaves it alone. Repository checks reject stale root downloads before synchronization, ignoring the build timestamp and proven differences in gzip encoding. Before comparing a deterministic gzip representation, verify canonical Base64, the fixed header (with the allowed OS-byte variation), one complete DEFLATE member, CRC/ISIZE, full decoded bytes/SHA-256, and both manifest/bundle length and identity metadata. Only validated gzip payloads and their stored-byte counts are normalized; other runtime, configuration, asset and metadata differences remain detectable. Self-extract restoration remains byte-exact.
- PDF.js/Worker/CMap loading must work through the embedded asset layer, never CDN.
- Text selection and anchor placement are verified after zoom/page navigation.
- A PDF using non-embedded `HeiseiKakuGo-W5` with `UniJIS-UCS2-H` renders Japanese text in both the app and an embedded-PDF standalone HTML report.
- Deletion + Undo is verified.
- 360–390 px layouts have no application-level horizontal scrolling.
- Japanese and English UI fit.
- README, changelog, third-party notice, and offline verification describe the current release.
- Markdown and CSV exports are verified for text/area reviews, commas/quotes/newlines, Japanese text, and editable output filenames.
- Focused source tests with mocked PDF/DOM boundaries cover filtered review order and endpoints, count/selection updates, modal draft preservation, page-input normalization, source/session-scoped Undo, render request ownership, and shortcut exclusions. Preserve the existing persistence/export regressions, all-review export scope, exact CSV contract, original PDF bytes, dependency versions, and privacy policy.

Source tests, mocked PDF boundaries, builds, artifact parity checks, and Draft PR CI do not establish real-PDF rendering, browser/native keyboard behavior, visual/mobile layout, or direct `file://` behavior. Report those checks separately and do not mark them verified unless actually exercised.

## 17. Planned milestones

- **v0.1.0:** PDF Viewer Foundation.
- **v0.2.0:** Text Review.
- **v0.3.0:** Review Workflow.
- **v0.4.0:** Area Review.
- **v0.5.0:** Persistence / Resume.
- **v0.6.0:** Markdown / CSV Export.
- **v0.7.0:** Standalone HTML Review Report.
- **v0.8.0:** UI / UX Finish.
- **v0.9.0:** Release Candidate / Regression.
- **v1.0.0:** Final documentation, screenshots, compatibility regression, and formal release.
- **v1.0.1:** Consistent bilingual header controls. **Current.**
