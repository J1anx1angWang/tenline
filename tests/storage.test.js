'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Storage = require('../js/storage.js');

function memoryStorage(initial) {
  const values = new Map(initial ? [[Storage.KEY, initial]] : []);
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value)
  };
}

function puzzleState() {
  return {
    mode: 'puzzle',
    rows: 14,
    cols: 8,
    seed: 7,
    initialBoard: Array(112).fill(1),
    board: Array(112).fill(1),
    status: 'running',
    score: 0,
    moves: 0,
    clearedCount: 0,
    remainingMs: null,
    skills: { hint: 3, shuffle: 1, singleClear: 1 },
    history: [],
    future: []
  };
}

test('load returns safe defaults for missing and corrupt data', () => {
  assert.deepEqual(Storage.createStore(memoryStorage()).load(), Storage.DEFAULT_DATA);
  assert.deepEqual(Storage.createStore(memoryStorage('{broken')).load(), Storage.DEFAULT_DATA);
});

test('save and load preserve validated data without sharing references', () => {
  const store = Storage.createStore(memoryStorage());
  const data = {
    settings: { reducedMotion: true },
    highscores: { '14x8': 19 },
    puzzle: puzzleState()
  };
  assert.equal(store.save(data), true);
  const loaded = store.load();
  assert.deepEqual(loaded, data);
  loaded.puzzle.board[0] = 9;
  assert.equal(store.load().puzzle.board[0], 1);
});

test('invalid highscores and malformed puzzle states are discarded', () => {
  const raw = JSON.stringify({
    settings: { reducedMotion: 1 },
    highscores: { '14x8': 12, '99x99': 999, '15x9': -1 },
    puzzle: { mode: 'puzzle', rows: 14, cols: 8, board: [1, 2] }
  });
  assert.deepEqual(Storage.createStore(memoryStorage(raw)).load(), Storage.DEFAULT_DATA);
});

test('storage exceptions fall back without blocking play', () => {
  const broken = {
    getItem() { throw new Error('denied'); },
    setItem() { throw new Error('denied'); }
  };
  const store = Storage.createStore(broken);
  assert.deepEqual(store.load(), Storage.DEFAULT_DATA);
  assert.equal(store.save({ settings: { reducedMotion: false }, highscores: {}, puzzle: null }), false);
});
