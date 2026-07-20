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

function createWorker(cacheKeys = []) {
  const listeners = new Map();
  const scope = 'https://example.test/tenline/';
  const state = {
    addedRequests: [],
    deletedCaches: [],
    openedCache: undefined,
    scope
  };
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
      state.openedCache = name;
      return Promise.resolve({
        addAll(requests) {
          state.addedRequests.push(...requests);
          return Promise.resolve();
        }
      });
    },
    keys: () => Promise.resolve(cacheKeys),
    delete(name) {
      state.deletedCaches.push(name);
      return Promise.resolve(true);
    },
    match: () => Promise.resolve(undefined)
  };

  vm.runInNewContext(workerSource, {
    caches, fetch, Promise, Request, Response, self, URL
  }, { filename: 'sw.js' });

  return { listeners, state };
}

async function runEvent(listener) {
  let completion;
  listener({
    waitUntil(promise) {
      completion = promise;
    }
  });
  await completion;
}

async function runInstall() {
  const { listeners, state } = createWorker();
  await runEvent(listeners.get('install'));
  return state;
}

async function runActivate(cacheKeys) {
  const { listeners, state } = createWorker(cacheKeys);
  await runEvent(listeners.get('activate'));
  return state.deletedCaches;
}

test('install precaches every asset with cache-reload requests', async () => {
  const { addedRequests, openedCache, scope } = await runInstall();
  assert.equal(openedCache, 'tenline-v3');
  assert.equal(addedRequests.length, 12);
  assert.ok(addedRequests.every((request) => request instanceof Request));
  assert.ok(addedRequests.every((request) => request.cache === 'reload'));
  const expectedAssets = [
    './', './index.html', './styles.css', './js/core.js',
    './js/storage.js', './js/geometry.js', './js/app.js',
    './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png',
    './icons/icon-512.png', './icons/apple-touch-icon.png'
  ].map((asset) => new URL(asset, scope).href).sort();
  const actualAssets = addedRequests.map((request) => request.url).sort();
  assert.deepEqual(actualAssets, expectedAssets);
  assert.equal(new Set(actualAssets).size, 12);
});

test('activate deletes legacy TENLINE caches but preserves unrelated caches', async () => {
  const deletedCaches = await runActivate([
    'tenline-v1',
    'other-pwa-cache',
    'tenline-v2',
    'tenline-v3'
  ]);
  assert.deepEqual(deletedCaches.sort(), ['tenline-v1', 'tenline-v2']);
});
