# TENLINE Mobile Usability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the phone game board use the available viewport width, enlarge touch controls, and keep rectangle drags stable when a finger slightly overshoots a board edge.

**Architecture:** Keep game rules and desktop sizing unchanged. Add one dependency-free geometry module for pointer-to-cell mapping, apply mobile-only layout overrides below 431 pixels, and integrate the new asset through the existing static HTML/PWA pipeline.

**Tech Stack:** HTML5, CSS Grid, vanilla JavaScript, Pointer Events, Node.js built-in test runner, service worker, GitHub Pages.

## Global Constraints

- At viewport widths up to 430 pixels, the game panel uses the full safe-area-adjusted app width and may scroll vertically.
- Mobile skill, utility, back, and pause controls have a minimum height of 52 pixels.
- Pointer coordinates up to 16 pixels outside the board clamp to the nearest edge cell; farther coordinates return `null`.
- Do not add horizontal board scrolling, pinch zoom, a full-screen toggle, live sums, answer colors, audio, or rule changes.
- Preserve all desktop behavior and keep the project dependency-free.
- Upgrade the offline cache to `tenline-v2` and the release version to `v1.0.1`.

---

## File responsibility map

- Create `js/geometry.js`: pure client-coordinate to grid-point mapping, usable from Node tests and the browser.
- Create `tests/geometry.test.js`: unit coverage for centers, edges, tolerance, and invalid geometry.
- Modify `styles.css`: mobile-only full-width/top-aligned panel, larger number text, and 52-pixel controls.
- Modify `js/app.js`: consume `TenlineGeometry` during pointer movement; remove the obsolete column dataset used only by the shrink rule.
- Modify `index.html`: load `js/geometry.js` before `js/app.js`.
- Modify `sw.js`: cache the new module under `tenline-v2`.
- Modify `package.json`: identify the packaged release as `1.0.1`.
- Modify `tests/release.test.js`: assert the mobile layout and runtime/PWA integration contract.
- Modify `VERIFICATION.md`: record the new automated, viewport, touch, and public-offline evidence.
- Regenerate `dist/tenline-offline.zip`: include the updated runtime and geometry module.

---

### Task 1: Pure grid geometry module

**Files:**
- Create: `js/geometry.js`
- Create: `tests/geometry.test.js`

**Interfaces:**
- Consumes: `{ clientX, clientY, bounds, rows, cols, tolerance }`, where `bounds` has finite `left`, `top`, `width`, and `height` numbers.
- Produces: `pointFromClient(options): { row: number, col: number } | null` through both `module.exports` and `globalThis.TenlineGeometry`.

- [ ] **Step 1: Write the failing geometry tests**

Create `tests/geometry.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Geometry = require('../js/geometry.js');

const bounds = { left: 10, top: 20, width: 320, height: 560 };

test('pointFromClient maps cell centers to row and column', () => {
  assert.deepEqual(Geometry.pointFromClient({
    clientX: 30, clientY: 40, bounds, rows: 14, cols: 8
  }), { row: 0, col: 0 });
  assert.deepEqual(Geometry.pointFromClient({
    clientX: 310, clientY: 560, bounds, rows: 14, cols: 8
  }), { row: 13, col: 7 });
});

test('pointFromClient clamps all four edges within tolerance', () => {
  const base = { bounds, rows: 14, cols: 8, tolerance: 16 };
  assert.deepEqual(Geometry.pointFromClient({ ...base, clientX: -6, clientY: 300 }), { row: 7, col: 0 });
  assert.deepEqual(Geometry.pointFromClient({ ...base, clientX: 346, clientY: 300 }), { row: 7, col: 7 });
  assert.deepEqual(Geometry.pointFromClient({ ...base, clientX: 170, clientY: 4 }), { row: 0, col: 4 });
  assert.deepEqual(Geometry.pointFromClient({ ...base, clientX: 170, clientY: 596 }), { row: 13, col: 4 });
});

test('pointFromClient rejects coordinates beyond tolerance', () => {
  const base = { bounds, rows: 14, cols: 8, tolerance: 16 };
  assert.equal(Geometry.pointFromClient({ ...base, clientX: -7, clientY: 300 }), null);
  assert.equal(Geometry.pointFromClient({ ...base, clientX: 347, clientY: 300 }), null);
  assert.equal(Geometry.pointFromClient({ ...base, clientX: 170, clientY: 3 }), null);
  assert.equal(Geometry.pointFromClient({ ...base, clientX: 170, clientY: 597 }), null);
});

test('pointFromClient rejects unusable board geometry', () => {
  assert.equal(Geometry.pointFromClient({
    clientX: 10,
    clientY: 20,
    bounds: { left: 10, top: 20, width: 0, height: 560 },
    rows: 14,
    cols: 8
  }), null);
  assert.equal(Geometry.pointFromClient({
    clientX: 10, clientY: 20, bounds, rows: 0, cols: 8
  }), null);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
node --test tests/geometry.test.js
```

