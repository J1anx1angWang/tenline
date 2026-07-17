(() => {
  'use strict';

  const Core = window.TenlineCore;
  const Storage = window.TenlineStorage;

  let storageLike = null;
  try {
    storageLike = window.localStorage;
  } catch (error) {
    storageLike = null;
  }

  const store = Storage.createStore(storageLike);
  const saved = store.load();
  const data = {
    settings: { ...saved.settings },
    highscores: { ...saved.highscores },
    puzzle: saved.puzzle
  };

  let game = null;
  let drag = null;
  let singleTargeting = false;
  let resolving = false;
  let hintTimer = 0;
  let messageTimer = 0;
  let lastFrame = performance.now();

  const byId = (id) => document.getElementById(id);
  const ui = {
    menuView: byId('menu-view'),
    gameView: byId('game-view'),
    mode: byId('mode'),
    size: byId('size'),
    start: byId('start'),
    resumePuzzle: byId('resume-puzzle'),
    reducedMotion: byId('reduced-motion'),
    backMenu: byId('back-menu'),
    modeLabel: byId('mode-label'),
    sizeLabel: byId('size-label'),
    arcadeStatus: byId('arcade-status'),
    puzzleStatus: byId('puzzle-status'),
    timer: byId('timer'),
    score: byId('score'),
    highscore: byId('highscore'),
    moves: byId('moves'),
    cleared: byId('cleared'),
    remaining: byId('remaining'),
    board: byId('board'),
    selection: byId('selection'),
    hintOutline: byId('hint-outline'),
    hint: byId('skill-hint'),
    shuffle: byId('skill-shuffle'),
    single: byId('skill-single'),
    hintCount: byId('hint-count'),
    shuffleCount: byId('shuffle-count'),
    singleCount: byId('single-count'),
    undo: byId('undo'),
    redo: byId('redo'),
    pause: byId('pause'),
    restart: byId('restart'),
    message: byId('game-message'),
    pauseDialog: byId('pause-dialog'),
    resume: byId('resume'),
    pauseRestart: byId('pause-restart'),
    pauseMenu: byId('pause-menu'),
    resultDialog: byId('result-dialog'),
    resultTitle: byId('result-title'),
    resultSummary: byId('result-summary'),
    resultUndo: byId('result-undo'),
    resultRestart: byId('result-restart'),
    resultNew: byId('result-new'),
    resultMenu: byId('result-menu')
  };

  function seedNow() {
    const values = new Uint32Array(1);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(values);
      return values[0];
    }
    return Date.now() >>> 0;
  }

  function parseSize(value) {
    const [rows, cols] = value.split('x').map(Number);
    return { rows, cols };
  }

  function sizeKey(state = game) {
    return `${state.rows}x${state.cols}`;
  }

  function formatSize(state = game) {
    return `${state.cols} × ${state.rows}`;
  }

  function closeDialog(dialog) {
    if (dialog && dialog.open) dialog.close();
  }

  function applyMotionSetting() {
    document.body.classList.toggle('reduce-motion', data.settings.reducedMotion);
    ui.reducedMotion.checked = data.settings.reducedMotion;
  }

  function setMessage(text, duration = 1600) {
    window.clearTimeout(messageTimer);
    ui.message.textContent = text;
    if (duration > 0) {
      messageTimer = window.setTimeout(() => {
        ui.message.textContent = '';
      }, duration);
    }
  }

  function persist() {
    if (game && game.mode === 'puzzle') data.puzzle = game;
    data.settings.reducedMotion = ui.reducedMotion.checked;
    store.save(data);
    ui.resumePuzzle.hidden = !data.puzzle;
  }

  function startGame({ mode, rows, cols, seed, board, state }) {
    game = state || Core.createGame({ mode, rows, cols, seed, board });
    drag = null;
    resolving = false;
    singleTargeting = false;
    window.clearTimeout(hintTimer);
    closeDialog(ui.pauseDialog);
    closeDialog(ui.resultDialog);
    ui.menuView.hidden = true;
    ui.gameView.hidden = false;
    ui.message.textContent = '';
    lastFrame = performance.now();
    render();
    persist();
  }

  function startFromMenu() {
    const { rows, cols } = parseSize(ui.size.value);
    startGame({ mode: ui.mode.value, rows, cols, seed: seedNow() });
  }

  function resumeSavedPuzzle() {
    if (!data.puzzle) return;
    startGame({ state: data.puzzle });
  }

  function backToMenu() {
    persist();
    closeDialog(ui.pauseDialog);
    closeDialog(ui.resultDialog);
    cancelSelection();
    game = null;
    singleTargeting = false;
    ui.gameView.hidden = true;
    ui.menuView.hidden = false;
  }

  function renderBoard() {
    const fragment = document.createDocumentFragment();
    ui.board.style.setProperty('--cols', game.cols);
    ui.board.setAttribute('aria-rowcount', String(game.rows));
    ui.board.setAttribute('aria-colcount', String(game.cols));
    for (let row = 0; row < game.rows; row += 1) {
      for (let col = 0; col < game.cols; col += 1) {
        const value = game.board[Core.indexOf(row, col, game.cols)];
        const cell = document.createElement('div');
        cell.className = value === 0 ? 'cell empty' : 'cell';
        cell.dataset.row = String(row);
        cell.dataset.col = String(col);
        cell.setAttribute('role', 'gridcell');
        cell.setAttribute('aria-label', value === 0 ? '空格' : String(value));
        cell.textContent = value === 0 ? '' : String(value);
        fragment.appendChild(cell);
      }
    }
    ui.board.replaceChildren(fragment);
  }

  function renderStatus() {
    if (!game) return;
    const arcade = game.mode === 'arcade';
    ui.arcadeStatus.hidden = !arcade;
    ui.puzzleStatus.hidden = arcade;
    ui.modeLabel.textContent = arcade ? '120 秒挑战' : '不限时解谜';
    ui.sizeLabel.textContent = formatSize();
    if (arcade) {
      ui.timer.textContent = (game.remainingMs / 1000).toFixed(1);
      ui.score.textContent = String(game.score);
      ui.highscore.textContent = String(data.highscores[sizeKey()] || 0);
    } else {
      ui.moves.textContent = String(game.moves);
      ui.cleared.textContent = String(game.clearedCount);
      ui.remaining.textContent = String(game.board.filter((value) => value !== 0).length);
    }
  }

  function renderControls() {
    const running = game.status === 'running';
    const puzzle = game.mode === 'puzzle';
    ui.hintCount.textContent = String(game.skills.hint);
    ui.shuffleCount.textContent = String(game.skills.shuffle);
    ui.singleCount.textContent = String(game.skills.singleClear);
    ui.hint.disabled = !running || game.skills.hint <= 0;
    ui.shuffle.disabled = !running || game.skills.shuffle <= 0;
    ui.single.disabled = !running || game.skills.singleClear <= 0;
    ui.single.classList.toggle('selected', singleTargeting);
    ui.single.setAttribute('aria-pressed', String(singleTargeting));
    ui.undo.hidden = !puzzle;
    ui.redo.hidden = !puzzle;
    ui.undo.disabled = !puzzle || game.history.length === 0;
    ui.redo.disabled = !puzzle || game.future.length === 0;
    ui.pause.hidden = !puzzle ? false : true;
    ui.pause.disabled = !puzzle && !['running', 'paused'].includes(game.status);
    ui.pause.textContent = game.status === 'paused' ? '▶' : 'Ⅱ';
    ui.pause.setAttribute('aria-label', game.status === 'paused' ? '继续游戏' : '暂停游戏');
  }

  function render() {
    if (!game) return;
    renderBoard();
    renderStatus();
    renderControls();
  }

  function cellFromTarget(target) {
    if (!(target instanceof Element)) return null;
    const cell = target.closest('.cell');
    if (!cell || !ui.board.contains(cell)) return null;
    return {
      row: Number(cell.dataset.row),
      col: Number(cell.dataset.col),
      cell
    };
  }

  function positionOutline(outline, rect) {
    const first = ui.board.querySelector(
      `[data-row="${rect.top}"][data-col="${rect.left}"]`
    );
    const last = ui.board.querySelector(
      `[data-row="${rect.bottom}"][data-col="${rect.right}"]`
    );
    if (!first || !last) return;
    const host = ui.board.parentElement.getBoundingClientRect();
    const start = first.getBoundingClientRect();
    const end = last.getBoundingClientRect();
    outline.style.left = `${start.left - host.left}px`;
    outline.style.top = `${start.top - host.top}px`;
    outline.style.width = `${end.right - start.left}px`;
    outline.style.height = `${end.bottom - start.top}px`;
    outline.classList.add('active');
  }

  function renderSelection() {
    if (!drag) return;
    positionOutline(ui.selection, Core.normalizeRect(drag.start, drag.end));
  }

  function cancelSelection() {
    drag = null;
    ui.selection.classList.remove('active');
  }

  function flashInvalid(message = '没有消除：请重新计算。') {
    ui.board.classList.remove('invalid');
    void ui.board.offsetWidth;
    ui.board.classList.add('invalid');
    window.setTimeout(() => ui.board.classList.remove('invalid'), 140);
    setMessage(message);
  }

  function cellElementsInRect(rect) {
    const cells = [];
    for (let row = rect.top; row <= rect.bottom; row += 1) {
      for (let col = rect.left; col <= rect.right; col += 1) {
        const cell = ui.board.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        if (cell && !cell.classList.contains('empty')) cells.push(cell);
      }
    }
    return cells;
  }

  function isTerminal(state = game) {
    return ['won', 'stuck', 'timeout'].includes(state.status);
  }

  function commitSelection(rect) {
    const next = Core.applySelection(game, rect);
    if (next === game) {
      flashInvalid();
      return;
    }
    const cells = cellElementsInRect(rect);
    const delay = data.settings.reducedMotion ? 0 : 150;
    resolving = true;
    cells.forEach((cell) => cell.classList.add('clearing'));
    window.setTimeout(() => {
      game = next;
      resolving = false;
      render();
      persist();
      if (isTerminal()) finish();
    }, delay);
  }

  function beginSelection(event) {
    if (!game || game.status !== 'running' || resolving) return;
    const point = cellFromTarget(event.target);
    if (!point) return;
    event.preventDefault();
    if (singleTargeting) {
      const next = Core.useSingleClear(game, point.row, point.col);
      if (next === game) {
        flashInvalid('请选择一个尚未消除的数字。');
        return;
      }
      game = next;
      singleTargeting = false;
      render();
      persist();
      if (isTerminal()) finish();
      return;
    }
    ui.board.setPointerCapture(event.pointerId);
    drag = { pointerId: event.pointerId, start: point, end: point };
    renderSelection();
  }

  function updateSelection(event) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const point = element && cellFromTarget(element);
    if (point) {
      drag.end = point;
      renderSelection();
    }
  }

  function endSelection(event) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const rect = Core.normalizeRect(drag.start, drag.end);
    cancelSelection();
    if (ui.board.hasPointerCapture(event.pointerId)) {
      ui.board.releasePointerCapture(event.pointerId);
    }
    commitSelection(rect);
  }

  function activateHint() {
    if (!game) return;
    const result = Core.useHint(game);
    if (!result.move) {
      flashInvalid('当前没有可提示的组合。');
      return;
    }
    game = result.state;
    render();
    persist();
    window.clearTimeout(hintTimer);
    positionOutline(ui.hintOutline, result.move.rect);
    hintTimer = window.setTimeout(() => {
      ui.hintOutline.classList.remove('active');
    }, 1500);
    setMessage('已标出一个可消除矩形。');
  }

  function activateShuffle() {
    if (!game) return;
    const result = Core.useShuffle(game);
    if (!result.applied) {
      flashInvalid('剩余数字暂时无法重排出新组合。');
      return;
    }
    game = result.state;
    render();
    persist();
    setMessage('剩余数字已重新排列。');
  }

  function activateSingle() {
    if (!game || game.status !== 'running' || game.skills.singleClear <= 0) return;
    singleTargeting = !singleTargeting;
    renderControls();
    setMessage(singleTargeting ? '请选择一个要移除的数字。' : '已取消单消。');
  }

  function undoMove() {
    if (!game) return;
    closeDialog(ui.resultDialog);
    const next = Core.undo(game);
    if (next === game) return;
    game = next;
    singleTargeting = false;
    render();
    persist();
  }

  function redoMove() {
    if (!game) return;
    const next = Core.redo(game);
    if (next === game) return;
    game = next;
    singleTargeting = false;
    render();
    persist();
    if (isTerminal()) finish();
  }

  function restartGame() {
    if (!game) return;
    const current = game;
    closeDialog(ui.pauseDialog);
    closeDialog(ui.resultDialog);
    startGame({
      mode: current.mode,
      rows: current.rows,
      cols: current.cols,
      seed: current.seed,
      board: current.initialBoard
    });
  }

  function newGame() {
    if (!game) return;
    const current = game;
    startGame({
      mode: current.mode,
      rows: current.rows,
      cols: current.cols,
      seed: seedNow()
    });
  }

  function openPause() {
    if (!game || game.mode !== 'arcade' || game.status !== 'running') return;
    game = Core.pauseGame(game);
    lastFrame = performance.now();
    renderControls();
    if (!ui.pauseDialog.open) ui.pauseDialog.showModal();
  }

  function resumeGame() {
    if (!game || game.mode !== 'arcade') return;
    game = Core.resumeGame(game);
    closeDialog(ui.pauseDialog);
    lastFrame = performance.now();
    renderControls();
  }

  function finish() {
    if (!game || !isTerminal()) return;
    if (game.mode === 'arcade') {
      const key = sizeKey();
      data.highscores[key] = Math.max(data.highscores[key] || 0, game.score);
    }
    persist();
    renderStatus();
    const titles = {
      won: '全部清空',
      stuck: '没有可用组合',
      timeout: '时间到'
    };
    ui.resultTitle.textContent = titles[game.status];
    ui.resultSummary.textContent = game.mode === 'arcade'
      ? `本局得分 ${game.score}，消除 ${game.clearedCount} 个数字。`
      : `使用 ${game.moves} 步，消除 ${game.clearedCount} 个数字，剩余 ${game.board.filter(Boolean).length} 个。`;
    ui.resultUndo.hidden = game.mode !== 'puzzle' || game.history.length === 0;
    if (!ui.resultDialog.open) ui.resultDialog.showModal();
  }

  function frame(now) {
    if (game && !ui.gameView.hidden && game.mode === 'arcade' && game.status === 'running') {
      game = Core.tickGame(game, now - lastFrame);
      renderStatus();
      if (game.status === 'timeout') finish();
    }
    lastFrame = now;
    window.requestAnimationFrame(frame);
  }

  ui.start.addEventListener('click', startFromMenu);
  ui.resumePuzzle.addEventListener('click', resumeSavedPuzzle);
  ui.backMenu.addEventListener('click', backToMenu);
  ui.hint.addEventListener('click', activateHint);
  ui.shuffle.addEventListener('click', activateShuffle);
  ui.single.addEventListener('click', activateSingle);
  ui.undo.addEventListener('click', undoMove);
  ui.redo.addEventListener('click', redoMove);
  ui.pause.addEventListener('click', () => {
    if (game && game.status === 'paused') resumeGame();
    else openPause();
  });
  ui.restart.addEventListener('click', restartGame);
  ui.resume.addEventListener('click', resumeGame);
  ui.pauseRestart.addEventListener('click', restartGame);
  ui.pauseMenu.addEventListener('click', backToMenu);
  ui.resultUndo.addEventListener('click', undoMove);
  ui.resultRestart.addEventListener('click', restartGame);
  ui.resultNew.addEventListener('click', newGame);
  ui.resultMenu.addEventListener('click', backToMenu);
  ui.reducedMotion.addEventListener('change', () => {
    data.settings.reducedMotion = ui.reducedMotion.checked;
    applyMotionSetting();
    persist();
  });

  ui.board.addEventListener('pointerdown', beginSelection);
  ui.board.addEventListener('pointermove', updateSelection);
  ui.board.addEventListener('pointerup', endSelection);
  ui.board.addEventListener('pointercancel', cancelSelection);
  window.addEventListener('blur', cancelSelection);
  window.addEventListener('resize', cancelSelection);

  ui.pauseDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    resumeGame();
  });
  ui.resultDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game && game.mode === 'arcade' && game.status === 'running') {
      openPause();
    }
    lastFrame = performance.now();
  });

  applyMotionSetting();
  ui.resumePuzzle.hidden = !data.puzzle;
  window.requestAnimationFrame(frame);

  if ((location.protocol === 'http:' || location.protocol === 'https:') &&
      'serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
})();
