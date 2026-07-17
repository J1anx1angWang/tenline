(function attach(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TenlineCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildCore() {
  'use strict';

  function normalizeRect(start, end) {
    return {
      top: Math.min(start.row, end.row),
      left: Math.min(start.col, end.col),
      bottom: Math.max(start.row, end.row),
      right: Math.max(start.col, end.col)
    };
  }

  function indexOf(row, col, cols) {
    return row * cols + col;
  }

  function visitRect(rect, visitor) {
    for (let row = rect.top; row <= rect.bottom; row += 1) {
      for (let col = rect.left; col <= rect.right; col += 1) {
        visitor(row, col);
      }
    }
  }

  function sumRect(board, cols, rect) {
    let total = 0;
    visitRect(rect, (row, col) => {
      total += board[indexOf(row, col, cols)];
    });
    return total;
  }

  function countNonZeroRect(board, cols, rect) {
    let count = 0;
    visitRect(rect, (row, col) => {
      if (board[indexOf(row, col, cols)] !== 0) count += 1;
    });
    return count;
  }

  return { normalizeRect, indexOf, visitRect, sumRect, countNonZeroRect };
});