Expected: FAIL with `Cannot find module '../js/geometry.js'`.

- [ ] **Step 3: Implement the minimal pure geometry module**

Create `js/geometry.js`:

```js
(function exposeGeometry(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TenlineGeometry = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  'use strict';

  function pointFromClient({
    clientX, clientY, bounds, rows, cols, tolerance = 16
  }) {
    const values = [clientX, clientY, bounds.left, bounds.top,
      bounds.width, bounds.height, rows, cols, tolerance];
    if (!values.every(Number.isFinite) || bounds.width <= 0 || bounds.height <= 0 ||
        !Number.isInteger(rows) || !Number.isInteger(cols) || rows <= 0 || cols <= 0 ||
        tolerance < 0) return null;

    const right = bounds.left + bounds.width;
    const bottom = bounds.top + bounds.height;
    if (clientX < bounds.left - tolerance || clientX > right + tolerance ||
        clientY < bounds.top - tolerance || clientY > bottom + tolerance) return null;

    const x = Math.min(bounds.width, Math.max(0, clientX - bounds.left));
    const y = Math.min(bounds.height, Math.max(0, clientY - bounds.top));
    const col = Math.min(cols - 1, Math.floor((x / bounds.width) * cols));
    const row = Math.min(rows - 1, Math.floor((y / bounds.height) * rows));
    return { row, col };
  }

  return Object.freeze({ pointFromClient });
});
```

- [ ] **Step 4: Run the focused and complete tests**

Run:

```bash
node --test tests/geometry.test.js
npm test
```

Expected: 4 geometry tests pass; the complete suite reports 31 tests passed and 0 failed.

- [ ] **Step 5: Commit the geometry module**

```bash
git add js/geometry.js tests/geometry.test.js
git commit -m "feat: add tolerant mobile grid geometry"
```

---

### Task 2: Full-width mobile layout and touch targets

**Files:**
- Modify: `styles.css:254-264, 451-495`
- Modify: `js/app.js:161-166`
- Modify: `tests/release.test.js:60-72`

**Interfaces:**
- Consumes: existing `.app`, `.game-panel`, `.board-wrap`, `.cell`, `.skill-grid`, `.utility-grid`, and `.icon-button` elements.
- Produces: a mobile-only layout contract for viewports up to 430 pixels; no JavaScript layout API.

- [ ] **Step 1: Replace the obsolete shrink-layout test with a failing full-width test**

Replace `eight-column mobile boards use the compact-height layout branch` in `tests/release.test.js` with:

```js
test('mobile game layout fills width and enlarges touch controls', () => {
  const source = read('js/app.js');
  const css = read('styles.css');
  const mobile = css.slice(css.indexOf('@media (max-width: 430px)'));
  assert.match(mobile, /\.game-panel\s*\{[^}]*align-self:\s*start/);
  assert.match(mobile, /\.game-panel\s*\{[^}]*justify-self:\s*stretch/);
  assert.match(mobile, /\.game-panel\s*\{[^}]*width:\s*100%/);
  assert.match(mobile, /\.cell\s*\{[^}]*font-size:\s*clamp\(\.9rem,\s*4\.4vw,\s*1\.15rem\)/);
  assert.match(mobile, /\.skill-grid button,[\s\S]*\.utility-grid button,[\s\S]*\.icon-button\s*\{[^}]*min-height:\s*52px/);
  assert.doesNotMatch(css, /\.game-panel\[data-cols="8"\]/);
  assert.doesNotMatch(source, /gameView\.dataset\.cols/);
});
```

