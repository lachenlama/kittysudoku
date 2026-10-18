// Pure sudoku logic + shared protocol types. No deps.

export type Difficulty = 'lion' | 'tiger' | 'panther'
export type Variant = 'classic' | 'diagonal' | 'cages'

export const CATS = [
  { id: 1, name: 'Mochi', color: '#FFFFFF' },
  { id: 2, name: 'Biscuit', color: '#FF9D3D' },
  { id: 3, name: 'Oreo', color: '#2F2C38' },
  { id: 4, name: 'Patches', color: '#FFFFFF' },
  { id: 5, name: 'Smokey', color: '#8FA3BF' },
  { id: 6, name: 'Luna', color: '#211E29' },
  { id: 7, name: 'Tofu', color: '#F6E7CF' },
  { id: 8, name: 'Tiger', color: '#8B5E3C' },
  { id: 9, name: 'Peach', color: '#F7B6C8' },
]

export const PLAYER_COLORS = ['#FF9F80', '#B9A7F5', '#6FCFB0', '#F5C542', '#6BB4FF']

export const HATS = [
  { id: 'bow', name: 'Bow', emoji: '🎀', wins: 1 },
  { id: 'flower', name: 'Flower crown', emoji: '🌸', wins: 2 },
  { id: 'party', name: 'Party hat', emoji: '🎉', wins: 4 },
  { id: 'glasses', name: 'Glasses', emoji: '🤓', wins: 6 },
  { id: 'witch', name: 'Witch hat', emoji: '🧙', wins: 8 },
  { id: 'crown', name: 'Crown', emoji: '👑', wins: 12 },
  { id: 'halo', name: 'Halo', emoji: '😇', wins: 16 },
  { id: 'santa', name: 'Santa hat', emoji: '🎅', wins: 20 },
]

export interface Cage { cells: number[]; sum: number }
export interface Hint { cell: number; value: number; reason: string }
export interface PlayerInfo { id: string; name: string; color: string; online: boolean; selected: number | null; hat: string }
export interface PuzzleState {
  size: 9
  difficulty: Difficulty | null
  variant: Variant
  cages?: Cage[]
  daily: string | null // date (YYYY-MM-DD) when this is the Daily Panther
  givens: number[]
  board: number[]
  notes: number[] // bitmask per cell, bit (d-1) = digit d
  by: string[] // playerId that placed each cell ('' = given/empty)
  lives: number
  hintsLeft: number
  startedAt: number
  finishedAt: number
  status: 'lobby' | 'playing' | 'won' | 'lost'
}
export interface Team {
  key: string; wins: number; streak: number; best: Record<string, number>
  dailyDoneToday: boolean; today: string
}
export interface Snapshot {
  room: string; now: number; puzzle: PuzzleState; players: PlayerInfo[]
  daily: { date: string; variant: Variant } // today's Daily Panther
  team: Team | null // null unless exactly 2 players
  love: { mine: string; partner: string | null; partnerWrote: boolean } // partner text only once won
  win: { streakUp: boolean; newBest: boolean; hat: string } | null // set once the puzzle is won
}

export type ClientMsg =
  | { type: 'join'; room?: string; playerId: string; name: string; color: string }
  | { type: 'new'; difficulty: Difficulty; variant?: Variant }
  | { type: 'daily' }
  | { type: 'equip'; hat: string }
  | { type: 'love'; text: string }
  | { type: 'select'; cell: number | null }
  | { type: 'place'; cell: number; value: number }
  | { type: 'erase'; cell: number }
  | { type: 'note'; cell: number; value: number }
  | { type: 'hint' }
  | { type: 'react'; emoji: string }

export type ServerMsg =
  | ({ type: 'state' } & Snapshot)
  | { type: 'wrong'; cell: number; by: string; value: number }
  | ({ type: 'hint' } & Hint)
  | { type: 'react'; emoji: string; by: string }
  | { type: 'error'; message: string; fatal?: boolean }

type Rng = () => number
/** mulberry32 seeded from a string hash: same string -> same sequence. */
export function seeded(str: string): Rng {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619)
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const ALL = 511
const PC = Array.from({ length: 512 }, (_, m) => { let n = 0; for (let x = m; x; x &= x - 1) n++; return n })
const range = (n: number) => Array.from({ length: n }, (_, i) => i)

function shuffle<T>(a: T[], rng: Rng = Math.random): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Units: 27 rows/columns/boxes, then the 2 diagonals (only used by the diagonal variant).
const UNITS: number[][] = []
const KINDS: string[] = []
for (let u = 0; u < 9; u++) {
  UNITS.push(range(9).map(k => u * 9 + k)); KINDS.push('row')
  UNITS.push(range(9).map(k => k * 9 + u)); KINDS.push('column')
  UNITS.push(range(9).map(k => ((u / 3) | 0) * 27 + (u % 3) * 3 + ((k / 3) | 0) * 9 + (k % 3))); KINDS.push('box')
}
UNITS.push(range(9).map(k => k * 10)); KINDS.push('diagonal')
UNITS.push(range(9).map(k => k * 8 + 8)); KINDS.push('diagonal')
const unitCount = (v: Variant) => (v === 'diagonal' ? 29 : 27)
const CELL_UNITS = [27, 29].map(n => range(81).map(i => range(n).filter(u => UNITS[u].includes(i))))
const cellUnits = (v: Variant) => CELL_UNITS[v === 'diagonal' ? 1 : 0]

