# Kitty Sudoku v2 — Design

Date: 2026-10-19 · Status: approved. Extends `2026-10-18-kitty-sudoku-design.md`; where they conflict, this wins.

Two build phases: **A = redesign** (sections 1–4), **B = features** (sections 5–8).

---

## PHASE A — Redesign

### 1. Cat art ("kawaii sticker")
`Cat.tsx` is fully redrawn. viewBox `0 0 100 100`. Use React `useId()` for any clipPath/gradient ids (current code reuses `catclip` 81× — fix).

Shared geometry (all cats):
- **Head** (mochi shape, wider than tall): `M50 26 C76 26 92 39 92 59 C92 80 73 91 50 91 C27 91 8 80 8 59 C8 39 24 26 50 26Z`
- **Ears** (rounded tips): left `M13 46 Q10 16 21 11 Q29 8 45 29 Z`, right mirrored around x=50 (`M87 46 Q90 16 79 11 Q71 8 55 29 Z`). Inner ear: same shape scaled ~0.55 toward its base, fill `#FFB8C6` (dark cats `#C98AA0`).
- **Sticker border**: render ears+head once behind everything with `stroke="#fff" strokeWidth=8 strokeLinejoin=round` (in dark mode use the board color via `currentColor`/CSS var so it reads as a cut-out), then the real fills with a 2.5 px outline in a darker shade of that cat's fur (per-cat `outline` color, never generic grey).
- **Soft shading**: ellipse at bottom of head (cx 50, cy 84, rx 34, ry 10), fill outline color, opacity .10, clipped to head.
- **Eyes**: ellipses at (35,59) and (65,59), rx 7.5, ry 8.5. Iris fill = cat eye color, pupil ellipse rx 4 ry 6.5 `#231A1E`, highlights: circle r 2.8 at (+2.6,−3.2) white, circle r 1.3 at (−2.4,+2.8) white.
- **Blush**: ellipses at (23,70) and (77,70), rx 6.5 ry 3.6, `#FF8FA3` opacity .5 (all cats).
- **Nose**: small rounded triangle centered (50,67), pink `#FF8FA3` (Peach: heart `#FF4F7B`).
- **Mouth "ω"**: `M43.5 71 Q46.75 75 50 71.5 Q53.25 75 56.5 71` stroke outline color, width 2, round caps, no fill (dark cats: white .85).
- **Whiskers**: 2 per side, short (from x 18→6 and 82→94 around y 66/71), outline color opacity .45 (dark cats white .6).
- **Hiss face** (wrong move): eyes become `>` `<` chevrons, open mouth ellipse `#C0392B` with two tiny white fangs; keep blush.
- Face fills ~88% of the cell (`.face` width/height 88%).

Per-cat palette (fur / outline / eyes / marking). Only Biscuit is clearly orange:
| # | Name | Fur | Outline | Eyes | Marking |
|---|---|---|---|---|---|
| 1 | Mochi | `#FFFFFF` | `#C9BBB2` | `#6EC1FF` sky | none — pure white |
| 2 | Biscuit | `#FF9D3D` | `#C9661A` | `#5A3B1E` | 3 forehead stripes + 2 cheek stripes per side `#D9711F` |
| 3 | Oreo | `#2F2C38` | `#15131A` | `#F2C94C` | white blaze (forehead→nose) + white muzzle ellipse |
| 4 | Patches | `#FFFFFF` | `#C9BBB2` | `#7A5634` | calico: left ear + patch around left eye black `#2F2C38`; small caramel `#E7A867` patch top-right of head only |
| 5 | Smokey | `#8FA3BF` blue-grey | `#5F7391` | `#F2B84B` | pink bow `#FF6F91` on right ear base |
| 6 | Luna | `#211E29` | `#0D0B11` | `#6FD08C` green | gold crescent `#F6D860` on forehead |
| 7 | Tofu | `#F6E7CF` cream | `#B79C7A` | `#4C8DF0` blue | siamese: ears + oval mask around eyes/nose `#5B3D2E` (chocolate) |
| 8 | Tiger | `#8B5E3C` chocolate brown | `#5A3A22` | `#C9E265` lime | dark "M" on forehead + side stripes `#3E2716` |
| 9 | Peach | `#F7B6C8` strawberry-milk pink | `#D0809A` | `#7A3B52` | heart nose; cheeks blush stronger |