- [ ] **Step 2: Run the release test to verify it fails**

Run:

```bash
npm run test:release
```

Expected: FAIL because the mobile panel has no explicit stretch/width rules and the obsolete 8-column shrink rule still exists.

- [ ] **Step 3: Implement the mobile-only CSS change**

Inside `@media (max-width: 430px)`, change `.game-panel` and related rules to:

```css
.game-panel {
  align-self: start;
  justify-self: stretch;
  width: 100%;
  gap: 5px;
  padding: 5px;
  border-width: 2px;
  box-shadow: 4px 4px 0 #020407b8;
}

.board { gap: 1px; }

.board-wrap {
  width: 100%;
  padding: 2px;
}

.cell {
  font-size: clamp(.9rem, 4.4vw, 1.15rem);
}

.skill-grid button,
.utility-grid button,
.icon-button {
  min-height: 52px;
}
```

Delete the complete `.game-panel[data-cols="8"] .board-wrap` rule. Keep the existing mobile skill layout, hidden skill icon, and compact status padding.

Remove this obsolete line from `renderBoard()` in `js/app.js`:

```js
ui.gameView.dataset.cols = String(game.cols);
```

- [ ] **Step 4: Run the release and complete tests**

Run:

```bash
npm run test:release
npm test
```

Expected: release tests pass; the complete suite reports 31 tests passed and 0 failed.

- [ ] **Step 5: Commit the mobile layout**

```bash
git add styles.css js/app.js tests/release.test.js
git commit -m "fix: expand mobile board and touch controls"
```

---

### Task 3: Runtime geometry integration and cache upgrade

**Files:**
- Modify: `index.html:103-106`
- Modify: `js/app.js:1-7, 318-329`
- Modify: `sw.js:1-16`
- Modify: `package.json:1-5`
- Modify: `tests/release.test.js:8-18, 74-102, 116-130`

**Interfaces:**
- Consumes: `TenlineGeometry.pointFromClient(options)` from Task 1.
- Produces: pointer movement that updates `drag.end` with `{ row, col }`; HTML and PWA asset order that guarantees `TenlineGeometry` exists before `js/app.js` runs.

- [ ] **Step 1: Write failing runtime-integration assertions**

Extend `index references only relative local runtime assets` with:

```js
assert.match(html, /src="\.\/js\/geometry\.js"/);
assert.ok(
  html.indexOf('./js/geometry.js') < html.indexOf('./js/app.js'),
  'geometry must load before app'
);
```

Add this test:

```js
test('pointer geometry and cache v2 are wired into the runtime', () => {
  const source = read('js/app.js');
  const worker = read('sw.js');
  const pkg = JSON.parse(read('package.json'));
  assert.match(source, /const Geometry = window\.TenlineGeometry/);
  assert.match(source, /Geometry\.pointFromClient\(\{/);
  assert.match(source, /bounds:\s*ui\.board\.getBoundingClientRect\(\)/);
  assert.match(worker, /const CACHE_NAME = 'tenline-v2'/);
  assert.ok(worker.includes('./js/geometry.js'));
  assert.equal(pkg.version, '1.0.1');
});
```

Add `'./js/geometry.js'` to the expected precache entries and add `js/geometry.js` to the `runtime` array in the lightweight-release test.

- [ ] **Step 2: Run the release test to verify it fails**

Run:

```bash
npm run test:release
```

Expected: FAIL because the geometry script, app integration, `tenline-v2`, and version `1.0.1` are absent.

- [ ] **Step 3: Load and consume the geometry module**

In `index.html`, load the new module between storage and app:

```html
<script defer src="./js/core.js"></script>
<script defer src="./js/storage.js"></script>
<script defer src="./js/geometry.js"></script>
<script defer src="./js/app.js"></script>
```

At the top of `js/app.js`, add:

```js
const Geometry = window.TenlineGeometry;
```

Replace the body of `updateSelection(event)` with:

```js
if (!drag || drag.pointerId !== event.pointerId) return;
event.preventDefault();
const point = Geometry.pointFromClient({
  clientX: event.clientX,
  clientY: event.clientY,
  bounds: ui.board.getBoundingClientRect(),
  rows: game.rows,
  cols: game.cols,
  tolerance: 16
});
if (point) {
  drag.end = point;
  renderSelection();
}
```

