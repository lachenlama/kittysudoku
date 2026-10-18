import http from 'node:http'
import { WebSocketServer, WebSocket } from 'ws'
import {
  generate, findHint, seeded, PLAYER_COLORS, HATS,
  type Cage, type ClientMsg, type Difficulty, type ServerMsg, type Snapshot, type Team, type Variant,
} from '../shared/sudoku'
import { data, save, type TeamStats } from './store'

interface Player { id: string; name: string; color: string; ws: WebSocket | null; selected: number | null; hat: string; love: string }
interface Room {
  code: string
  players: Player[]
  difficulty: Difficulty | null
  variant: Variant
  cages?: Cage[]
  daily: string | null
  win: Snapshot['win']
  givens: number[]
  board: number[]
  notes: number[]
  by: string[]
  solution: number[]
  lives: number
  hintsLeft: number
  startedAt: number
  finishedAt: number
  status: 'lobby' | 'playing' | 'won' | 'lost'
  active: number
}

const rooms = new Map<string, Room>()
const conns = new Map<WebSocket, { room: Room; player: Player }>()
const allowed = (process.env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean)
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // no I, O
const DIFFS = ['lion', 'tiger', 'panther']
const VARIANTS: Variant[] = ['classic', 'diagonal', 'cages']

// ---- daily panther: date in DAILY_TZ, same seeded puzzle for every room, variant rotates by day ----
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: process.env.DAILY_TZ || 'UTC' }).format(new Date())
const shiftDay = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10)
const dailyVariant = (d: string) => VARIANTS[((Math.round((Date.parse(d + 'T00:00:00Z') - Date.UTC(2026, 0, 1)) / 864e5) % 3) + 3) % 3]
const dailyCache = new Map<string, ReturnType<typeof generate>>()
const streakNow = (t: TeamStats, td: string) => (t.lastDailyDate === td || t.lastDailyDate === shiftDay(td, -1) ? t.streak : 0)

// ponytail: team = the two names; renaming yourself starts a new team (stats are not migrated)
const teamKey = (r: Room) => (r.players.length === 2 ? r.players.map(p => p.name.trim().toLowerCase()).sort().join('+') : null)
function teamOf(r: Room): Team | null {
  const key = teamKey(r)
  if (!key) return null
  const t = data.teams[key], td = today()
  return { key, wins: t?.wins ?? 0, streak: t ? streakNow(t, td) : 0, best: t?.best ?? {}, dailyDoneToday: !!t?.dailyDone.includes(td), today: td }
}

const server = http.createServer((_, res) => { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('kitty ok') })
const wss = new WebSocketServer({
  server,
  verifyClient: ({ origin }: { origin: string }) => !allowed.length || allowed.includes(origin),
})

const send = (ws: WebSocket | null, m: ServerMsg) => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m)) }
const everyone = (r: Room, m: ServerMsg) => r.players.forEach(p => send(p.ws, m))

function snapshot(r: Room, me: Player): Snapshot {
  const other = r.players.find(x => x !== me)
  return {
    room: r.code, now: Date.now(),
    daily: { date: today(), variant: dailyVariant(today()) },
    team: teamOf(r),
    love: { mine: me.love, partner: r.status === 'won' ? other?.love ?? '' : null, partnerWrote: !!other?.love },
    win: r.win,
    puzzle: {
      size: 9, difficulty: r.difficulty, variant: r.variant, cages: r.cages, daily: r.daily, givens: r.givens, board: r.board, notes: r.notes, by: r.by,
      lives: r.lives, hintsLeft: r.hintsLeft, startedAt: r.startedAt, finishedAt: r.finishedAt, status: r.status,
    },
    players: r.players.map(p => ({ id: p.id, name: p.name, color: p.color, online: !!p.ws, selected: p.selected, hat: p.hat })),
  }
}
const broadcast = (r: Room) => { r.active = Date.now(); r.players.forEach(p => send(p.ws, { type: 'state', ...snapshot(r, p) })) }