`CATS` in `shared/sudoku.ts` gets updated names/colors (the `color` field = fur, used in UI accents).

### 2. Numbers always on
- Remove the "Show numbers" toggle everywhere (home checkbox, `123` button, localStorage key, `showNumbers` prop).
- Every placed/given cat shows a **round number badge** at the cell's bottom-right, overlapping the face slightly. Cells use `container-type: size`; badge size `40cqw`, font `26cqw`, Nunito 900, line-height 1, white 1.5 px ring.
  - Given: badge background `var(--ink)`, white digit.
  - Player-placed: badge background = placer's color, digit `#3A2A26` (pastels need dark text). This **replaces** the `.pdot`.
- Paw notes: tiny digits (not colored dots) in a 3×3 mini-grid, font `22cqw`, weight 800, color `var(--muted)`; digit tinted with that cat's fur color only for a subtle cue (`color-mix(in srgb, fur 55%, var(--ink))`).
- Wise Cat bubble and messages refer to cats as "Biscuit (2)".

### 3. Input: Paw Pad (phone) & sidebar keypad (desktop)

**Layout mode** = `desktop` when `matchMedia('(min-width: 900px) and (pointer: fine)')` matches (listen for changes), else `phone`.

**Phone layout** (no palette under the board):
- Top bar (52 px): room code chip · timer · 9 hearts · 💌 (phase B) · partner dot.
- Board: `--bs: min(calc(100vw - 12px), 420px, calc(100dvh - 190px - env(safe-area-inset-top) - env(safe-area-inset-bottom)))` → ≈381 px on iPhone 16 (≈42 px cells). Side padding of the screen becomes 6 px.
- Below the board: Wise Cat bubble zone (44 px), then a slim row with two buttons: **💡 Hint (badge = left)** and **💗 React**. Nothing else.
- **Paw Pad**: tapping an empty or player-filled cell selects it and opens a floating pad (position: fixed, z above board).
  - Content: 3×3 keys in dial-pad order (1 2 3 / 4 5 6 / 7 8 9), each 52×52 px: small cat (70%) + number badge. Bottom row: **✏️ Notes** (toggle, sticky per device in localStorage) and **🧽 Erase** (only enabled if the cell has a player value or notes).
  - Size ≈ 184 × 236 px, rounded 22 px, card background, shadow, little triangular arrow pointing to the cell.
  - Placement: prefer **above** the cell; if not enough room above (cell top − pad height < safe top + 8), place **below**. Horizontally centered on the cell, clamped to 8 px from screen edges. Arrow x follows the cell center.
  - Place mode: tapping a key sends `place` and closes the pad. Notes mode: tapping toggles `note` and keeps the pad open.
  - **Long-press** (450 ms) on a cell opens the pad directly in Notes mode for that interaction.
  - Keys for a cat already placed 9 times are faded and disabled (place mode only).
  - Tap outside, or tap the same cell again → close. Tapping another cell moves the pad.
  - Tapping a **given** cell: no pad; highlights all cats of that value (existing `hv`).
  - Pad opens with a 140 ms scale-from-arrow animation (none under reduced motion).

**Desktop layout**:
- Centered container max 1200 px, two columns with 32 px gap: board `--bs: min(640px, calc(100vh - 140px))` on the left; sidebar 300 px on the right.
- Top header row spanning both: "🐾 Kitty Sudoku" wordmark left, room code (click → copy link) + timer right.
- Sidebar (card): hearts row, players list (dot, name, online), **3×3 keypad** of 72 px keys (cat + badge, remaining count small under it), buttons: ✏️ Notes (toggle), 🧽 Erase, 💡 Hint (n), 💗 React, 💌 (phase B), and a shortcut legend.
- No Paw Pad on desktop; click selects cell, keypad/keyboard acts on the selection.
- Keyboard: `1–9` place (or toggle note in notes mode), `Shift+1–9` toggle note, `N` notes mode, arrows / WASD move selection (wrap off), `Backspace`/`Delete`/`0` erase, `H` hint, `Esc` deselect.
- Hover on cells: soft highlight.