// LO/HI[n << 9 | used]: smallest/largest sum of n distinct digits not in `used` (LO = 255 if too few are free).
const LO = new Uint8Array(10 * 512), HI = new Uint8Array(10 * 512)
for (let n = 0; n < 10; n++) for (let u = 0; u < 512; u++) {
  const free = range(9).filter(d => !(u & (1 << d))).map(d => d + 1)
  if (free.length < n) { LO[(n << 9) | u] = 255; continue }
  LO[(n << 9) | u] = free.slice(0, n).reduce((a, b) => a + b, 0)
  HI[(n << 9) | u] = free.slice(free.length - n).reduce((a, b) => a + b, 0)
}
/** Can digit d go in a cage with `used` digits, `left` empty cells (incl. this one) and `sum` still to make? */
function cageOk(used: number, left: number, sum: number, d: number) {
  const bit = 1 << (d - 1)
  if (used & bit) return false
  const n = left - 1, s = sum - d, u = used | bit
  return n === 0 ? s === 0 : s >= LO[(n << 9) | u] && s <= HI[(n << 9) | u]
}

/**
 * Bitmask backtracking, most-constrained cell first. Stops at `limit` solutions.
 * `cap` bounds the search nodes: when exceeded the grid counts as "not proven unique" (count = limit).
 */
function solve(grid: number[], variant: Variant, cages: Cage[] | undefined, limit: number, random: boolean, rng: Rng = Math.random, cap = Infinity): { count: number; sol: number[] | null } {
  const g = grid.slice()
  const CU = cellUnits(variant)
  const um: number[] = new Array(unitCount(variant)).fill(0)
  const cageOf: number[] = new Array(81).fill(-1)
  const cu: number[] = [], cs: number[] = [], cl: number[] = []
  cages?.forEach((c, k) => { cu[k] = 0; cs[k] = c.sum; cl[k] = c.cells.length; c.cells.forEach(i => (cageOf[i] = k)) })
  const put = (i: number, d: number, on: boolean) => {
    const bit = 1 << (d - 1), k = cageOf[i]
    for (const u of CU[i]) um[u] ^= bit
    if (k >= 0) { cu[k] ^= bit; cs[k] += on ? -d : d; cl[k] += on ? -1 : 1 }
    g[i] = on ? d : 0
  }
  for (let i = 0; i < 81; i++) if (grid[i]) put(i, grid[i], true)
  const cand = (i: number) => {
    let m = ALL
    for (const u of CU[i]) m &= ~um[u]
    const k = cageOf[i]
    if (k >= 0 && m) for (let d = 1; d <= 9; d++) if (m & (1 << (d - 1)) && !cageOk(cu[k], cl[k], cs[k], d)) m &= ~(1 << (d - 1))
    return m
  }
  let count = 0, nodes = 0
  let sol: number[] | null = null
  const rec = () => {
    if (++nodes > cap) { count = limit; return }
    let best = -1, bm = 0, bc = 10
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue
      const m = cand(i)
      const n = PC[m]
      if (n < bc) { bc = n; best = i; bm = m; if (n <= 1) break }
    }
    if (best < 0) { count++; if (!sol) sol = g.slice(); return }
    if (bc === 0) return
    const ds: number[] = []
    for (let d = 1; d <= 9; d++) if (bm & (1 << (d - 1))) ds.push(d)
    if (random) shuffle(ds, rng)
    for (const d of ds) {
      put(best, d, true)
      rec()
      put(best, d, false)
      if (count >= limit) return
    }
  }
  rec()
  return { count, sol }
}

export function countSolutions(grid: number[], limit = 2, variant: Variant = 'classic', cages?: Cage[]): number {
  return solve(grid, variant, cages, limit, false).count
}

const TARGET: Record<Difficulty, number> = { lion: 28, tiger: 25, panther: 0 }
const CAGE_TARGET: Record<Difficulty, number> = { lion: 10, tiger: 4, panther: 0 }

