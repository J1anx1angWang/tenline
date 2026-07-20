# TENLINE v1.0.2 Cache Migration Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure every service-worker precache install fetches current response bodies instead of reusing stale browser HTTP-cache entries, then publish and validate v1.0.2.

**Architecture:** Keep the existing cache-first runtime behavior and change only the install boundary. The worker will resolve each local asset under its registration scope, construct a real `Request` with cache mode `reload`, and pass those requests to Cache Storage under a new `tenline-v3` namespace; a Node VM harness will regression-test the install event itself.

**Tech Stack:** HTML5, vanilla JavaScript, Service Worker and Cache APIs, Node.js built-in test runner/VM, Bash release packaging, GitHub Pages.

## Global Constraints

- Existing users must upgrade without unregistering the worker or manually clearing browser/site data.
- Every one of the 12 precached assets must be requested with `cache: 'reload'` during worker installation.
- Advance the offline cache namespace to `tenline-v3` and the package/release version to `1.0.2`.
- Preserve relative, subpath-safe runtime assets and GitHub Pages compatibility.
- Preserve all game rules, visuals, touch behavior, direct-file behavior, and the dependency-free runtime.
- Keep the release silent, local-only, and free of third-party game branding.
- The public commit author must remain `b1gSaki <b1gSaki@users.noreply.github.com>`.

---

## File responsibility map

- Create `tests/sw.test.js`: execute the real worker script in a service-worker-shaped VM harness and verify install requests bypass the HTTP cache.
- Modify `sw.js`: construct scope-resolved `Request` objects with cache mode `reload` and use cache namespace `tenline-v3`.
- Modify `tests/release.test.js`: enforce the new cache namespace and package version.
- Modify `package.json`: identify the patch release as `1.0.2`.
- Modify `VERIFICATION.md`: record v1.0.2 automated, migration, hosted, offline, and artifact evidence only after those checks run.
- Regenerate `dist/tenline-offline.zip`: package the repaired worker and unchanged local game assets.

---

### Task 6: Cache-bypassing service-worker install

**Files:**
- Create: `tests/sw.test.js`
- Modify: `sw.js:3,18-23`
- Modify: `tests/release.test.js:82-94`
- Modify: `package.json:3`
- Modify before publication: `VERIFICATION.md`
- Regenerate: `dist/tenline-offline.zip`

**Interfaces:**
- Consumes: `ASSETS`, `self.registration.scope`, the standard `Request` constructor, and the existing `install` event.
- Produces: an array of 12 scope-resolved `Request` objects whose `cache` property is exactly `reload`, stored under `tenline-v3`.

- [ ] **Step 1: Write the failing service-worker behavior test**

Create `tests/sw.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const workerSource = fs.readFileSync(
  path.resolve(__dirname, '..', 'sw.js'),
  'utf8'
);

async function runInstall() {
  const listeners = new Map();
  const addedRequests = [];
  let openedCache;
  const scope = 'https://example.test/tenline/';
  const self = {
    registration: { scope },
    location: { origin: 'https://example.test' },
    clients: { claim: () => Promise.resolve() },
    skipWaiting: () => Promise.resolve(),
    addEventListener(type, listener) {
      listeners.set(type, listener);
    }
  };
  const caches = {
    open(name) {
      openedCache = name;
      return Promise.resolve({
        addAll(requests) {
          addedRequests.push(...requests);
          return Promise.resolve();
        }
      });
    },
    keys: () => Promise.resolve([]),
    delete: () => Promise.resolve(true),
    match: () => Promise.resolve(undefined)
  };

  vm.runInNewContext(workerSource, {
    caches, fetch, Promise, Request, Response, self, URL
  }, { filename: 'sw.js' });

  let completion;
  listeners.get('install')({
    waitUntil(promise) {
      completion = promise;
    }
  });
  await completion;
  return { addedRequests, openedCache, scope };
}

test('install precaches every asset with cache-reload requests', async () => {
  const { addedRequests, openedCache, scope } = await runInstall();
  assert.equal(openedCache, 'tenline-v3');
  assert.equal(addedRequests.length, 12);
  assert.ok(addedRequests.every((request) => request instanceof Request));
  assert.ok(addedRequests.every((request) => request.cache === 'reload'));
  assert.ok(addedRequests.every((request) => request.url.startsWith(scope)));
});
```

Update the runtime integration assertion in `tests/release.test.js` to require `tenline-v3` and package version `1.0.2`.

