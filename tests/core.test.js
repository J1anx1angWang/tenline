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
