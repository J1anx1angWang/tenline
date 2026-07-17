'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('index references only relative local runtime assets', () => {
  const html = read('index.html');
  assert.match(html, /href="\.\/styles\.css"/);
  assert.match(html, /src="\.\/js\/core\.js"/);
  assert.match(html, /src="\.\/js\/storage\.js"/);
  assert.match(html, /src="\.\/js\/app\.js"/);
  assert.doesNotMatch(html, /https?:\/\//);
});

test('release UI has skills but no live-sum or audio controls', () => {
  const html = read('index.html');
  assert.doesNotMatch(html, /current-sum|音效|音乐|audio/i);
  assert.match(html, /id="board"/);
  assert.match(html, /id="skill-hint"/);
  assert.match(html, /id="skill-shuffle"/);
  assert.match(html, /id="skill-single"/);
});

test('UI exposes every controller hook exactly once', () => {
  const html = read('index.html');
  const ids = [
    'menu-view', 'game-view', 'result-dialog', 'mode', 'size', 'start',
    'timer', 'score', 'highscore', 'moves', 'cleared', 'remaining',
    'board', 'selection', 'hint-outline', 'undo', 'redo', 'pause', 'restart'
  ];
  for (const id of ids) {
    assert.equal((html.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1, id);
  }
});

test('browser controller registers pointer, visibility, mode, and skill behavior', () => {
  const source = read('js/app.js');
  assert.match(source, /pointerdown/);
  assert.match(source, /pointermove/);
  assert.match(source, /pointerup/);
  assert.match(source, /pointercancel/);
  assert.match(source, /visibilitychange/);
  assert.match(source, /Core\.useHint/);
  assert.match(source, /Core\.useShuffle/);
  assert.match(source, /Core\.useSingleClear/);
  assert.match(source, /location\.protocol === 'http:'/);
  assert.match(source, /location\.protocol === 'https:'/);
  assert.doesNotMatch(source, /currentSum|AudioContext|new Audio/);
});

test('author styles cannot override the hidden attribute', () => {
  const css = read('styles.css');
  assert.match(css, /\[hidden\]\s*\{[^}]*display:\s*none\s*!important/);
});

test('eight-column mobile boards use the compact-height layout branch', () => {
  const source = read('js/app.js');
  const css = read('styles.css');
  assert.match(source, /gameView\.dataset\.cols\s*=\s*String\(game\.cols\)/);
  assert.match(css, /\.game-panel\[data-cols="8"\]\s+\.board-wrap/);
});

test('desktop panel width is fitted from viewport height and board ratio', () => {
  const source = read('js/app.js');
  assert.match(source, /function fitGamePanel\(\)/);
  assert.match(source, /window\.innerHeight\s*-\s*290/);
  assert.match(source, /maxBoardHeight\s*\*\s*game\.cols\s*\/\s*game\.rows/);
  assert.match(source, /Math\.max\(380,\s*boardWidth\s*\+\s*36\)/);
  assert.match(source, /fitGamePanel\(\);/);
});

test('manifest and service worker use relative subpath-safe assets', () => {
  const manifest = JSON.parse(read('manifest.webmanifest'));
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons.some((icon) => icon.sizes === '192x192'));
  assert.ok(manifest.icons.some((icon) => icon.sizes === '512x512'));
  const worker = read('sw.js');
  for (const asset of [
    './index.html', './styles.css', './js/core.js', './js/storage.js', './js/app.js'
  ]) {
    assert.ok(worker.includes(asset), `missing precache entry ${asset}`);
  }
  assert.doesNotMatch(worker, /https?:\/\//);
});

test('all install icons exist and are non-empty', () => {
  for (const file of [
    'icons/icon.svg',
    'icons/icon-192.png',
    'icons/icon-512.png',
    'icons/apple-touch-icon.png'
  ]) {
    assert.ok(fs.statSync(path.join(root, file)).size > 0, file);
  }
});

test('runtime release is original, silent, local, and lightweight', () => {
  const runtime = [
    'index.html',
    'styles.css',
    'js/core.js',
    'js/storage.js',
    'js/app.js',
    'manifest.webmanifest',
    'sw.js'
  ];
  const text = runtime.map(read).join('\n');
  assert.doesNotMatch(text, /nikke|azx/i);
  assert.doesNotMatch(text, /AudioContext|new Audio|\.mp3|\.ogg|\.wav/i);
  assert.doesNotMatch(text, /https?:\/\//);
  const bytes = runtime.reduce(
    (sum, file) => sum + fs.statSync(path.join(root, file)).size,
    0
  ) + [
    'icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'
  ].reduce(
    (sum, file) => sum + fs.statSync(path.join(root, 'icons', file)).size,
    0
  );
  assert.ok(bytes <= 250 * 1024, `runtime is ${bytes} bytes`);
});

test('release documentation and packaging script are present', () => {
  for (const file of ['README.md', 'LICENSE', 'scripts/make-release.sh']) {
    assert.ok(fs.statSync(path.join(root, file)).size > 0, file);
  }
});
