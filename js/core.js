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

  function createRng(seed) {
    let value = seed >>> 0;
    return function next() {
      value += 0x6D2B79F5;
      let mixed = value;
      mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
      mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
      return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
    };
  }

  function findLegalMoves(board, rows, cols) {
    const moves = [];
    for (let top = 0; top < rows; top += 1) {
      const columnSums = Array(cols).fill(0);
      for (let bottom = top; bottom < rows; bottom += 1) {
        for (let col = 0; col < cols; col += 1) {
          columnSums[col] += board[indexOf(bottom, col, cols)];
        }
        for (let left = 0; left < cols; left += 1) {
          let total = 0;
          for (let right = left; right < cols; right += 1) {
            total += columnSums[right];
            if (total === 10) {
              const rect = { top, left, bottom, right };
              moves.push({ rect, cleared: countNonZeroRect(board, cols, rect) });
            }
            if (total > 10) break;
          }
        }
      }
    }
    return moves;
  }

  function clearRect(board, cols, rect) {
    const next = board.slice();
    let cleared = 0;
    visitRect(rect, (row, col) => {
      const index = indexOf(row, col, cols);
      if (next[index] !== 0) {
        next[index] = 0;
        cleared += 1;
      }
    });
    return { board: next, cleared };
  }

  function generateBoard({ rows, cols, seed }) {
    let candidateSeed = seed >>> 0;
    for (let attempt = 0; attempt < 256; attempt += 1) {
      const rng = createRng(candidateSeed);
      const board = Array.from({ length: rows * cols }, () => 1 + Math.floor(rng() * 9));
      if (findLegalMoves(board, rows, cols).length > 0) {
        return { board, seed: candidateSeed };
      }
      candidateSeed = (candidateSeed + 1) >>> 0;
    }
    const board = Array.from(
      { length: rows * cols },
      (_, index) => index === 0 ? 4 : index === 1 ? 6 : 9
    );
    return { board, seed: candidateSeed };
  }

  return {
    normalizeRect,
    indexOf,
    visitRect,
    sumRect,
    countNonZeroRect,
    createRng,
    findLegalMoves,
    clearRect,
    generateBoard
  };
});
