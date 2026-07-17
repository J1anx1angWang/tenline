'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../js/core.js');

test('normalizeRect accepts drags in any direction', () => {
  assert.deepEqual(
    Core.normalizeRect({ row: 3, col: 4 }, { row: 1, col: 2 }),
    { top: 1, left: 2, bottom: 3, right: 4 }
  );
});

test('sumRect includes zero gaps without moving cells', () => {
  const board = [1, 2, 0, 4, 3, 0, 0, 0, 0];
  const rect = { top: 0, left: 0, bottom: 1, right: 1 };
  assert.equal(Core.sumRect(board, 3, rect), 10);
  assert.equal(Core.countNonZeroRect(board, 3, rect), 4);
  assert.deepEqual(board, [1, 2, 0, 4, 3, 0, 0, 0, 0]);
});

test('findLegalMoves finds one-row, one-column, and larger rectangles', () => {
  const board = [4, 6, 9, 3, 2, 0, 7, 4, 4];
  const keys = Core.findLegalMoves(board, 3, 3).map(({ rect }) =>
    `${rect.top},${rect.left},${rect.bottom},${rect.right}`
  );
  assert.ok(keys.includes('0,0,0,1'));
  assert.ok(keys.includes('1,0,2,0'));
  assert.ok(keys.includes('1,1,2,2'));
});

test('clearRect preserves positions and reports only non-zero cells', () => {
  const result = Core.clearRect(
    [4, 6, 9, 1, 0, 3, 1, 4, 8],
    3,
    { top: 0, left: 0, bottom: 0, right: 1 }
  );
  assert.deepEqual(result.board, [0, 0, 9, 1, 0, 3, 1, 4, 8]);
  assert.equal(result.cleared, 2);
});

test('seeded generation is reproducible and never starts stuck', () => {
  const first = Core.generateBoard({ rows: 14, cols: 8, seed: 123456 });
  const second = Core.generateBoard({ rows: 14, cols: 8, seed: 123456 });
  assert.deepEqual(first, second);
  assert.equal(first.board.length, 112);
  assert.ok(first.board.every((value) => value >= 1 && value <= 9));
  assert.ok(Core.findLegalMoves(first.board, 14, 8).length > 0);
});
