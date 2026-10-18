import { useEffect, useMemo, useState } from 'react'
import { CATS, PLAYER_COLORS, type Difficulty, type PlayerInfo, type Snapshot } from './shared'
import { playerId, useRoom } from './useRoom'
import Board from './Board'
import Cat from './Cat'

const ls = {
  get: (k: string, d = '') => { try { return localStorage.getItem('kitty.' + k) ?? d } catch { return d } },
  set: (k: string, v: string) => { try { localStorage.setItem('kitty.' + k, v) } catch { /* private mode */ } },
}
const DIFFS: { id: Difficulty; name: string; sub: string; cat: number }[] = [
  { id: 'lion', name: 'Lion', sub: 'Hard · 28 cats', cat: 2 },
  { id: 'tiger', name: 'Tiger', sub: 'Expert · 25 cats', cat: 8 },
  { id: 'panther', name: 'Panther', sub: 'Evil · fewest cats', cat: 6 },
]
const EMOJI = ['💗', '😹', '🙀', '👏']
const fmt = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }

async function share(code: string) {
  const url = `${location.origin}/?room=${code}`
  try {
    if (navigator.share) await navigator.share({ title: 'Kitty Sudoku', text: `Solve a cat sudoku with me! Room ${code} 🐱`, url })
    else { await navigator.clipboard.writeText(url); alert('Link copied!') }
  } catch { /* cancelled */ }
}

export default function App() {
  const r = useRoom()
  const me = useMemo(playerId, [])
  const [showNumbers, setShowNumbers] = useState(ls.get('nums') === '1')
  const toggleNums = () => setShowNumbers(v => { ls.set('nums', v ? '0' : '1'); return !v })
  const urlRoom = (new URLSearchParams(location.search).get('room') || '').toUpperCase()
  const [auto, setAuto] = useState(!!(urlRoom && ls.get('name')))
  useEffect(() => { if (auto) r.join(urlRoom, ls.get('name'), ls.get('color', PLAYER_COLORS[0])) }, []) // eslint-disable-line
  useEffect(() => { if (r.error) setAuto(false) }, [r.error])
  const iosBanner = useIosBanner()

  return (
    <div className="app">
      {r.snap ? (
        <Room snap={r.snap} me={me} r={r} showNumbers={showNumbers} toggleNums={toggleNums} />
      ) : auto ? (
        <div className="splash"><div className="bigcat"><Cat id={2} /></div><p>Finding your room…</p></div>
      ) : (
        <Home r={r} urlRoom={urlRoom} showNumbers={showNumbers} toggleNums={toggleNums} />
      )}
      {r.conn === 'down' && <div className="pill">Reconnecting…</div>}
      {iosBanner.show && !r.snap && (
        <div className="a2hs"><span>Add to Home Screen for full-screen play 🐾</span><button onClick={iosBanner.hide} aria-label="Dismiss">✕</button></div>
      )}
    </div>
  )
}

function useIosBanner() {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent)
  const standalone = (navigator as unknown as { standalone?: boolean }).standalone || matchMedia('(display-mode: standalone)').matches
  const [show, setShow] = useState(ios && !standalone && ls.get('a2hs') !== '1')
  return { show, hide: () => { ls.set('a2hs', '1'); setShow(false) } }
}

function Home({ r, urlRoom, showNumbers, toggleNums }: { r: ReturnType<typeof useRoom>; urlRoom: string; showNumbers: boolean; toggleNums: () => void }) {
  const [name, setName] = useState(ls.get('name'))
  const [color, setColor] = useState(ls.get('color', PLAYER_COLORS[0]))
  const [code, setCode] = useState(urlRoom)
  const go = (room: string) => {
    const n = name.trim() || 'Kitty'
    ls.set('name', n); ls.set('color', color)
    r.join(room, n, color)
  }
  const busy = r.conn === 'connecting'
  return (
    <div className="home">
      <div className="logo">{[2, 1, 3].map((c, i) => <div key={c} className={'logocat l' + i}><Cat id={c} /></div>)}</div>
      <h1>Kitty Sudoku</h1>
      <p className="sub">Solve it together, one cat at a time 🐾</p>
      <div className="card">
        <label>Your name</label>
        <input value={name} maxLength={12} placeholder="Kitty" onChange={e => setName(e.target.value)} autoComplete="off" autoCorrect="off" />
        <label>Your color</label>
        <div className="swatches">
          {PLAYER_COLORS.map(c => (
            <button key={c} className={'sw' + (c === color ? ' on' : '')} style={{ background: c }} onClick={() => setColor(c)} aria-label={'color ' + c} />
          ))}
        </div>
        <button className="btn primary" disabled={busy} onClick={() => go('')}>Start a room</button>
        <div className="or">or join a friend</div>
        <div className="joinrow">
          <input className="code" value={code} maxLength={4} placeholder="ABCD" autoCapitalize="characters" autoComplete="off" autoCorrect="off"
            onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))} />
          <button className="btn" disabled={busy || code.length !== 4} onClick={() => go(code)}>Join</button>
        </div>
        {r.error && <p className="err">{r.error}</p>}
      </div>
      <button className="link" onClick={toggleNums}>{showNumbers ? '☑' : '☐'} Show numbers on cats</button>
    </div>
  )
}

