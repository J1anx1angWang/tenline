# TENLINE mobile usability design

Date: 2026-07-17

Status: approved in conversation

## Problem and evidence

The current mobile game panel inherits `justify-self: center` from the desktop layout. A centered grid item with no explicit mobile width shrinks to its intrinsic content width. In the 390 × 844 verification screenshot, the panel uses roughly 290 pixels and an 8-column cell is roughly 32 pixels wide even though substantially more viewport width is available. This makes the board look small and makes drag selection unnecessarily difficult.

## Goals

- Use nearly all available phone width for the board at viewport widths up to 430 pixels.
- Make cells, numbers, and controls materially easier to touch.
- Allow vertical page scrolling when the enlarged layout is taller than the phone.
- Make drag selection tolerate a finger moving slightly beyond a board edge.
- Preserve all game rules, modes, skill limits, visual identity, desktop behavior, and the neutral selection outline.

## Non-goals

- No horizontal board scrolling.
- No pinch zoom or full-screen toggle.
- No live sum, answer colors, audio, or gameplay-rule changes.
- No broad desktop redesign.

## Mobile layout

At viewport widths up to 430 pixels:

- The game panel stretches to 100% of the app's safe-area-adjusted content width instead of shrink-wrapping.
- The panel aligns to the top of the mobile grid so an oversized panel scrolls normally and never overflows above the viewport.
- The special 8-column `width: calc(100% - 6px)` board rule is removed. Every size uses the full panel width.
- Header and status spacing remain compact. Board width takes priority over fitting the entire interface into one screen.
- Cell number text is increased for mobile without overflowing 10-column cells.
- Skill, utility, back, and pause controls have a minimum 52-pixel touch height.

On a 390-pixel viewport, expected cell widths are approximately 44, 39, and 35 pixels for 8-, 9-, and 10-column boards. Exact values may vary slightly with safe-area insets and borders.

The board retains `touch-action: none`, so a drag that starts on the board selects cells instead of scrolling the page. A swipe that starts outside the board scrolls the enlarged page normally.

## Drag hit testing

Add a small pure geometry module, `js/geometry.js`, with one responsibility: map a client coordinate and board bounds to a `{ row, col }` grid point.

- Coordinates inside the board map proportionally to a row and column.
- Coordinates up to 16 pixels outside an edge clamp to the nearest edge cell.
- Coordinates farther outside return `null`; the active drag retains its last valid endpoint.
- Row and column results are always clamped to valid grid indexes.

`js/app.js` uses this helper during pointer movement. Pointer capture, selection normalization, and selection commit behavior remain unchanged. The helper is loaded locally before `js/app.js` and has no network dependency.

## Offline update and packaging

- Add `js/geometry.js` to the HTML and service-worker asset list.
- Increment the service-worker cache name from `tenline-v1` to `tenline-v2` so installed devices receive the new CSS and JavaScript after their next online visit.
- Regenerate `dist/tenline-offline.zip`.
- Publish the change as `v1.0.1` after validation.

## Testing and acceptance

Automated tests must cover:

- coordinate mapping at cell centers;
- all four edge-clamping directions within 16 pixels;
- rejection beyond the tolerance;
- valid row and column bounds at exact edges;
- the mobile full-width/top-aligned rules;
- removal of the old 8-column shrink rule;
- 52-pixel mobile control targets;
- the new geometry script and `tenline-v2` cache asset.

Browser verification must cover 320, 375, 390, and 430-pixel viewport widths and all three board sizes. Acceptance requires:

- no horizontal document overflow;
- the game panel uses the available mobile content width;
- vertical scrolling remains possible outside the board;
- touch drags work within the board and with a slight edge overshoot;
- skill and utility controls remain reachable;
- desktop layout and mouse dragging remain functional;
- direct `file://` play still works;
- the public Pages URL updates to cache `tenline-v2` and reloads offline without console errors.