function newRoom(): Room {
  let code = ''
  do code = Array.from({ length: 4 }, () => LETTERS[(Math.random() * LETTERS.length) | 0]).join('')
  while (rooms.has(code))
  const r: Room = {
    code, players: [], difficulty: null, variant: 'classic', daily: null, win: null, givens: Array(81).fill(0), board: Array(81).fill(0), notes: Array(81).fill(0),
    by: Array(81).fill(''), solution: Array(81).fill(0), lives: 9, hintsLeft: 3, startedAt: 0, finishedAt: 0,
    status: 'lobby', active: Date.now(),
  }
  rooms.set(code, r)
  return r
}

function startPuzzle(r: Room, d: Difficulty, variant: Variant, daily: string | null = null) {
  let g = daily ? dailyCache.get(daily) : undefined
  if (!g) {
    g = daily ? generate('panther', variant, seeded('kitty-daily-' + daily)) : generate(d, variant)
    if (daily) { dailyCache.clear(); dailyCache.set(daily, g) }
  }
  const { puzzle, solution, cages } = g
  if (r.status !== 'lobby') r.players.forEach(p => (p.love = '')) // a note written in the lobby carries into the first puzzle
  Object.assign(r, {
    difficulty: d, variant, cages, daily, win: null, givens: puzzle, board: puzzle.slice(), notes: Array(81).fill(0), by: Array(81).fill(''),
    solution, lives: 9, hintsLeft: 3, startedAt: Date.now(), finishedAt: 0, status: 'playing',
  })
  r.players.forEach(p => (p.selected = null))
}

function win(r: Room) {
  r.status = 'won'; r.finishedAt = Date.now()
  r.win = { streakUp: false, newBest: false, hat: '' }
  const key = teamKey(r)
  if (!key) return // solo wins don't count
  const t = (data.teams[key] ??= { wins: 0, streak: 0, lastDailyDate: null, best: {}, dailyDone: [] })
  const before = t.wins, ms = r.finishedAt - r.startedAt, mode = r.daily ? 'daily' : `${r.variant}-${r.difficulty}`
  t.wins++
  r.win.hat = HATS.find(h => h.wins > before && h.wins <= t.wins)?.id ?? ''
  if (!(t.best[mode] <= ms)) { t.best[mode] = ms; r.win.newBest = true }
  if (r.daily && t.lastDailyDate !== r.daily) {
    const prev = streakNow(t, r.daily)
    t.streak = t.lastDailyDate === shiftDay(r.daily, -1) ? t.streak + 1 : 1
    t.lastDailyDate = r.daily
    t.dailyDone = [...t.dailyDone, r.daily].slice(-30)
    r.win.streakUp = t.streak > prev
  }
  save()
}

const int = (x: unknown, lo: number, hi: number): x is number => Number.isInteger(x) && (x as number) >= lo && (x as number) <= hi

