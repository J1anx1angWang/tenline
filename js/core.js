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

  const BOARD_SIZES = Object.freeze([
    Object.freeze({ rows: 14, cols: 8 }),
    Object.freeze({ rows: 15, cols: 9 }),
    Object.freeze({ rows: 16, cols: 10 })
  ]);
  const INITIAL_SKILLS = Object.freeze({ hint: 3, shuffle: 1, singleClear: 1 });

  function cloneSkills(skills) {
    return {
      hint: skills.hint,
      shuffle: skills.shuffle,
      singleClear: skills.singleClear
    };
  }

  function createGame({ mode, rows, cols, seed, board }) {
    if (!['arcade', 'puzzle'].includes(mode)) throw new TypeError('Invalid mode');
    const generated = board
      ? { board: board.slice(), seed: seed >>> 0 }
      : generateBoard({ rows, cols, seed });
    return {
      mode,
      rows,
      cols,
      seed: generated.seed,
      initialBoard: generated.board.slice(),
      board: generated.board.slice(),
      status: 'running',
      score: 0,
      moves: 0,
      clearedCount: 0,
      remainingMs: mode === 'arcade' ? 120000 : null,
      skills: cloneSkills(INITIAL_SKILLS),
      history: [],
      future: []
    };
  }

  function snapshot(state) {
    return {
      board: state.board.slice(),
      status: state.status,
      score: state.score,
      moves: state.moves,
      clearedCount: state.clearedCount,
      remainingMs: state.remainingMs,
      skills: cloneSkills(state.skills)
    };
  }

  function restore(state, saved) {
    return {
      ...state,
      ...saved,
      board: saved.board.slice(),
      skills: cloneSkills(saved.skills)
    };
  }

  function terminalStatus(board, rows, cols) {
    if (board.every((value) => value === 0)) return 'won';
    if (findLegalMoves(board, rows, cols).length === 0) return 'stuck';
    return 'running';
  }

  function withHistory(state, changed) {
    if (state.mode !== 'puzzle') return { ...changed, history: [], future: [] };
    return {
      ...changed,
      history: [...state.history, snapshot(state)],
      future: []
    };
  }

  function applySelection(state, rect) {
    if (state.status !== 'running' || sumRect(state.board, state.cols, rect) !== 10) {
      return state;
    }
    const result = clearRect(state.board, state.cols, rect);
    const changed = {
      ...state,
      board: result.board,
      score: state.score + (state.mode === 'arcade' ? result.cleared : 0),
      moves: state.moves + 1,
      clearedCount: state.clearedCount + result.cleared,
      status: terminalStatus(result.board, state.rows, state.cols)
    };
    return withHistory(state, changed);
  }

  function pauseGame(state) {
    if (state.mode !== 'arcade' || state.status !== 'running') return state;
    return { ...state, status: 'paused' };
  }

  function resumeGame(state) {
    if (state.mode !== 'arcade' || state.status !== 'paused') return state;
    return { ...state, status: 'running' };
  }

  function tickGame(state, elapsedMs) {
    if (state.mode !== 'arcade' || state.status !== 'running') return state;
    const remainingMs = Math.max(0, state.remainingMs - Math.max(0, elapsedMs));
    return {
      ...state,
      remainingMs,
      status: remainingMs === 0 ? 'timeout' : state.status
    };
  }

  function undo(state) {
    if (state.mode !== 'puzzle' || state.history.length === 0) return state;
    const saved = state.history[state.history.length - 1];
    return {
      ...restore(state, saved),
      history: state.history.slice(0, -1),
      future: [snapshot(state), ...state.future]
    };
  }

  function redo(state) {
    if (state.mode !== 'puzzle' || state.future.length === 0) return state;
    const saved = state.future[0];
    return {
      ...restore(state, saved),
      history: [...state.history, snapshot(state)],
      future: state.future.slice(1)
    };
  }

  function restartPuzzle(state) {
    if (state.mode !== 'puzzle') return state;
    return createGame({
      mode: 'puzzle',
      rows: state.rows,
      cols: state.cols,
      seed: state.seed,
      board: state.initialBoard
    });
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
    generateBoard,
    BOARD_SIZES,
    INITIAL_SKILLS,
    createGame,
    applySelection,
    pauseGame,
    resumeGame,
    tickGame,
    undo,
    redo,
    restartPuzzle
  };
});
