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
