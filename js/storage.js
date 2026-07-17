(function attach(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TenlineStorage = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildStorage() {
  'use strict';

  const KEY = 'tenline:v1';
  const DEFAULT_DATA = Object.freeze({
    settings: Object.freeze({ reducedMotion: false }),
    highscores: Object.freeze({}),
    puzzle: null
  });

  function defaults() {
    return { settings: { reducedMotion: false }, highscores: {}, puzzle: null };
  }

  function validBoard(board, rows, cols) {
    return Array.isArray(board) &&
      board.length === rows * cols &&
      board.every((cell) => Number.isInteger(cell) && cell >= 0 && cell <= 9);
  }

  function validSkills(skills) {
    if (!skills || typeof skills !== 'object') return false;
    const limits = { hint: 3, shuffle: 1, singleClear: 1 };
    return Object.entries(limits).every(([key, limit]) =>
      Number.isInteger(skills[key]) && skills[key] >= 0 && skills[key] <= limit
    );
  }

  function validSnapshot(value, rows, cols) {
    return Boolean(value) &&
      validBoard(value.board, rows, cols) &&
      ['running', 'won', 'stuck'].includes(value.status) &&
      Number.isInteger(value.score) && value.score >= 0 &&
      Number.isInteger(value.moves) && value.moves >= 0 &&
      Number.isInteger(value.clearedCount) &&
      value.clearedCount >= 0 && value.clearedCount <= rows * cols &&
      value.remainingMs === null &&
      validSkills(value.skills);
  }

  function validPuzzle(value) {
    if (value === null) return true;
    if (!value || typeof value !== 'object') return false;
    const size = `${value.rows}x${value.cols}`;
    return value.mode === 'puzzle' &&
      ['14x8', '15x9', '16x10'].includes(size) &&
      Number.isInteger(value.seed) && value.seed >= 0 && value.seed <= 0xFFFFFFFF &&
      validBoard(value.initialBoard, value.rows, value.cols) &&
      validSnapshot(value, value.rows, value.cols) &&
      Array.isArray(value.history) && value.history.length <= 512 &&
      value.history.every((item) => validSnapshot(item, value.rows, value.cols)) &&
      Array.isArray(value.future) && value.future.length <= 512 &&
      value.future.every((item) => validSnapshot(item, value.rows, value.cols));
  }

  function sanitize(value) {
    if (!value || typeof value !== 'object' || !validPuzzle(value.puzzle)) {
      return defaults();
    }
    const highscores = {};
    if (value.highscores && typeof value.highscores === 'object') {
      for (const [key, score] of Object.entries(value.highscores)) {
        if (/^(14x8|15x9|16x10)$/.test(key) && Number.isInteger(score) && score >= 0) {
          highscores[key] = score;
        }
      }
    }
    return {
      settings: {
        reducedMotion: Boolean(value.settings && value.settings.reducedMotion)
      },
      highscores,
      puzzle: value.puzzle ? JSON.parse(JSON.stringify(value.puzzle)) : null
    };
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createStore(storageLike) {
    let fallback = defaults();
    return {
      load() {
        try {
          const raw = storageLike && storageLike.getItem(KEY);
          if (raw) fallback = sanitize(JSON.parse(raw));
        } catch (error) {
          fallback = sanitize(fallback);
        }
        return clone(fallback);
      },
      save(value) {
        fallback = sanitize(value);
        try {
          if (!storageLike) return false;
          storageLike.setItem(KEY, JSON.stringify(fallback));
          return true;
        } catch (error) {
          return false;
        }
      }
    };
  }

  return { KEY, DEFAULT_DATA, sanitize, createStore };
});
