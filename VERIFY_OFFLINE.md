# Offline / Local Processing Verification

PDF Review Notes v1.0.0 is designed to keep the selected PDF and review comments on the device.

## Build

On Windows:

```bat
build-standalone.bat
```

The build must verify the `pdfjs-dist` tarball against `dependencies.lock.json`, embed `build/pdf.min.mjs`, `build/pdf.worker.min.mjs`, `cmaps/UniJIS-UCS2-H.bcmap`, and `cmaps/Adobe-Japan1-UCS2.bcmap`, and generate:

- `dist/index.html`
- `dist/index.self-extract.html`

## Runtime checks

1. Open `dist/index.html` with `file://`.
2. Open DevTools Network and clear the log.
3. Select a PDF.
4. Navigate pages and change zoom.
5. Select text, add a review, open it from Review Notes, delete it, and Undo.
6. Hold Shift and drag a rectangular Area Review; also verify the explicit Area Review mode button.
7. Export Markdown, CSV, and standalone HTML. Confirm the HTML report opens locally, previews the embedded PDF with the bundled PDF.js viewer, and review cards jump to the saved page/location.
8. With at least one review present, choose another PDF and confirm that a destructive-action prompt appears; cancel once and verify the current review remains.
9. Confirm no HTTP/HTTPS request is made after the HTML itself is already available locally.
10. Confirm CSP contains `connect-src 'none'`.
11. Confirm the original PDF file is not changed.

## Japanese CMap regression

Use a test PDF that declares a non-embedded `HeiseiKakuGo-W5` CID font with `UniJIS-UCS2-H` encoding. Do not add a private/user document to the repository.

1. Open the PDF in `dist/index.html` with `file://`.
2. Confirm Japanese headings, table labels, and body text are visible rather than only Latin text/numbers/rules.
3. Confirm the Japanese text layer is selectable and can be used for a text review.
4. Export a standalone HTML report with the original PDF included.
5. Open the report locally and confirm the same Japanese text renders in its embedded PDF preview.
6. Keep DevTools Network open and confirm no CMap/font request leaves the document; `connect-src 'none'` remains effective.

## Text-anchor checks

1. Add a review to a multi-line text selection.
2. Switch to another page and back.
3. Change to 150% and then Fit width.
4. Confirm the anchored highlight returns to the same PDF passage.
5. Select the Review Notes item and confirm the page/location is brought into view.

## Smartphone checks

At 360–390 px width:

- no application-level horizontal scrollbar,
- PDF / Reviews bottom bar does not cover useful content,
- selection review-type bar sits above the bottom bar,
- review dialog remains usable with the software keyboard,
- long filenames/comments do not break layout.

## Notes

v1.0.0 review data is autosaved locally in IndexedDB by PDF SHA-256. Session JSON, Markdown, CSV, and standalone HTML reports are generated locally; no export requires network access.
