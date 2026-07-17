# TENLINE release verification

Verified on 2026-07-17 in the project workspace.

## Automated checks

- Runtime: Node.js 20.19.6, npm 10.8.2.
- Browser: Google Chrome 139.0.7258.138.
- `npm test`: 27 tests passed, 0 failed.
- `node --check`: `js/core.js`, `js/storage.js`, `js/app.js`, and `sw.js` passed.
- `git diff --check`: passed.
- Runtime scan: no third-party game branding, audio APIs/files, or remote HTTP(S) runtime URLs.
- Release archive: `unzip -t dist/tenline-offline.zip` passed.
- Uncompressed runtime: 54,627 bytes; release ZIP: 19,259 bytes.

## Browser checks

- Direct `file://` launch loads the menu and can start an 8 × 14 game without a web server.
- Chrome mobile viewport 390 × 844:
  - 8 × 14, 9 × 15, and 10 × 16 boards have no horizontal overflow.
  - Mouse and emulated touch rectangle drags clear valid selections.
  - Hint, shuffle, and single-clear charges update correctly.
  - Puzzle progress survives reload and resumes with cleared cells and move history intact.
- Chrome desktop viewport 1280 × 900:
  - The complete board and controls remain visible.
  - Pausing stops the arcade timer; resuming restarts it.
- Drag selection renders a neutral outline only; it exposes no live sum or sum-based color feedback.
- No browser console errors were recorded during the final functional and offline runs.

## PWA/offline check

A clean Chrome profile was used against a local HTTP origin:

1. The first online load installed and activated service worker cache `tenline-v1` with all 11 runtime assets.
2. A controlled navigation confirmed `navigator.serviceWorker.controller` was active.
3. Network conditions were changed to fully offline.
4. Reload completed from the service worker with the TENLINE title, DOM, and game core available.

This verifies the intended "open once online, then play offline" flow.

## Remaining platform note

The build uses standard responsive HTML, Pointer Events, Web App Manifest, and service-worker APIs. Physical iPhone/iOS Safari hardware was not available in this environment, so the Add to Home Screen flow is documented in `README.md` but was not hardware-tested here.
