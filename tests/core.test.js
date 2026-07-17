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

test('arcade clear scores cells and ends when no move remains', () => {
  const game = Core.createGame({ mode: 'arcade', rows: 1, cols: 3, seed: 1, board: [4, 6, 9] });
  const next = Core.applySelection(game, { top: 0, left: 0, bottom: 0, right: 1 });
  assert.deepEqual(next.board, [0, 0, 9]);
  assert.equal(next.score, 2);
  assert.equal(next.moves, 1);
  assert.equal(next.status, 'stuck');
  assert.equal(next.history.length, 0);
});

test('invalid selection is an identity transition', () => {
  const game = Core.createGame({ mode: 'arcade', rows: 1, cols: 3, seed: 1, board: [4, 5, 9] });
  assert.equal(Core.applySelection(game, { top: 0, left: 0, bottom: 0, right: 1 }), game);
});

test('puzzle undo and redo restore the complete move state', () => {
  const game = Core.createGame({ mode: 'puzzle', rows: 1, cols: 4, seed: 1, board: [4, 6, 3, 7] });
  const moved = Core.applySelection(game, { top: 0, left: 0, bottom: 0, right: 1 });
  const undone = Core.undo(moved);
  assert.deepEqual(undone.board, [4, 6, 3, 7]);
  assert.equal(undone.moves, 0);
  const redone = Core.redo(undone);
  assert.deepEqual(redone.board, [0, 0, 3, 7]);
  assert.equal(redone.moves, 1);
});

test('arcade timer pauses and reaches timeout without drift math', () => {
  const game = Core.createGame({ mode: 'arcade', rows: 1, cols: 2, seed: 1, board: [4, 6] });
  const atOneSecond = Core.tickGame(game, 1000);
  assert.equal(atOneSecond.remainingMs, 119000);
  const paused = Core.pauseGame(atOneSecond);
  assert.equal(Core.tickGame(paused, 5000).remainingMs, 119000);
  assert.equal(Core.tickGame(Core.resumeGame(paused), 120000).status, 'timeout');
});

test('hint prefers most cleared cells and consumes one charge', () => {
  const game = Core.createGame({
    mode: 'puzzle',
    rows: 2,
    cols: 3,
    seed: 1,
    board: [4, 6, 9, 1, 2, 7]
  });
  const result = Core.useHint(game);
  assert.deepEqual(result.move.rect, { top: 1, left: 0, bottom: 1, right: 2 });
  assert.equal(result.state.skills.hint, 2);
  assert.deepEqual(result.state.board, game.board);
});

test('shuffle changes order, preserves values, and only spends on success', () => {
  const game = Core.createGame({
    mode: 'puzzle',
    rows: 2,
    cols: 3,
    seed: 42,
    board: [1, 2, 3, 4, 5, 6]
  });
  const result = Core.useShuffle(game);
  assert.equal(result.applied, true);
  assert.notDeepEqual(result.state.board, game.board);
  assert.deepEqual(result.state.board.filter(Boolean).sort(), [1, 2, 3, 4, 5, 6]);
  assert.equal(result.state.skills.shuffle, 0);
  assert.ok(Core.findLegalMoves(result.state.board, 2, 3).length > 0);
});

test('single clear removes one number, does not score, and is undoable', () => {
  const game = Core.createGame({
    mode: 'puzzle',
    rows: 1,
    cols: 4,
    seed: 1,
    board: [4, 6, 3, 7]
  });
  const changed = Core.useSingleClear(game, 0, 2);
  assert.deepEqual(changed.board, [4, 6, 0, 7]);
  assert.equal(changed.score, 0);
  assert.equal(changed.skills.singleClear, 0);
  assert.deepEqual(Core.undo(changed).board, game.board);
});
