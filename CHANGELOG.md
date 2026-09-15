# Changelog

## [1.0.0] - 2026-09-14

### Release

- Promoted PDF Review Notes to its first formal release after the v0.9.0 regression cycle.
- Finalized desktop/mobile review navigation, scroll behavior, contextual shortcut help, local autosave/resume, and Markdown / CSV / standalone HTML report exports.
- Finalized Japanese/English documentation, release screenshots, favicon/app icon, privacy wording, and offline verification guidance.
- Bundled the Japanese PDF.js CMaps required by `UniJIS-UCS2-H` / `Adobe-Japan1-UCS2` so PDFs using non-embedded `HeiseiKakuGo-W5` fonts can render Japanese text without a network fallback.
- Applied the same embedded-CMap path to standalone HTML review reports that include the source PDF.

### Changed

- Updated release metadata and documentation from the release-candidate milestone to v1.0.0.
- Refreshed screenshot assets used by the README.

All notable changes to PDF Review Notes are documented here.

## [0.9.0] - 2026-09-14

- RC polish: simplified shortcut info icon and normalized shortcut key widths.

### Changed
- Restored the circle inside the shortcut info glyph while keeping the button chrome transparent.
- Moved keyboard shortcut hints into a compact info popover.
- Made review submit-state updates robust for IME/input events.
- Made the standalone HTML report review list independently scrollable.
- Moved keyboard/mouse shortcut hints beside their related viewer controls and aligned the wording.
- Fixed the Review Notes pane so the card list scrolls independently instead of being clipped.
- Moved fit/zoom controls into the main viewer toolbar between page navigation and Area Review.
- Removed the rectangle icon from the viewer shortcut hint.
- Made the whole review card clickable while keeping edit/status/delete actions independent.
- Kept review navigation inside the PDF viewport so the top viewer controls no longer get pushed out of view.
- Removed the ambiguous plus icon from the Ctrl + wheel zoom hint; the shortcut is now shown as plain text.
- Froze feature scope for release-candidate regression and documentation cleanup.
- Corrected milestone/version references across README, APP_SPEC, and offline-verification documents.
- Removed an accidental duplicated changelog section accumulated during the v0.8.0 iteration.

### Verified
- Static checks cover CSP/network policy, i18n keys, duplicate DOM IDs, template placeholders, review/export paths, PDF.js fake-worker path, and standalone-report generation hooks.
- Release-candidate review covers desktop/mobile layout contracts, Japanese/English UI, text/area reviews, local persistence, Markdown/CSV/HTML exports, and offline assumptions.

## [0.8.0] - 2026-09-14

### Changed
- Added always-visible viewer hints for Shift + drag Area Review and Ctrl + wheel zoom on desktop.
- Added a mobile-specific hint that points users to the Area Review button instead of showing keyboard-only guidance.
- Simplified autosave status text so internal PDF identifiers are no longer exposed in the normal UI.
- Improved filter accessibility by synchronizing `aria-pressed` with the active status filter.
- Updated Help copy and empty states to make text review and Area Review entry points clearer.

## [0.7.0] - 2026-09-14

### Changed
- Added Ctrl + wheel zoom over the PDF viewer in both the app and standalone HTML reports.
- Added Shift + drag as a temporary Area Review shortcut in the main app.

### Added

- Added standalone HTML review-report export with no external runtime dependency.
- Added optional embedded crops for Area Review selections. The original PDF is embedded by default and can be excluded for a lighter report.
- Added Open / Resolved filtering inside generated HTML reports.

### Changed
- Unified the main app and standalone report viewer controls into separate fit-mode and zoom groups.
- Constrained PDF viewing to a fixed viewport so enlarged pages scroll inside the viewer instead of expanding the app layout.
- Increased zoom-value control width in standalone reports to prevent percentage clipping.
- Refined HTML report viewer controls by separating view mode from zoom controls and preventing percentage clipping.
- Fixed the export dialog crash caused by a missing compression-control reference.
- Made HTML report self-compression automatic, with transparent fallback to normal HTML when compression APIs are unavailable or compression fails.
- Reworked embedded-PDF reports to use the same embedded PDF.js canvas renderer as PDF Review Notes instead of the browser-native PDF viewer.
- Review cards in HTML reports now jump to the corresponding PDF page and highlight the saved review anchor.
- Added the same app favicon to generated HTML reports and their self-extracting wrapper.
- Added gzip self-compression for standalone HTML reports. It now runs automatically on supported browsers and falls back automatically otherwise.

- Reworked the session JSON actions into compact 3-column controls with shorter labels so text does not truncate in narrow review panels.
- HTML review reports now embed the original PDF by default, with an opt-out for lighter reports.
- Expanded the export dialog with HTML Report alongside Markdown and CSV.

## [0.6.0] - 2026-09-14

### Added
- Added a review export dialog with total / open / resolved counts and editable file name.
- Added Markdown export for text and area reviews.
- Added UTF-8 CSV export with a BOM and RFC-style field quoting for spreadsheet compatibility.
- Added localized export labels for Japanese and English UI.

### Changed
- Separated review-result export (Markdown / CSV) from resume/backup session JSON actions.
- Updated documentation and help text for the export milestone.

## [0.5.0] - 2026-09-14

- Fixed review-location rendering on PDF.js builds where `PageViewport.convertToViewportRectangle()` is unavailable.
- Invalid review anchors no longer fail the entire PDF viewer.

### Added
- Added SHA-256-based PDF identification for per-document sessions.
- Added IndexedDB autosave and automatic session restore for the same PDF.
- Added JSON export/import for review sessions.

### Changed
- Fixed PDF.js startup on `file://` by preloading the embedded worker module as the main-thread worker handler instead of creating a top-level module Worker from a Blob URL.
- Fixed SHA-256 calculation occurring after PDF.js transferred the input buffer to its worker.
- Switched embedded PDF.js worker startup to an explicit Blob Worker via `GlobalWorkerOptions.workerPort` for `file://` compatibility.
- Moved the PDF lettering in the app icon slightly up and right to improve spacing.
- Updated in-app copy to reflect persistence/resume support.

## [0.4.0] - 2026-09-14

### Added

- Added **Area Review** so users can drag a rectangle over charts, images, layout regions, and scanned PDFs.
- Added an Area Review mode toggle in the viewer toolbar.
- Added area-based review anchors that stay aligned while zooming and re-rendering.

### Changed

- Updated the empty-state file icon to match the PPTX Diff style more closely.
- Refined the favicon/app icon and centered the PDF lettering.
- Made Area Review mode more visible with a sticky in-view banner and stronger active-state styling.
- Adjusted the favicon/app icon so the PDF lettering no longer overlaps the speech bubble.
- Updated help copy and README content for the Area Review milestone.

## [0.3.0] - 2026-09-14

### Added

- Added a review workflow milestone with review editing, open/resolved status, filtering, and sorting.
- Added summary counts for open and resolved reviews.
- Added clearer file/app icons and aligned the file picker icon with the upload card.

### Changed

- Refined the empty-state file picker card and upload icon to better match Browser Kitty upload UI patterns.
- Improved the app icon so the PDF file mark and speech bubble are visually separated.
- Kept the sharper PDF canvas rendering introduced in the latest v0.2.0 revision.
