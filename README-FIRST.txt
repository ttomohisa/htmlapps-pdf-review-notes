PDF Review Notes — development entry
====================================

1. Read AGENTS.md first.
2. Read APP_SPEC.md for the current product contract and milestone.
3. Inspect the current implementation before changing code.
4. Keep assets/favicon.svg as the single source for both favicon and the upper-left brand icon.
5. Reuse the canonical components in components/ instead of rebuilding common confirmation, toast, async-state, popover, or mobile-navigation behavior.
6. Add third-party assets only through dependencies.json with exact versions and a synchronized dependencies.lock.json.
7. Do not add runtime CDN/API/analytics/telemetry access. User-selected PDFs must stay in the browser.
8. Do not edit dist/index.html or dist/index.self-extract.html manually. Edit source/config and rebuild.
9. Run build-standalone.bat on Windows and review dist/build-size-report.json.
10. Test both generated HTML files with the network disabled, including direct file:// opening and smartphone help/dialog scrolling.

Current release: v1.0.0 — Formal Release.
Next: post-release maintenance and user-driven improvements.
