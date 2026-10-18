// Pure sudoku logic + shared protocol types. No deps.

export type Difficulty = 'lion' | 'tiger' | 'panther'

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

export interface Hint { cell: number; value: number; reason: string }
export interface PlayerInfo { id: string; name: string; color: string; online: boolean; selected: number | null }
export interface PuzzleState {
  size: 9
  difficulty: Difficulty | null
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
export interface Snapshot { room: string; now: number; puzzle: PuzzleState; players: PlayerInfo[] }

export type ClientMsg =
  | { type: 'join'; room?: string; playerId: string; name: string; color: string }
  | { type: 'new'; difficulty: Difficulty }
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

const ALL = 511
const PC = Array.from({ length: 512 }, (_, m) => { let n = 0; for (let x = m; x; x &= x - 1) n++; return n })
const row = (i: number) => (i / 9) | 0
const col = (i: number) => i % 9
const box = (i: number) => ((i / 27) | 0) * 3 + (((i % 9) / 3) | 0)

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Bitmask backtracking, most-constrained cell first. Stops at `limit` solutions. */
function solve(grid: number[], limit: number, random: boolean): { count: number; sol: number[] | null } {
  const g = grid.slice()
  const R = new Array(9).fill(0), C = new Array(9).fill(0), B = new Array(9).fill(0)
  for (let i = 0; i < 81; i++) if (g[i]) { const b = 1 << (g[i] - 1); R[row(i)] |= b; C[col(i)] |= b; B[box(i)] |= b }
  let count = 0
  let sol: number[] | null = null
  const rec = () => {
    let best = -1, bm = 0, bc = 10
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue
      const m = ALL & ~(R[row(i)] | C[col(i)] | B[box(i)])
      const n = PC[m]
      if (n < bc) { bc = n; best = i; bm = m; if (n <= 1) break }
    }
    if (best < 0) { count++; if (!sol) sol = g.slice(); return }
    if (bc === 0) return
    const ds: number[] = []
    for (let d = 0; d < 9; d++) if (bm & (1 << d)) ds.push(d)
    if (random) shuffle(ds)
    const r = row(best), c = col(best), b = box(best)
    for (const d of ds) {
      const bit = 1 << d
      g[best] = d + 1; R[r] |= bit; C[c] |= bit; B[b] |= bit
      rec()
      g[best] = 0; R[r] &= ~bit; C[c] &= ~bit; B[b] &= ~bit
      if (count >= limit) return
    }
  }
  rec()
  return { count, sol }
}

export function countSolutions(grid: number[], limit = 2): number {
  return solve(grid, limit, false).count
}

const TARGET: Record<Difficulty, number> = { lion: 28, tiger: 25, panther: 0 }

export function generate(difficulty: Difficulty): { puzzle: number[]; solution: number[] } {
  const target = TARGET[difficulty]
  const t0 = Date.now()
  let best: { puzzle: number[]; solution: number[]; clues: number } | null = null
  for (let attempt = 0; attempt < 6; attempt++) {
    const solution = solve(new Array(81).fill(0), 1, true).sol!
    const p = solution.slice()
    let clues = 81
    for (const i of shuffle(Array.from({ length: 81 }, (_, k) => k))) {
      if (clues <= target) break
      const v = p[i]
      p[i] = 0
      if (countSolutions(p, 2) === 1) clues--
      else p[i] = v
    }
    if (!best || clues < best.clues) best = { puzzle: p, solution, clues }
    // panther: one pass is already minimal. Others: stop once on target or out of time budget.
    if (target === 0 || clues <= target || Date.now() - t0 > 700) break
  }
  return { puzzle: best!.puzzle, solution: best!.solution }
}

const name = (d: number) => `${CATS[d - 1].name} (${d})`

/** Easiest deducible cell: naked single, then hidden single, else fewest-candidates cell. */
export function findHint(board: number[], solution: number[]): Hint | null {
  const R = new Array(9).fill(0), C = new Array(9).fill(0), B = new Array(9).fill(0)
  for (let i = 0; i < 81; i++) if (board[i]) { const b = 1 << (board[i] - 1); R[row(i)] |= b; C[col(i)] |= b; B[box(i)] |= b }
  const cand = (i: number) => (board[i] ? 0 : ALL & ~(R[row(i)] | C[col(i)] | B[box(i)]))
  const empties = Array.from({ length: 81 }, (_, i) => i).filter(i => !board[i])
  if (!empties.length) return null

  for (const i of empties) {
    const m = cand(i)
    if (PC[m] === 1) return { cell: i, value: Math.log2(m) + 1, reason: `Only ${name(Math.log2(m) + 1)} fits in this cell` }
  }
  const units: [string, number[]][] = []
  for (let u = 0; u < 9; u++) {
    units.push(['row', Array.from({ length: 9 }, (_, k) => u * 9 + k)])
    units.push(['column', Array.from({ length: 9 }, (_, k) => k * 9 + u)])
    units.push(['box', Array.from({ length: 9 }, (_, k) => ((u / 3) | 0) * 27 + (u % 3) * 3 + ((k / 3) | 0) * 9 + (k % 3))])
  }
  for (const [kind, cells] of units) {
    for (let d = 1; d <= 9; d++) {
      if (cells.some(i => board[i] === d)) continue
      const spots = cells.filter(i => cand(i) & (1 << (d - 1)))
      if (spots.length === 1) return { cell: spots[0], value: d, reason: `${name(d)} can only go here in this ${kind}` }
    }
  }
  const i = empties.reduce((a, b) => (PC[cand(b)] < PC[cand(a)] ? b : a))
  return { cell: i, value: solution[i], reason: 'The Wise Cat just knows… 🔮' }
}