- [ ] **Step 4: Upgrade PWA and package metadata**

In `sw.js`, set `const CACHE_NAME = 'tenline-v2';`, add `'./js/geometry.js'` after the storage asset, and set `package.json` version to `1.0.1`.

- [ ] **Step 5: Run syntax, focused, and complete tests**

Run:

```bash
node --check js/geometry.js
node --check js/app.js
node --check sw.js
npm run test:release
npm test
```

Expected: all syntax checks pass; the complete suite reports 32 tests passed and 0 failed.

- [ ] **Step 6: Commit the runtime integration**

```bash
git add index.html js/app.js sw.js package.json tests/release.test.js
git commit -m "feat: improve mobile drag tolerance and offline update"
```

---

### Task 4: Browser acceptance, release package, and evidence

**Files:**
- Modify: `VERIFICATION.md`
- Modify: `dist/tenline-offline.zip` (generated)

**Interfaces:**
- Consumes: the complete mobile runtime from Tasks 1-3.
- Produces: validated local/PWA artifacts and a written evidence trail for release `v1.0.1`.

- [ ] **Step 1: Run the complete non-browser release gate**

Run:

```bash
npm test
node --check js/core.js
node --check js/storage.js
node --check js/geometry.js
node --check js/app.js
node --check sw.js
git diff --check
```

Expected: 32 tests pass, 0 fail; every syntax and diff check exits 0.

- [ ] **Step 2: Start a local server and clean browser profile**

Run the server from the repository root:

```bash
python3 -m http.server 4173
```

In a second terminal, start Chrome:

```bash
google-chrome --headless=new --no-sandbox --disable-gpu \
  --remote-allow-origins=http://localhost \
  --remote-debugging-port=9230 \
  --user-data-dir=/tmp/tenline-mobile-v101-profile \
  http://127.0.0.1:4173/
```

Expected: Chrome reports a DevTools WebSocket on port 9230 and the page title is `十号线 · TENLINE`.

- [ ] **Step 3: Verify mobile layout and touch behavior through Chrome DevTools Protocol**

For widths `320`, `375`, `390`, and `430`, use heights `568`, `667`, `844`, and `932`. For each viewport and board size, start puzzle mode and evaluate:

```js
({
  viewportWidth: innerWidth,
  documentWidth: document.documentElement.scrollWidth,
  panelWidth: document.getElementById('game-view').getBoundingClientRect().width,
  boardWidth: document.getElementById('board').getBoundingClientRect().width,
  skillHeight: document.getElementById('skill-hint').getBoundingClientRect().height,
  restartHeight: document.getElementById('restart').getBoundingClientRect().height
})
```

Expected for every case: `documentWidth <= viewportWidth`, `panelWidth >= viewportWidth - 12`, positive board width, and both control heights at least 52 pixels. Page scrolling must work when content exceeds viewport height.

Dispatch a touch pointer drag inside the board that selects a known legal move, then repeat with the final client coordinate 10 pixels outside the nearest board edge. Expected: both selections complete, the overshoot resolves to the nearest edge cell, and no horizontal document movement occurs.

- [ ] **Step 4: Verify desktop and direct-file regressions**

At `1280 × 900`, start all board sizes and verify the complete board and controls are visible, mouse dragging clears a legal move, and the document has no horizontal overflow.

Open the absolute `file:///.../tenline/index.html` path in a clean browser target. Expected: the menu loads, a puzzle starts, `window.TenlineGeometry` exists, and no service worker registration is attempted.

- [ ] **Step 5: Verify the local PWA update path**

Wait for `navigator.serviceWorker.ready`, navigate once more, then evaluate:

```js
(async () => {
  const keys = await caches.keys();
  const cache = await caches.open('tenline-v2');
  return {
    keys,
    assets: (await cache.keys()).length,
    controlled: !!navigator.serviceWorker.controller
  };
})()
```

Expected: `tenline-v2` is the only TENLINE cache, it contains 12 assets, and the page is controlled. Emulate a fully offline network and reload. Expected: title, menu, game DOM, core, storage, and geometry namespaces remain available with no console errors.

- [ ] **Step 6: Regenerate and verify the offline ZIP**

Run:

