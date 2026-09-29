# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Classic Tetris in vanilla JavaScript + HTML5 Canvas + CSS. No dependencies, no `package.json`, no build step, no test suite, no linter. User-facing text (UI strings, README) is in Spanish — keep new UI text in Spanish.

## Running

```bash
open index.html                 # open directly (macOS)
python3 -m http.server 8000     # or serve statically, then visit http://localhost:8000
```

There are no automated tests; verify changes by playing the game in a browser.

## Architecture

Three files: `index.html` (DOM: `#board` canvas, side panel with `#score`/`#lines`/`#level`, `#next-canvas`, and a single `#overlay` reused for both PAUSA and GAME OVER), `style.css`, and `game.js`, which holds all logic as top-level functions sharing module-level mutable state (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, `animId`, …). `init()` resets all of it and is also the restart-button handler.

Key conventions in `game.js`:

- **Cell values double as color indices.** Each piece matrix in `PIECES[type]` is filled with its own `type` number (1–7), and `merge()` copies those values straight into `board`. `COLORS[value]` is then used for rendering, so `PIECES` and `COLORS` indices must stay aligned.
- **Piece object** is `{ type, shape, x, y }`; `shape` is a copy of the `PIECES` matrix and is replaced (not mutated) on rotation via `rotateCW` (transpose + reverse). `tryRotate` applies simple horizontal wall kicks `[0, -1, 1, -2, 2]` — no SRS.
- **`collide(shape, ox, oy)`** is the single source of truth for movement validity; cells with `y < 0` are allowed (above the board).
- **Game loop** (`loop`) runs on `requestAnimationFrame`, accumulating `dropAccum` until `dropInterval`. Pausing and game over stop the loop with `cancelAnimationFrame(animId)`; unpausing restarts it by calling `loop()` directly.
- **Lock sequence**: `lockPiece()` → `merge()` → `clearLines()` (updates lines/score/level/`dropInterval`) → `spawn()` (promotes `next`, generates a new one, triggers `endGame()` if the spawned piece already collides, redraws the preview).
- **Scoring/speed**: `LINE_SCORES[cleared] * level`; hard drop +2/cell, soft drop +1/row; level = `floor(lines / 10) + 1`; `dropInterval = max(100, 1000 − (level − 1) × 90)`.
- The next-piece preview assumes a 4×4 grid of 30px cells (`drawNext`, matching the 120×120 `#next-canvas`).

If `COLS`, `ROWS`, or `BLOCK` change, the `#board` canvas `width`/`height` in `index.html` must be updated to `COLS × BLOCK` by `ROWS × BLOCK`.
