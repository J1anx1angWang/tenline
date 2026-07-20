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