```bash
./scripts/make-release.sh
unzip -t dist/tenline-offline.zip
unzip -l dist/tenline-offline.zip | rg 'js/geometry.js'
```

Expected: ZIP integrity passes and `js/geometry.js` is present.

- [ ] **Step 7: Update the verification record**

In `VERIFICATION.md`, replace the old test count, cache name, asset count, and mobile viewport evidence with observed values. Add a `v1.0.1 mobile usability` subsection recording full-width panels, 52-pixel controls, edge overshoot, desktop regression, direct-file operation, and offline `tenline-v2` reload.

- [ ] **Step 8: Re-run the final local gate and commit**

Run `npm test`, `unzip -t dist/tenline-offline.zip`, `git diff --check`, and `git status --short`. Expected: 32 tests pass, ZIP integrity passes, and only intended verification/package files remain before this commit:

```bash
git add VERIFICATION.md dist/tenline-offline.zip
git commit -m "test: verify mobile usability release"
```

---

### Task 5: Publish Pages and release v1.0.1

**Files:**
- No source-file changes expected.

**Interfaces:**
- Consumes: clean `main`, release ZIP, `tenline-v2`, and existing GitHub repository/Pages configuration.
- Produces: updated public Pages deployment and GitHub Release `v1.0.1`.

- [ ] **Step 1: Verify local history and push `main`**

Run:

```bash
git status --porcelain
git log -1 --format='%an <%ae>'
git push origin main
```

Expected: worktree output is empty, author is `b1gSaki <b1gSaki@users.noreply.github.com>`, and the push succeeds without force.

- [ ] **Step 2: Authenticate GitHub CLI only if release API credentials are absent**

Run `gh auth status --hostname github.com`. If not authenticated, run:

```bash
/tmp/tenline-gh-cli/extracted/usr/bin/gh auth login \
  --hostname github.com --git-protocol ssh --web
```

Select `Skip` when asked to upload an SSH key and complete the one-time browser authorization.

- [ ] **Step 3: Publish the release artifact**

Run:

```bash
/tmp/tenline-gh-cli/extracted/usr/bin/gh release create v1.0.1 \
  dist/tenline-offline.zip \
  --repo J1anx1angWang/tenline \
  --title "TENLINE v1.0.1" \
  --notes "手机端棋盘改为满宽布局，扩大触控按钮，并增强棋盘边缘拖动容错。"
```

Expected: the command returns the public `v1.0.1` release URL.

- [ ] **Step 4: Wait for and verify the public Pages deployment**

Open `https://j1anx1angwang.github.io/tenline/` in a clean Chrome profile. Expected: the public page loads `js/geometry.js`, registers `tenline-v2`, caches 12 assets under `/tenline/`, and passes a fully offline reload with no console errors.

Repeat the 390 × 844 measurement. Expected: panel width is at least 378 pixels, skill and utility buttons are at least 52 pixels high, and a touch drag succeeds.

- [ ] **Step 5: Download the public release and verify remote synchronization**

Run:

```bash
curl -fsSL \
  https://github.com/J1anx1angWang/tenline/releases/download/v1.0.1/tenline-offline.zip \
  -o /tmp/tenline-v1.0.1-public.zip
unzip -t /tmp/tenline-v1.0.1-public.zip
test "$(git rev-parse HEAD)" = "$(git ls-remote origin refs/heads/main | cut -f1)"
```

Expected: downloaded ZIP integrity passes and local `HEAD` equals remote `main`.

- [ ] **Step 6: Remove temporary API credentials**

Run:

```bash
/tmp/tenline-gh-cli/extracted/usr/bin/gh auth logout \
  --hostname github.com --user J1anx1angWang
```

Expected: GitHub CLI confirms logout. SSH Git push access remains available.

---

## Final handoff checklist

- `npm test`: 32 passed, 0 failed.
- Mobile widths 320/375/390/430 and all three board sizes have no horizontal overflow.
- Mobile panel is full width; controls meet the 52-pixel minimum height.
- Touch drags and 10-pixel edge overshoot work; desktop mouse dragging is unchanged.
- `file://`, local PWA, public Pages, and fully offline reload all work.
- `tenline-v2` contains 12 local assets and no external runtime requests.
- Public `v1.0.1` ZIP passes integrity verification.
- Public commit identity remains `b1gSaki` with the privacy email.