function handle(ws: WebSocket, m: ClientMsg) {
  if (m.type === 'join') {
    const code = typeof m.room === 'string' ? m.room.trim().toUpperCase() : ''
    let r: Room | undefined
    if (code) {
      r = rooms.get(code)
      if (!r) return send(ws, { type: 'error', message: 'Room not found — check the code 🐾', fatal: true })
    } else r = newRoom()
    const id = String(m.playerId || '').slice(0, 64)
    if (!id) return send(ws, { type: 'error', message: 'Missing player id', fatal: true })
    let p = r.players.find(x => x.id === id)
    if (!p) {
      if (r.players.length >= 2) return send(ws, { type: 'error', message: 'This room is full (2 players)', fatal: true })
      const taken = r.players.map(x => x.color)
      let color = PLAYER_COLORS.includes(m.color) ? m.color : PLAYER_COLORS[0]
      if (taken.includes(color)) color = PLAYER_COLORS.find(c => !taken.includes(c))!
      p = { id, name: '', color, ws: null, selected: null, hat: '', love: '' }
      r.players.push(p)
    }
    p.name = String(m.name || 'Kitty').trim().slice(0, 12) || 'Kitty'
    if (p.ws && p.ws !== ws) { conns.delete(p.ws); p.ws.close() }
    p.ws = ws
    conns.set(ws, { room: r, player: p })
    return broadcast(r)
  }

  const c = conns.get(ws)
  if (!c) return
  const { room: r, player: p } = c
  switch (m.type) {
    case 'new':
      if (!DIFFS.includes(m.difficulty) || !VARIANTS.includes(m.variant ?? 'classic')) return
      startPuzzle(r, m.difficulty, m.variant ?? 'classic')
      return broadcast(r)
    case 'daily':
      startPuzzle(r, 'panther', dailyVariant(today()), today())
      return broadcast(r)
    case 'equip': {
      const h = HATS.find(x => x.id === m.hat)
      p.hat = h && (teamOf(r)?.wins ?? 0) >= h.wins ? h.id : ''
      return broadcast(r)
    }
    case 'love':
      if (typeof m.text !== 'string' || r.status === 'won' || r.status === 'lost') return
      p.love = m.text.trim().slice(0, 140)
      return broadcast(r)
    case 'select':
      p.selected = m.cell === null ? null : int(m.cell, 0, 80) ? m.cell : null
      return broadcast(r)
    case 'react':
      if (typeof m.emoji === 'string' && m.emoji.length <= 8) everyone(r, { type: 'react', emoji: m.emoji, by: p.id })
      return
    case 'hint': {
      if (r.status !== 'playing' || r.hintsLeft <= 0) return
      const h = findHint(r.board, r.solution, r.variant, r.cages)
      if (!h) return
      r.hintsLeft--
      everyone(r, { type: 'hint', ...h })
      return broadcast(r)
    }
    case 'erase':
      if (r.status !== 'playing' || !int(m.cell, 0, 80) || r.givens[m.cell]) return
      r.board[m.cell] = 0; r.by[m.cell] = ''; r.notes[m.cell] = 0
      return broadcast(r)
    case 'note':
      if (r.status !== 'playing' || !int(m.cell, 0, 80) || !int(m.value, 1, 9) || r.board[m.cell]) return
      r.notes[m.cell] ^= 1 << (m.value - 1)
      return broadcast(r)
    case 'place': {
      const { cell, value } = m
      if (r.status !== 'playing' || !int(cell, 0, 80) || !int(value, 1, 9) || r.board[cell]) return
      if (r.solution[cell] !== value) {
        r.lives--
        everyone(r, { type: 'wrong', cell, by: p.id, value })
        if (r.lives <= 0) { r.status = 'lost'; r.finishedAt = Date.now() }
        return broadcast(r)
      }
      r.board[cell] = value; r.by[cell] = p.id; r.notes[cell] = 0
      const bit = ~(1 << (value - 1))
      const [cr, cc] = [(cell / 9) | 0, cell % 9]
      for (let j = 0; j < 81; j++) {
        const [jr, jc] = [(j / 9) | 0, j % 9]
        const diag = r.variant === 'diagonal' && ((cr === cc && jr === jc) || (cr + cc === 8 && jr + jc === 8))
        if (jr === cr || jc === cc || diag || ((jr / 3) | 0) === ((cr / 3) | 0) && ((jc / 3) | 0) === ((cc / 3) | 0)) r.notes[j] &= bit
      }
      if (r.board.every(Boolean)) win(r)
      return broadcast(r)
    }
  }
}

const alive = new WeakSet<WebSocket>()
wss.on('connection', ws => {
  alive.add(ws)
  ws.on('pong', () => alive.add(ws))
  ws.on('message', data => {
    let m: ClientMsg
    try { m = JSON.parse(data.toString()) } catch { return }
    if (!m || typeof m.type !== 'string') return
    try { handle(ws, m) } catch (e) { console.error(e) }
  })
  ws.on('close', () => {
    const c = conns.get(ws)
    conns.delete(ws)
    if (c && c.player.ws === ws) { c.player.ws = null; c.player.selected = null; broadcast(c.room) }
  })
  ws.on('error', () => {})
})

// heartbeat: drop sockets that didn't answer the last ping
setInterval(() => {
  wss.clients.forEach(ws => {
    if (!alive.has(ws)) return ws.terminate()
    alive.delete(ws)
    ws.ping()
  })
}, 30_000)

// drop rooms idle > 2 h
setInterval(() => {
  for (const [code, r] of rooms) {
    if (Date.now() - r.active > 2 * 3600_000) { r.players.forEach(p => p.ws?.close()); rooms.delete(code) }
  }
}, 10 * 60_000)

const port = Number(process.env.PORT) || 8787
server.listen(port, () => console.log(`kitty server on :${port}`))
