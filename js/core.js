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

  function compareMoves(first, second) {
    const firstArea = (first.rect.bottom - first.rect.top + 1) *
      (first.rect.right - first.rect.left + 1);
    const secondArea = (second.rect.bottom - second.rect.top + 1) *
      (second.rect.right - second.rect.left + 1);
    return second.cleared - first.cleared ||
      firstArea - secondArea ||
      first.rect.top - second.rect.top ||
      first.rect.left - second.rect.left ||
      first.rect.bottom - second.rect.bottom ||
      first.rect.right - second.rect.right;
  }

  function useHint(state) {
    if (state.status !== 'running' || state.skills.hint <= 0) {
      return { state, move: null };
    }
    const move = findLegalMoves(state.board, state.rows, state.cols)
      .sort(compareMoves)[0] || null;
    if (!move) return { state, move: null };
    const changed = withHistory(state, {
      ...state,
      skills: { ...state.skills, hint: state.skills.hint - 1 }
    });
    return { state: changed, move };
  }

  function shuffled(values, rng) {
    const result = values.slice();
    for (let index = result.length - 1; index > 0; index -= 1) {
      const other = Math.floor(rng() * (index + 1));
      [result[index], result[other]] = [result[other], result[index]];
    }
    return result;
  }

  function boardsEqual(first, second) {
    return first.length === second.length && first.every((value, index) => value === second[index]);
  }

  function useShuffle(state) {
    if (state.status !== 'running' || state.skills.shuffle <= 0) {
      return { state, applied: false };
    }
    const positions = state.board
      .map((value, index) => value === 0 ? -1 : index)
      .filter((index) => index >= 0);
    const values = positions.map((index) => state.board[index]);
    const rng = createRng(
      (state.seed ^ state.moves ^ state.clearedCount ^ 0x9E3779B9) >>> 0
    );
    for (let attempt = 0; attempt < 256; attempt += 1) {
      const candidate = state.board.slice();
      const order = shuffled(values, rng);
      positions.forEach((position, index) => {
        candidate[position] = order[index];
      });
      if (boardsEqual(candidate, state.board)) continue;
      if (findLegalMoves(candidate, state.rows, state.cols).length > 0) {
        const changed = withHistory(state, {
          ...state,
          board: candidate,
          status: 'running',
          skills: { ...state.skills, shuffle: state.skills.shuffle - 1 }
        });
        return { state: changed, applied: true };
      }
    }
    return { state, applied: false };
  }

  function useSingleClear(state, row, col) {
    if (state.status !== 'running' || state.skills.singleClear <= 0) return state;
    if (row < 0 || col < 0 || row >= state.rows || col >= state.cols) return state;
    const index = indexOf(row, col, state.cols);
    if (state.board[index] === 0) return state;
    const board = state.board.slice();
    board[index] = 0;
    const changed = {
      ...state,
      board,
      clearedCount: state.clearedCount + 1,
      skills: { ...state.skills, singleClear: state.skills.singleClear - 1 },
      status: terminalStatus(board, state.rows, state.cols)
    };
    return withHistory(state, changed);
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
    restartPuzzle,
    compareMoves,
    useHint,
    useShuffle,
    useSingleClear
  };
});
