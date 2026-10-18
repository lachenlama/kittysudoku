import http from 'node:http'
import { WebSocketServer, WebSocket } from 'ws'
import {
  generate, findHint, PLAYER_COLORS,
  type ClientMsg, type Difficulty, type ServerMsg, type Snapshot,
} from '../shared/sudoku'

interface Player { id: string; name: string; color: string; ws: WebSocket | null; selected: number | null }
interface Room {
  code: string
  players: Player[]
  difficulty: Difficulty | null
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

const server = http.createServer((_, res) => { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('kitty ok') })
const wss = new WebSocketServer({
  server,
  verifyClient: ({ origin }: { origin: string }) => !allowed.length || allowed.includes(origin),
})

const send = (ws: WebSocket | null, m: ServerMsg) => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m)) }
const everyone = (r: Room, m: ServerMsg) => r.players.forEach(p => send(p.ws, m))

function snapshot(r: Room): Snapshot {
  return {
    room: r.code, now: Date.now(),
    puzzle: {
      size: 9, difficulty: r.difficulty, givens: r.givens, board: r.board, notes: r.notes, by: r.by,
      lives: r.lives, hintsLeft: r.hintsLeft, startedAt: r.startedAt, finishedAt: r.finishedAt, status: r.status,
    },
    players: r.players.map(p => ({ id: p.id, name: p.name, color: p.color, online: !!p.ws, selected: p.selected })),
  }
}
const broadcast = (r: Room) => { r.active = Date.now(); everyone(r, { type: 'state', ...snapshot(r) }) }

function newRoom(): Room {
  let code = ''
  do code = Array.from({ length: 4 }, () => LETTERS[(Math.random() * LETTERS.length) | 0]).join('')
  while (rooms.has(code))
  const r: Room = {
    code, players: [], difficulty: null, givens: Array(81).fill(0), board: Array(81).fill(0), notes: Array(81).fill(0),
    by: Array(81).fill(''), solution: Array(81).fill(0), lives: 9, hintsLeft: 3, startedAt: 0, finishedAt: 0,
    status: 'lobby', active: Date.now(),
  }
  rooms.set(code, r)
  return r
}

function startPuzzle(r: Room, d: Difficulty) {
  const { puzzle, solution } = generate(d)
  Object.assign(r, {
    difficulty: d, givens: puzzle, board: puzzle.slice(), notes: Array(81).fill(0), by: Array(81).fill(''),
    solution, lives: 9, hintsLeft: 3, startedAt: Date.now(), finishedAt: 0, status: 'playing',
  })
  r.players.forEach(p => (p.selected = null))
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
      p = { id, name: '', color, ws: null, selected: null }
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
      if (!DIFFS.includes(m.difficulty)) return
      startPuzzle(r, m.difficulty)
      return broadcast(r)
    case 'select':
      p.selected = m.cell === null ? null : int(m.cell, 0, 80) ? m.cell : null
      return broadcast(r)
    case 'react':
      if (typeof m.emoji === 'string' && m.emoji.length <= 8) everyone(r, { type: 'react', emoji: m.emoji, by: p.id })
      return
    case 'hint': {
      if (r.status !== 'playing' || r.hintsLeft <= 0) return
      const h = findHint(r.board, r.solution)
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
        if (jr === cr || jc === cc || ((jr / 3) | 0) === ((cr / 3) | 0) && ((jc / 3) | 0) === ((cc / 3) | 0)) r.notes[j] &= bit
      }
      if (r.board.every(Boolean)) { r.status = 'won'; r.finishedAt = Date.now() }
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