function Room({ snap, me, r, showNumbers, toggleNums }: { snap: Snapshot; me: string; r: ReturnType<typeof useRoom>; showNumbers: boolean; toggleNums: () => void }) {
  const p = snap.puzzle
  const [pk, setPk] = useState<number | null>(null) // startedAt when "play again" was pressed
  const picking = p.status === 'lobby' || (pk !== null && p.startedAt === pk)
  return (
    <>
      {picking ? <Lobby snap={snap} me={me} r={r} /> : <Game snap={snap} me={me} r={r} showNumbers={showNumbers} toggleNums={toggleNums} onAgain={() => setPk(p.startedAt)} />}
      <div className="floats">
        {r.reacts.map(x => <span key={x.id} className="float" style={{ left: x.x + '%' }}>{x.emoji}</span>)}
      </div>
    </>
  )
}

function Lobby({ snap, me, r }: { snap: Snapshot; me: string; r: ReturnType<typeof useRoom> }) {
  const partner = snap.players.find(x => x.id !== me)
  return (
    <div className="home">
      <div className="roomcode" onClick={() => share(snap.room)}>
        <small>Room code</small><b>{snap.room}</b><span>Tap to invite 💌</span>
      </div>
      <p className="sub">{partner ? <>{partner.name} {partner.online ? 'is here' : 'is away'} <i className="dot" style={{ background: partner.color }} /></> : 'Waiting for your partner to join…'}</p>
      <h2>Pick a puzzle</h2>
      <div className="diffs">
        {DIFFS.map(d => (
          <button key={d.id} className="diff" onClick={() => r.send({ type: 'new', difficulty: d.id })}>
            <div className="dcat"><Cat id={d.cat} /></div>
            <div><b>{d.name}</b><small>{d.sub}</small></div>
          </button>
        ))}
      </div>
      <button className="link" onClick={r.leave}>Leave room</button>
    </div>
  )
}

function Timer({ p, off }: { p: Snapshot['puzzle']; off: number }) {
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick(n => n + 1), 1000); return () => clearInterval(t) }, [])
  const end = p.status === 'playing' ? Date.now() + off : p.finishedAt
  return <span className="timer">{fmt(end - p.startedAt)}</span>
}

