(function exposeGeometry(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TenlineGeometry = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  'use strict';

  function pointFromClient({
    clientX, clientY, bounds, rows, cols, tolerance = 16
  }) {
    const values = [clientX, clientY, bounds.left, bounds.top,
      bounds.width, bounds.height, rows, cols, tolerance];
    if (!values.every(Number.isFinite) || bounds.width <= 0 || bounds.height <= 0 ||
        !Number.isInteger(rows) || !Number.isInteger(cols) || rows <= 0 || cols <= 0 ||
        tolerance < 0) return null;

    const right = bounds.left + bounds.width;
    const bottom = bounds.top + bounds.height;
    if (clientX < bounds.left - tolerance || clientX > right + tolerance ||
        clientY < bounds.top - tolerance || clientY > bottom + tolerance) return null;

    const x = Math.min(bounds.width, Math.max(0, clientX - bounds.left));
    const y = Math.min(bounds.height, Math.max(0, clientY - bounds.top));
    const col = Math.min(cols - 1, Math.floor((x / bounds.width) * cols));
    const row = Math.min(rows - 1, Math.floor((y / bounds.height) * rows));
    return { row, col };
  }

  return Object.freeze({ pointFromClient });
});