- [ ] **Step 2: Run the tests to verify RED**

Run:

```bash
node --test tests/sw.test.js tests/release.test.js
```

Expected: FAIL because the worker opens `tenline-v2`, supplies strings rather than `Request` objects, and the package version is `1.0.1`.

- [ ] **Step 3: Implement the minimal worker and version change**

Change the worker cache constant and install path to the equivalent of:

```js
const CACHE_NAME = 'tenline-v3';

function freshAssetRequest(asset) {
  return new Request(new URL(asset, self.registration.scope), {
    cache: 'reload'
  });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS.map(freshAssetRequest)))
      .then(() => self.skipWaiting())
  );
});
```

Set `package.json` version to `1.0.2`. Do not modify fetch handling or game code.

- [ ] **Step 4: Verify GREEN and rebuild the release**

Run:

```bash
node --test tests/sw.test.js tests/release.test.js
npm test
node --check sw.js
git diff --check
bash scripts/make-release.sh
unzip -p dist/tenline-offline.zip sw.js | grep "tenline-v3"
```

Expected: all 33 tests pass, syntax/diff checks pass, archive integrity passes, and the packaged worker contains `tenline-v3` plus `cache: 'reload'`.

- [ ] **Step 5: Update local verification evidence and commit**

Record only commands actually run and their observed results in `VERIFICATION.md`, then commit:

```bash
git add tests/sw.test.js tests/release.test.js sw.js package.json VERIFICATION.md dist/tenline-offline.zip docs/superpowers/plans/2026-07-19-tenline-v102-cache-migration.md
git commit -m "fix: bypass stale cache during offline upgrade"
```

---

### Task 7: Retained-profile validation and v1.0.2 publication

**Files:**
- Modify: `VERIFICATION.md`
- Regenerate if source changed: `dist/tenline-offline.zip`
- Create ignored deployment evidence: `.superpowers/sdd/task-7-report.md`

**Interfaces:**
- Consumes: old release commit `3076b095318bd46398f0dc9867c5dccef508b28d`, the Task 6 commit, a single persistent Chrome profile, GitHub Pages, and GitHub Releases.
- Produces: evidence that a cached old profile adopts coherent `tenline-v3` assets normally, and public tag/release `v1.0.2` points to the same anonymous commit as `main`.

- [ ] **Step 1: Reproduce the migration locally on one origin before publication**

Serve the old commit with long-lived HTTP cache headers, visit/install it in a clean retained Chrome profile, then restart the same origin with the patched tree. Call `registration.update()` normally without clearing Cache Storage or the HTTP cache.

Expected before update: only `tenline-v1`, 11 cached assets, and no `TenlineGeometry`. Expected after update: only `tenline-v3`, 12 cached assets, current root/index/app/CSS bodies, available `TenlineGeometry`, and zero console errors.

- [ ] **Step 2: Run the final local release gate**

Run:

```bash
npm test
node --check js/core.js
node --check js/storage.js
node --check js/geometry.js
node --check js/app.js
node --check sw.js
git diff --check
bash scripts/make-release.sh
unzip -t dist/tenline-offline.zip
git status --short
```

Expected: 33 tests pass; all syntax/archive checks pass; tracked release files are clean after committing evidence.

- [ ] **Step 3: Publish the patch without rewriting public history**

Fast-forward the reviewed patch to `main`, push `main`, and create non-draft/non-prerelease tag `v1.0.2` with `dist/tenline-offline.zip`. Do not overwrite existing `v1.0.1`.

- [ ] **Step 4: Verify the hosted same-profile upgrade and strict offline reload**

Before the push, retain a clean profile controlled by public `tenline-v2`. After Pages reports the new build, call `registration.update()` normally in that same profile. Verify only `tenline-v3` remains, all 12 cached assets are coherent, touch drag still clears a sum-10 rectangle, and a page-plus-worker forced-network-offline reload succeeds without console errors.

- [ ] **Step 5: Verify the public artifact, identity, and synchronization**

Download the public v1.0.2 ZIP, run `unzip -t`, compare its SHA-256 with the local artifact, and verify local HEAD, remote `main`, and tag `v1.0.2` are identical. Verify the public commit author is `b1gSaki <b1gSaki@users.noreply.github.com>`, record hosted evidence in the ignored Task 7 report without creating a post-tag source commit, stop the retained browser, and remove temporary GitHub CLI credentials.