/** Partition the solution into cages of 2-4 cells (a few singles), no repeated digit inside a cage. */
export function makeCages(sol: number[], rng: Rng = Math.random): Cage[] {
  const owner: number[] = new Array(81).fill(-1)
  const cages: Cage[] = []
  let singles = 0
  const nb = (i: number) => [i >= 9 ? i - 9 : -1, i < 72 ? i + 9 : -1, i % 9 ? i - 1 : -1, i % 9 < 8 ? i + 1 : -1].filter(x => x >= 0)
  for (const s of shuffle(range(81), rng)) {
    if (owner[s] >= 0) continue
    const cells = [s]
    let digits = 1 << (sol[s] - 1)
    owner[s] = cages.length
    const want = singles < 3 && rng() < 0.05 ? 1 : 2 + ((rng() * 3) | 0)
    while (cells.length < want) {
      const opts = cells.flatMap(nb).filter(j => owner[j] < 0 && !(digits & (1 << (sol[j] - 1))))
      if (!opts.length) break
      const j = opts[(rng() * opts.length) | 0]
      cells.push(j); owner[j] = cages.length; digits |= 1 << (sol[j] - 1)
    }
    if (cells.length === 1 && want > 1) { // stuck: join a neighbouring cage if we can
      const t = nb(s).filter(j => owner[j] >= 0 && owner[j] < cages.length).map(j => cages[owner[j]])
        .find(c => c.cells.length < 4 && !c.cells.some(j => sol[j] === sol[s]))
      if (t) { t.cells.push(s); t.sum += sol[s]; owner[s] = cages.indexOf(t); continue }
    }
    if (cells.length === 1) singles++
    cages.push({ cells, sum: cells.reduce((a, i) => a + sol[i], 0) })
  }
  return cages
}

export function generate(difficulty: Difficulty, variant: Variant = 'classic', rng?: () => number): { puzzle: number[]; solution: number[]; cages?: Cage[] } {
  const r = rng ?? Math.random
  const target = (variant === 'cages' ? CAGE_TARGET : TARGET)[difficulty]
  const t0 = Date.now()
  let best: { puzzle: number[]; solution: number[]; cages?: Cage[]; clues: number } | null = null
  for (let attempt = 0; attempt < 6; attempt++) {
    const solution = solve(new Array(81).fill(0), variant === 'diagonal' ? 'diagonal' : 'classic', undefined, 1, true, r).sol!
    const cages = variant === 'cages' ? makeCages(solution, r) : undefined
    const p = solution.slice()
    let clues = 81
    for (const i of shuffle(range(81), r)) {
      if (clues <= target) break
      const v = p[i]
      p[i] = 0
      // ponytail: the node cap makes slow cage checks count as "not unique": maybe a few extra givens, never a bad puzzle
      if (solve(p, variant, cages, 2, false, r, cages ? CAP : Infinity).count === 1) clues--
      else p[i] = v
    }
    if (!best || clues < best.clues) best = { puzzle: p, solution, cages, clues }
    // panther: one pass is already minimal. Others: stop once on target or (unseeded only) out of time budget.
    if (target === 0 || clues <= target || (!rng && Date.now() - t0 > 700)) break
  }
  return { puzzle: best!.puzzle, solution: best!.solution, cages: best!.cages }
}
const CAP = 4000

const name = (d: number) => `${CATS[d - 1].name} (${d})`

/** Easiest deducible cell: naked single, then hidden single, else fewest-candidates cell. */
export function findHint(board: number[], solution: number[], variant: Variant = 'classic', cages?: Cage[]): Hint | null {
  const CU = cellUnits(variant)
  const cageOf = new Map<number, Cage>()
  cages?.forEach(c => c.cells.forEach(i => cageOf.set(i, c)))
  const cand = (i: number) => {
    if (board[i]) return 0
    let m = ALL
    for (const u of CU[i]) for (const j of UNITS[u]) if (board[j]) m &= ~(1 << (board[j] - 1))
    const c = cageOf.get(i)
    if (c && m) {
      let used = 0, sum = c.sum, left = 0
      for (const j of c.cells) { if (board[j]) { used |= 1 << (board[j] - 1); sum -= board[j] } else left++ }
      for (let d = 1; d <= 9; d++) if (m & (1 << (d - 1)) && !cageOk(used, left, sum, d)) m &= ~(1 << (d - 1))
    }
    return m
  }
  const empties = range(81).filter(i => !board[i])
  if (!empties.length) return null

  for (const i of empties) {
    const m = cand(i)
    if (PC[m] === 1) return { cell: i, value: Math.log2(m) + 1, reason: `Only ${name(Math.log2(m) + 1)} fits in this cell` }
  }
  for (let u = 0; u < unitCount(variant); u++) {
    const cells = UNITS[u]
    for (let d = 1; d <= 9; d++) {
      if (cells.some(i => board[i] === d)) continue
      const spots = cells.filter(i => cand(i) & (1 << (d - 1)))
      if (spots.length === 1) return { cell: spots[0], value: d, reason: `${name(d)} can only go here in this ${KINDS[u]}` }
    }
  }
  const i = empties.reduce((a, b) => (PC[cand(b)] < PC[cand(a)] ? b : a))
  return { cell: i, value: solution[i], reason: 'The Wise Cat just knows… 🔮' }
}