function Game({ snap, me, r, showNumbers, toggleNums, onAgain }: { snap: Snapshot; me: string; r: ReturnType<typeof useRoom>; showNumbers: boolean; toggleNums: () => void; onAgain: () => void }) {
  const p = snap.puzzle
  const [sel, setSel] = useState<number | null>(null)
  const [hl, setHl] = useState(0)
  const [notes, setNotes] = useState(false)
  const [reactOpen, setReactOpen] = useState(false)
  const partner = snap.players.find(x => x.id !== me)
  const playing = p.status === 'playing'

  useEffect(() => { setSel(null); setHl(0) }, [p.startedAt])
  const pick = (i: number) => {
    const n = sel === i ? null : i
    setSel(n); setHl(0)
    r.send({ type: 'select', cell: n })
  }
  const selVal = sel !== null ? p.board[sel] : 0
  const hv = selVal || (sel === null ? hl : 0)
  const counts = useMemo(() => { const c = Array(10).fill(0); p.board.forEach(v => c[v]++); return c }, [p.board])
  const hintCell = r.hint && !p.board[r.hint.cell] && playing ? r.hint.cell : null

  const tap = (v: number) => {
    if (playing && sel !== null && !p.board[sel]) r.send({ type: notes ? 'note' : 'place', cell: sel, value: v })
    else { setHl(h => (h === v && sel === null ? 0 : v)); if (sel !== null) { setSel(null); r.send({ type: 'select', cell: null }) } }
  }
  const erase = () => { if (playing && sel !== null && !p.givens[sel]) r.send({ type: 'erase', cell: sel }) }

  const cell = (v: number) => {
    const left = 9 - counts[v]
    return (
      <button key={v} className={'pal' + (left <= 0 ? ' done' : '') + (hv === v ? ' on' : '')} disabled={left <= 0} onClick={() => tap(v)} aria-label={`${CATS[v - 1].name}, ${left} left`}>
        <Cat id={v} />
        <span className="badge">{left}</span>
        {showNumbers && <b className="num">{v}</b>}
      </button>
    )
  }

  return (
    <div className="game">
      <div className="top">
        <button className="chip" onClick={() => share(snap.room)}>{snap.room}</button>
        <Timer p={p} off={r.off} />
        <div className="hearts" aria-label={`${p.lives} lives`}>
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i + (i < p.lives ? 'a' : 'b')} className={'heart' + (i < p.lives ? '' : ' lost')}>{i < p.lives ? '❤️' : '🤍'}</span>
          ))}
        </div>
        <button className={'nums' + (showNumbers ? ' on' : '')} onClick={toggleNums} aria-label="Show numbers">123</button>
        <Avatar pl={partner} />
      </div>

      <div className="spacer" />
      <Board p={p} players={snap.players} me={me} sel={sel} hv={hv} showNumbers={showNumbers} hintCell={hintCell} wrong={r.wrong} onSelect={pick} />

      <div className="zone">
        {hintCell !== null && r.hint ? (
          <div className="bubble"><div className="bcat"><Cat id={r.hint.value} /></div><span>{r.hint.reason}</span></div>
        ) : !partner ? (
          <div className="muted" onClick={() => share(snap.room)}>Tap the room code to invite your partner 🐾</div>
        ) : null}
      </div>

      <div className="tools">
        <button className={'tool' + (notes ? ' on' : '')} onClick={() => setNotes(n => !n)}><span>✏️</span>Notes</button>
        <button className="tool" onClick={erase}><span>🧽</span>Erase</button>
        <button className="tool" disabled={!playing || p.hintsLeft <= 0} onClick={() => r.send({ type: 'hint' })}>
          <span>🔮</span>Wise Cat<em className="badge">{p.hintsLeft}</em>
        </button>
        <div className="reactwrap">
          <button className={'tool' + (reactOpen ? ' on' : '')} onClick={() => setReactOpen(o => !o)}><span>💗</span>React</button>
          {reactOpen && (
            <div className="reactpop">
              {EMOJI.map(e => <button key={e} onClick={() => { r.send({ type: 'react', emoji: e }); setReactOpen(false) }}>{e}</button>)}
            </div>
          )}
        </div>
      </div>

      <div className="palette">
        <div className="prow">{[1, 2, 3, 4, 5].map(cell)}</div>
        <div className="prow">{[6, 7, 8, 9].map(cell)}</div>
      </div>

      {p.status === 'won' && <Win snap={snap} onAgain={onAgain} />}
      {p.status === 'lost' && (
        <div className="overlay">
          <div className="sheet">
            <div className="bigcat"><Cat id={3} hiss /></div>
            <h2>The cats got grumpy 😾</h2>
            <p>Out of lives after {fmt(p.finishedAt - p.startedAt)}.</p>
            <button className="btn primary" onClick={() => r.send({ type: 'new', difficulty: p.difficulty || 'lion' })}>Try again</button>
            <button className="link" onClick={onAgain}>Change difficulty</button>
          </div>
        </div>
      )}
    </div>
  )
}

function Avatar({ pl }: { pl?: PlayerInfo }) {
  if (!pl) return <div className="avatar empty">?</div>
  return (
    <div className="avatar" style={{ background: pl.color }} title={pl.name}>
      {pl.name[0]?.toUpperCase()}
      <i className={'status' + (pl.online ? ' on' : '')} />
    </div>
  )
}

function Win({ snap, onAgain }: { snap: Snapshot; onAgain: () => void }) {
  const p = snap.puzzle
  const confetti = useMemo(() => Array.from({ length: 26 }, (_, i) => ({ i, x: Math.random() * 100, d: Math.random() * 1.5, s: 14 + Math.random() * 14 })), [])
  return (
    <div className="overlay">
      {confetti.map(c => <span key={c.i} className="paw" style={{ left: c.x + '%', animationDelay: c.d + 's', fontSize: c.s }}>🐾</span>)}
      <div className="sheet">
        <div className="dance">{CATS.map((c, i) => <div key={c.id} style={{ animationDelay: i * 0.08 + 's' }}><Cat id={c.id} /></div>)}</div>
        <h2>Purrfect! 🎉</h2>
        <p>{snap.players.map(x => x.name).join(' & ')} solved it</p>
        <p className="stats"><b>{fmt(p.finishedAt - p.startedAt)}</b> · {p.lives} ❤️ left</p>
        <button className="btn primary" onClick={onAgain}>Play again</button>
      </div>
    </div>
  )
}