### 4. Add to Home Screen gate
On the **home screen** (before name/room), when not standalone (`navigator.standalone || matchMedia('(display-mode: standalone)')`), show a prominent card at the top: **"📲 Add Kitty to your Home Screen — full screen, no browser bars"** with a primary button. Small "Skip, play in browser" link below hides it for this session (sessionStorage) — it is not permanently dismissed.

Button behavior by platform:
- **Android / desktop Chrome / Edge**: capture `beforeinstallprompt` (preventDefault, keep the event); button calls `prompt()`. Button label "Install Kitty".
- **iOS Safari** (`/iPhone|iPad|iPod/` and not CriOS/FxiOS/in-app): button opens a bottom sheet with 3 illustrated steps (inline SVG/emoji): 1. tap the Share icon (draw the iOS share glyph) in Safari's toolbar, 2. scroll and tap **Add to Home Screen**, 3. open **Kitty** from your home screen. If a room code is known, sheet also shows: "Then enter code **ABCD**" in large letters.
- **iOS in-app browsers** (Instagram, FBAN/FBAV, WhatsApp, Line, etc. via UA sniff) and iOS Chrome/Firefox: card text "Open this page in Safari to add Kitty to your Home Screen" + button copies the link.
- **Desktop Safari / others**: card hidden (no reliable install path).

iOS storage quirk: the home-screen app does not share storage with Safari, and invite links open in Safari. Therefore:
- When a page is opened with `?room=ABCD` and not standalone on iOS, the home screen shows the room code big ("Room **ABCD**") with two choices: **Add to Home Screen first** (opens the sheet, which repeats the code) or **Just play in Safari**.
- The join form keeps a code field so the partner can type ABCD inside the app.
- Index meta: ensure `apple-mobile-web-app-capable=yes`, `mobile-web-app-capable=yes`, `apple-mobile-web-app-status-bar-style=black-translucent`, `apple-mobile-web-app-title=Kitty`.

---

## PHASE B — Features

### 5. Persistence (server)
- `server/store.ts` (or inline in index.ts if small): JSON file at `process.env.DATA_FILE || './data.json'`, loaded at start, saved atomically (write `*.tmp` then rename) debounced 500 ms after changes. `data.json` in `.gitignore`.
- Shape: `{ teams: { [teamKey]: { wins: number, streak: number, lastDailyDate: string|null, best: { [mode: string]: number /* ms */ }, dailyDone: string[] /* last 30 dates */ } } }`.
- **teamKey** = the two players' names, trimmed, lowercased, sorted, joined with `+` (e.g. `lama+sita`). Only rooms with exactly 2 players update team stats. Accepted ceiling: renaming yourself starts a new team (`ponytail:` comment).
- State snapshot gains `team: { key, wins, streak, best, dailyDoneToday, today } | null` (null unless 2 players).

### 6. Daily Panther + streak + best times
- Server date: `new Intl.DateTimeFormat('en-CA', { timeZone: process.env.DAILY_TZ || 'UTC' }).format(new Date())` → `YYYY-MM-DD`.
- Daily puzzle: generated with a **seeded PRNG** (mulberry32 of a hash of the date string) so every room gets the same puzzle that day; cache today's daily in memory. Difficulty `panther`, variant rotates by day number: `classic → diagonal → cages` (dayIndex % 3, dayIndex = days since 2026-01-01).
- `shared/sudoku.ts` generation functions accept an optional `rng: () => number` (default `Math.random`).
- Protocol: client → `daily`. Starts today's daily in the room (`puzzle.daily = date`).
- On daily **win** with 2 players: if `lastDailyDate === yesterday` → `streak += 1`; else if `lastDailyDate !== today` → `streak = 1`; set `lastDailyDate = today`, push to `dailyDone`. Replays the same day don't change streak. On read, if `lastDailyDate` is older than yesterday, report streak 0.
- Every win (daily or not): `wins += 1`; best time for mode key `${variant}-${difficulty}` (daily uses `daily`) = min(existing, finishedAt − startedAt).
- **Lobby** redesign: a big **🌙 Daily Panther** card at top ("Today: Diagonal Cats · 🔥 4-day streak" / "✅ Done today — come back tomorrow" but still playable), then **variant** segmented control (Classic / Diagonal / Fish Cages) and **difficulty** buttons (Lion / Tiger / Panther) each showing best time if any. Footer: "🏆 {wins} puzzles solved together".
- Win screen shows "🔥 streak +1!" when it increased and "New best time!" when applicable.

