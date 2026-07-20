# TENLINE release verification

## v1.0.2 cache-bypassing install repair

Verified on 2026-07-19 in the isolated `fix/sw-precache-reload` worktree. This Task 6 gate was local-only; it did not publish, tag, merge, or perform the retained-profile/browser checks reserved for Task 7.

### Automated checks

- Baseline `npm test` before edits: 32 tests passed, 0 failed.
- RED `node --test tests/sw.test.js tests/release.test.js`: exited 1 with 11 tests passed and 2 expected failures because the worker still opened `tenline-v2`.
- GREEN `node --test tests/sw.test.js tests/release.test.js`: 13 tests passed, 0 failed.
- `npm test`: 33 tests passed, 0 failed.
- `node --check sw.js`: passed.
- `git diff --check`: passed.
- `bash scripts/make-release.sh`: rebuilt the offline ZIP and its integrated `unzip -t` reported no compressed-data errors.
- Packaged-worker inspection found `const CACHE_NAME = 'tenline-v3';` and `cache: 'reload'` in `dist/tenline-offline.zip`.
- Release ZIP: 20,121 bytes; SHA-256 `7bb90a04dc89471c42f512d8fbc639c58335028bbfa10210e7ad0e5771d29ecf`.

## v1.0.1 release verification

Verified on 2026-07-19 in the isolated `feature/mobile-usability-v101` worktree. Browser checks used Google Chrome 139.0.7258.138 with a clean profile against a local HTTP origin.

## Automated checks

- Runtime: Node.js 20.19.6, npm 10.8.2.
- `npm test`: 32 tests passed, 0 failed.
- `node --check`: `js/core.js`, `js/storage.js`, `js/geometry.js`, `js/app.js`, and `sw.js` passed.
- `git diff --check`: passed.
- Runtime scan: no third-party game branding, audio APIs/files, or remote HTTP(S) runtime URLs.
- Release archive: `unzip -t dist/tenline-offline.zip` passed; `js/geometry.js` is present.
- Uncompressed runtime: 56,429 bytes; release ZIP: 20,053 bytes.

## Browser checks

### v1.0.1 mobile usability

Every viewport used puzzle mode with all three board sizes. Widths are CSS pixels. The scroll column records the observed final `scrollY` and maximum vertical scroll after scrolling to the bottom.

| Viewport | Board | Document width | Panel width | Board width × height | Hint / restart height | Scroll |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 320 × 568 | 8 × 14 | 320 | 310 | 288 × 504.75 | 54 / 52 | 209 / 209 |
| 320 × 568 | 9 × 15 | 320 | 310 | 288 × 480.641 | 54 / 52 | 185 / 185 |
| 320 × 568 | 10 × 16 | 320 | 310 | 288 × 461.5 | 54 / 52 | 165 / 165 |
| 375 × 667 | 8 × 14 | 375 | 365 | 343 × 601 | 54 / 52 | 206 / 206 |
| 375 × 667 | 9 × 15 | 375 | 365 | 343 × 572.516 | 54 / 52 | 177 / 177 |
| 375 × 667 | 10 × 16 | 375 | 365 | 343 × 549.5 | 54 / 52 | 154 / 154 |
| 390 × 844 | 8 × 14 | 390 | 380 | 358 × 627.25 | 54 / 52 | 55 / 55 |
| 390 × 844 | 9 × 15 | 390 | 380 | 358 × 597.359 | 54 / 52 | 25 / 25 |
| 390 × 844 | 10 × 16 | 390 | 380 | 358 × 573.5 | 54 / 52 | 1 / 1 |
| 430 × 932 | 8 × 14 | 430 | 420 | 398 × 697.25 | 54 / 52 | 37 / 37 |
| 430 × 932 | 9 × 15 | 430 | 420 | 398 × 664.156 | 54 / 52 | 4 / 4 |
| 430 × 932 | 10 × 16 | 430 | 420 | 398 × 637.5 | 54 / 52 | 0 / 0 |

- All 12 cases had `documentWidth <= viewportWidth`; each panel was 10 pixels narrower than the viewport, and every board had positive width.
- Each case cleared a known legal top-edge move through an emulated touch drag. After a restart, the same move also cleared when its final client coordinate was exactly 10 pixels above the board; geometry mapped it to the intended row-0 edge cell.
- Every inside and overshoot touch changed the move counter from 0 to 1, reduced the remaining-cell count by the expected amount, and left `scrollX` at 0.
- All 11 cases whose content exceeded the viewport scrolled to their exact maximum; the 430 × 932, 10 × 16 case fit without vertical overflow.

### Desktop regression

At 1280 × 900, all boards and controls were inside the viewport, the document had no horizontal overflow, and a CDP mouse drag cleared a known legal move for every size.

| Board | Game panel width × height | Board width × height | Panel bottom | Mouse result |
| --- | ---: | ---: | ---: | --- |
| 8 × 14 | 385 × 881.219 | 349 × 612.25 | 891.219 | 3 cells cleared |
| 9 × 15 | 402 × 880.328 | 366 × 611.359 | 890.328 | 2 cells cleared |
| 10 × 16 | 417 × 879.969 | 381 × 611 | 889.984 | 4 cells cleared |

### Direct-file regression

- A clean browser target opened the absolute `file:///.../tenline/index.html` path with title `十号线 · TENLINE` and a visible menu.
- `window.TenlineCore`, `window.TenlineStorage`, and `window.TenlineGeometry` were available.
- Starting an 8 × 14 puzzle rendered all 112 cells.
- An injected registration observer recorded 0 service-worker registration calls and the resource timeline contained 0 `sw.js` requests.

No browser console errors were recorded during the final mobile, desktop, direct-file, or offline runs.

## PWA/offline check

A clean Chrome profile was used against the local HTTP origin:

1. `navigator.serviceWorker.ready` resolved with an activated worker.
2. A subsequent controlled navigation reported cache `tenline-v2` as the only TENLINE cache, with all 12 runtime assets.
3. Network conditions were changed to fully offline and the page was reloaded.
4. The reloaded document retained the exact TENLINE title, menu and game DOM, `TenlineCore`, `TenlineStorage`, and `TenlineGeometry`; the page remained service-worker-controlled and logged no console errors.

This verifies the intended “open once online, then play offline” flow for release v1.0.1.

## Public deployment note

The v1.0.1 gate above validates the local release origin and generated offline ZIP. Publishing and rechecking the hosted GitHub Pages deployment are separate release operations and were not performed by this task.

## Remaining platform note

The build uses standard responsive HTML, Pointer Events, Web App Manifest, and service-worker APIs. Physical iPhone/iOS Safari hardware was not available in this environment, so the Add to Home Screen flow is documented in `README.md` but was not hardware-tested here.
