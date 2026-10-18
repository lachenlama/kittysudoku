# Kitty Sudoku Co-op — Design

Date: 2026-10-18 · Status: approved design, pending spec review

## 1. Product

A cute, logic-first sudoku where digits are cats. Two players, each on their own phone, solve the **same board live** together. Primary target device: **iPhone 16 (Safari / Home Screen web app)**.

### Puzzle
- Sizes: **6×6** (2×3 boxes, 6 cats) for *Kitten* and *Cat* difficulty; **9×9** (3×3 boxes, 9 cats) for *Lion* and *Tiger*.
- Every puzzle has exactly one solution, verified by the solver at generation time.
- Difficulty = board size + clue count + highest technique the hint engine needs:
  - Kitten (6×6): solvable with naked singles only.
  - Cat (6×6): naked + hidden singles, fewer clues.
  - Lion (9×9): naked + hidden singles.
  - Tiger (9×9): minimal clues; may need pairs (generator accepts any uniquely-solvable puzzle with ≤ 26 clues).
- **Paw notes**: pencil marks shown as tiny cat dots in a 2×3 / 3×3 mini-grid inside the cell.
- Toggle **"Show numbers"**: overlays the digit on each cat (per-device setting, localStorage).

### Co-op
- Home screen: enter name, pick a player color (5 pastel options), then **Start a room** or **Join** with a 4-letter code. Start shows a share sheet (`navigator.share`) with the link `https://<app>/?room=ABCD`; opening the link pre-fills join.
- Shared state: givens, placements, notes, lives, hints left, timer start, status.
- Presence: partner's selected cell shows a glowing rounded outline in their color + tiny name tag; partner online/offline dot in the top bar.
- **9 shared lives**: server checks each placement against the solution. Wrong → cell shakes, cat shows a hiss face for 600 ms, cell cleared, one life lost (heart pops). 0 lives → "The cats got grumpy" screen with *Try again* (new puzzle, same difficulty).
- **Wise Cat hints** (3 per puzzle, shared): server finds the easiest deducible cell (naked single, then hidden single) and returns `{cell, value, reason}`. Both phones highlight the cell + speech bubble e.g. "Only 🐱 Mochi fits in this row." The hint is **not** auto-placed; a player must place it.
- **Reactions**: 💗 😹 🙀 👏 float up on the partner's screen.
- **Win**: cats dance (CSS bounce), paw confetti, shows time, lives left, both names. *Play again* → difficulty picker, stays in room.
- Notes are shared (both see each other's notes) — simpler and more collaborative.

### Out of scope (v1)
Accounts, streaks/history, daily puzzle, undo, sound settings, >2 players, persistence across server restart.

## 2. iPhone 16 UI/UX

### Viewport facts
- CSS viewport **393 × 852 pt**, DPR 3. Safe areas: top ≈ 59 pt (Dynamic Island), bottom ≈ 34 pt (home indicator).
- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`; all edges padded with `env(safe-area-inset-*)`.
- Height via `100dvh` (Safari toolbar collapse safe). Portrait-only design; landscape simply centers the column (max-width 430 px).
- Installable: `manifest.webmanifest` (`display: standalone`, portrait), `apple-mobile-web-app-capable`, `apple-touch-icon` (180 px cat icon), `theme-color` matching background. In-app banner on first visit in Safari: "Add to Home Screen for full-screen play 🐾" (dismissible, localStorage).

### Layout budget (portrait, top→bottom)
| Zone | Height | Content |
|---|---|---|
| Safe top | 59 | — |
| Top bar | 52 | room code chip · timer · 9 hearts (2 rows of mini hearts on 9×9 is avoided: hearts are 14 px, single row) · partner dot+avatar |
| Board | 361 | 16 px side gutters → 361 px square. 9×9 cells ≈ 40 px, 6×6 cells ≈ 60 px |
| Gap | 16 | Wise Cat speech bubble appears here when active |
| Tool row | 56 | Notes (toggle), Erase, Wise Cat (badge = hints left), React |
| Gap | 12 | |
| Cat palette | 136 | 9×9: 5 + 4 buttons, ~64 px; 6×6: 3 × 2 buttons, ~64 px tall wide pills. Badge shows remaining count; finished cats fade out |
| Safe bottom | 34 | — |
Total ≈ 726 pt of 852, leaving breathing room; extra space is distributed above the board.

Controls (palette + tools) sit in the bottom thumb zone; the board is mid-screen. Every tap target ≥ 44 pt.

### Interaction
- Select-cell-then-tap-cat. Tapping a cat with no cell selected highlights all of that cat on the board.
- Highlighting: selected cell (strong), its row/col/box (faint tint), all cells with the same cat (soft ring).
- Given cells: cat on a slightly darker cushion, not editable. Player-placed cats have a small colored dot of the placer's color.
- `touch-action: manipulation` on everything (no double-tap zoom); `user-select: none`; `-webkit-tap-highlight-color: transparent`; no text inputs on the game screen. The home screen name/code inputs use 16 px font (prevents iOS zoom).
- Haptics: iOS Safari has no Vibration API; skipped. Feedback is visual + optional sound (off by default in v1 → no sound at all in v1).
- Motion: placement pop (scale 0.6→1, 180 ms spring), wrong shake (300 ms), heart pop, win dance. All disabled under `prefers-reduced-motion`.

### Visual style
- Font: **Nunito** (Google Fonts, rounded), weights 600/800.
- Light palette: background cream `#FFF7EE`, board `#FFFFFF`, box borders `#E8D5C4`, ink `#4A3A35`, accent peach `#FF9F80`, lavender `#B9A7F5`. Dark mode (`prefers-color-scheme: dark`): background `#1E1A24`, board `#2A2433`, ink `#F3E9E2`, same accents slightly desaturated. Colors as CSS custom properties on `:root`.
- Board: rounded 20 px corners, soft shadow, thicker box lines (2 px) vs cell lines (1 px).
- **9 cats as inline SVG faces**, each distinct by color **and** a shape cue (colorblind-safe): 1 Mochi (white, blue eyes), 2 Biscuit (ginger, stripes), 3 Oreo (tuxedo), 4 Patches (calico), 5 Smokey (grey, bow), 6 Luna (black, green eyes), 7 Tofu (siamese mask), 8 Tiger (tabby "M"), 9 Peach (orange, heart nose). 6×6 uses cats 1–6.

## 3. Architecture

```
kitty-sudoku/
  shared/sudoku.ts     generator, solver (count solutions ≤2), hint finder
  shared/sudoku.test.ts node:test checks
  server/index.ts      ws server, rooms in memory
  web/                 Vite + React + TS, deployed on Vercel (root dir = web)
```
- **web** (Vercel, static): reads `VITE_WS_URL` (e.g. `wss://cats.example.com`). Imports `../shared` only for types and cat metadata; all game logic is authoritative on the server.
- **server** (user's server): Node 20+, `ws` package, run with `tsx` under pm2, behind Caddy/nginx for TLS. Port from `PORT` env (default 8787). Allowed origin from `ALLOWED_ORIGIN` env.
- **shared**: pure functions, no deps.

### Protocol (JSON over WebSocket)
Client → server:
`join {room?, playerId, name, color}` (no room → create) · `new {difficulty}` · `select {cell|null}` · `place {cell, value}` · `erase {cell}` · `note {cell, value}` (toggle) · `hint` · `react {emoji}`

Server → client:
`state {room, puzzle: {size, givens, board, notes, lives, hintsLeft, startedAt, status}, players: [{id,name,color,online,selected}]}` (full snapshot after every change — boards are tiny) · `wrong {cell, by}` · `hint {cell, value, reason}` · `react {emoji, by}` · `error {message}`

- Room = `{code, players(max 2), puzzle, solution}`. Codes: 4 uppercase letters excluding I/O. Empty rooms deleted after 2 h idle.
- Reconnect: `playerId` (random, localStorage) + room code (URL param) → server re-attaches player; client auto-reconnects with backoff (1s, 2s, 4s, max 10s) and shows "Reconnecting…" pill.
- Validation: server ignores moves on givens, out-of-range values, or when status ≠ playing. Third player joining a full room gets `error`.

## 4. Testing
- `shared/sudoku.test.ts` (node:test via tsx): generated puzzles for each difficulty have exactly one solution; the solution satisfies all constraints; hints returned match the solution; Kitten puzzles solve with singles only.
- Manual: two phones (or one phone + desktop Safari responsive mode at 393×852) — create/join, live placements, wrong move, hint, reaction, win, airplane-mode reconnect.

## 5. Deploy
- Vercel: project root `web`, build `npm run build`, env `VITE_WS_URL`.
- Server: `npm ci && pm2 start "npx tsx server/index.ts" --name kitty`; reverse proxy subdomain → `localhost:8787` with WebSocket upgrade.