### 7. Cat variants
Variant type `'classic' | 'diagonal' | 'cages'`. Puzzle state gains `variant` and `cages?: { cells: number[]; sum: number }[]`.
- **Diagonal Cats**: both main diagonals must also contain 1–9. Solver/generator/hint treat the diagonals as extra units. UI: diagonal cells get a faint lavender tint + a thin diagonal line through the board (SVG overlay, pointer-events none). Same clue targets as classic.
- **Fish Cages (killer)**: from the solution, partition all 81 cells into cages by random flood growth (cage size 2–4, occasional 1 allowed ≤3 total, no repeated digit within a cage). Cage sum = sum of solution digits. Uniqueness is checked with cage constraints (distinct digits within a cage + exact sum; prune with remaining-sum min/max feasibility of unused digits). Givens removed while unique down to targets: lion 10, tiger 4, panther 0 (accept the smallest reached if the target can't be met). Generation budget ≤ 3 s; if a cage layout can't reach uniqueness quickly, regenerate cages.
  - UI: cage borders drawn as dashed 1.5 px lines inset 3 px inside the cells along cage edges (SVG overlay computing edges from cage membership); sum in the cage's top-left-most cell, top-left corner, font `22cqw`, weight 900, small fish 🐟 not needed — keep it readable. Cage borders must not collide with number badges (badge is bottom-right).
  - Hints: candidates also filtered by cage feasibility; existing fallback still applies.
- Tests: each variant × difficulty has exactly one solution under its rules, solution valid under its rules, cages cover all cells exactly once with correct sums, generation within budget (classic/diagonal 1.5 s, cages 3 s).
- Protocol: `new { difficulty, variant }` (variant defaults to classic).

### 8. Cat closet + love notes
**Closet**
- Accessories unlocked by team `wins`: 1 🎀 Bow, 2 🌸 Flower crown, 4 🎉 Party hat, 6 🤓 Glasses, 8 🧙 Witch hat, 12 👑 Crown, 16 😇 Halo, 20 🎅 Santa hat. (Solo/1-player wins don't count — teams only.)
- Each accessory is a small inline SVG drawn in `Cat.tsx` via a `hat?: string` prop, positioned on the head/ears (glasses on the eyes), scaled to the 100×100 viewBox. Keep each under ~6 shapes.
- Lobby has a **👗 Closet** button → sheet showing all 8 (locked ones greyed with "Win N puzzles"), tap to equip one or "None". Equipped hat saved in localStorage and sent via `equip { hat }` (server validates against team unlocks; sends it as `PlayerInfo.hat`).
- Board: cats **placed by a player** wear that player's equipped hat. Givens never wear hats.
- Win screen: "🎁 New in the closet: Crown!" when a threshold is crossed.

**Love notes**
- 💌 button (top bar on phone, sidebar on desktop, also in lobby) opens a sheet with a textarea (max 140 chars, 16 px font) "Leave a note for {partner} — they'll see it when you solve this one".
- Protocol: `love { text }` (empty clears). Stored per puzzle per player on the server. In `state`, each player receives **only their own note** while playing; when `status === 'won'` both notes are included. Notes reset on `new`/`daily`.
- 💌 icon shows a small dot when you've written one; partner sees "💌 {name} left you a note…" teaser (boolean only) during play.
- Win screen: an envelope that opens (CSS animation) revealing the partner's note.

### Testing (phase B)
- Extend `shared/sudoku.test.ts` for variants (above) and seeded generation (same seed → same puzzle).
- Throwaway smoke script: daily start, streak/wins persistence to data.json across server restart, love note privacy (partner doesn't receive the text before win).
