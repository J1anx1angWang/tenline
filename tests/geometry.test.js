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
