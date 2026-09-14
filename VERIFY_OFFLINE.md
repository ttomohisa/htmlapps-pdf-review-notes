# Offline / Local Processing Verification

PDF Review Notes v1.0.0 is designed to keep the selected PDF and review comments on the device.

## Build

On Windows:

```bat
build-standalone.bat
```

The build must verify the `pdfjs-dist` tarball against `dependencies.lock.json`, embed `build/pdf.min.mjs` and `build/pdf.worker.min.mjs`, and generate:

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
