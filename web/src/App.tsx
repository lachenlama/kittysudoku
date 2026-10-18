import { useEffect, useMemo, useRef, useState } from 'react'
import { CATS, HATS, PLAYER_COLORS, type Difficulty, type PlayerInfo, type Snapshot, type Variant } from './shared'
import { playerId, useRoom } from './useRoom'
import Board from './Board'
import Cat from './Cat'
import A2hs from './A2hs'

const ls = {
  get: (k: string, d = '') => { try { return localStorage.getItem('kitty.' + k) ?? d } catch { return d } },
  set: (k: string, v: string) => { try { localStorage.setItem('kitty.' + k, v) } catch { /* private mode */ } },
}
const DIFFS: { id: Difficulty; name: string; sub: [string, string]; cat: number }[] = [
  { id: 'lion', name: 'Lion', sub: ['Hard · 28 cats', 'Hard · 10 cats'], cat: 2 },
  { id: 'tiger', name: 'Tiger', sub: ['Expert · 25 cats', 'Expert · 4 cats'], cat: 8 },
  { id: 'panther', name: 'Panther', sub: ['Evil · fewest cats', 'Evil · fewest cats'], cat: 6 },
]
const VARIANTS: { id: Variant; label: string; name: string; tip: string }[] = [
  { id: 'classic', label: 'Classic', name: 'Classic Cats', tip: 'Rows, columns and boxes' },
  { id: 'diagonal', label: 'Diagonal', name: 'Diagonal Cats', tip: 'Both diagonals hold every cat too' },
  { id: 'cages', label: 'Fish Cages', name: 'Fish Cages', tip: 'Cats in a dashed cage add up to its number' },
]
type SheetId = 'closet' | 'love' | null
const EMOJI = ['💗', '😹', '🙀', '👏']
const fmt = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }
const DESKTOP = '(min-width: 900px) and (pointer: fine)'

function useDesktop() {
  const [d, setD] = useState(() => matchMedia(DESKTOP).matches)
  useEffect(() => {
    const m = matchMedia(DESKTOP), f = () => setD(m.matches)
    m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [])
  return d
}

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
  const desktop = useDesktop()
  const urlRoom = (new URLSearchParams(location.search).get('room') || '').toUpperCase()
  const [auto, setAuto] = useState(!!(urlRoom && ls.get('name')))
  useEffect(() => { if (auto) r.join(urlRoom, ls.get('name'), ls.get('color', PLAYER_COLORS[0])) }, []) // eslint-disable-line
  useEffect(() => { if (r.error) setAuto(false) }, [r.error])

  return (
    <div className={'app' + (desktop ? ' desk' : '')}>
      {r.snap ? (
        <Room snap={r.snap} me={me} r={r} desktop={desktop} />
      ) : auto ? (
        <div className="splash"><div className="bigcat"><Cat id={2} /></div><p>Finding your room…</p></div>
      ) : (
        <Home r={r} urlRoom={urlRoom} />
      )}
      {r.conn === 'down' && <div className="pill">Reconnecting…</div>}
    </div>
  )
}

function Home({ r, urlRoom }: { r: ReturnType<typeof useRoom>; urlRoom: string }) {
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
      <A2hs room={urlRoom} />
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
    </div>
  )
}

function Room({ snap, me, r, desktop }: { snap: Snapshot; me: string; r: ReturnType<typeof useRoom>; desktop: boolean }) {
  const p = snap.puzzle
  const [pk, setPk] = useState<number | null>(null) // startedAt when "play again" was pressed
  const [sheet, setSheet] = useState<SheetId>(null)
  const [hat, setHat] = useState(ls.get('hat')) // wanted hat; the server only honours it once the team has unlocked it
  const mine = snap.players.find(x => x.id === me)
  const wins = snap.team?.wins ?? 0
  useEffect(() => { if (hat !== (mine?.hat ?? '')) r.send({ type: 'equip', hat }) }, [hat, wins, snap.players.length, mine?.hat]) // eslint-disable-line
  const picking = p.status === 'lobby' || (pk !== null && p.startedAt === pk)
  return (
    <>
      {picking ? <Lobby snap={snap} me={me} r={r} open={setSheet} /> : <Game snap={snap} me={me} r={r} desktop={desktop} open={setSheet} onAgain={() => setPk(p.startedAt)} />}
      {sheet === 'closet' && <Closet wins={wins} cur={mine?.hat ?? ''} onPick={h => { ls.set('hat', h); setHat(h) }} onClose={() => setSheet(null)} />}
      {sheet === 'love' && <Love snap={snap} me={me} r={r} onClose={() => setSheet(null)} />}
      <div className="floats">
        {r.reacts.map(x => <span key={x.id} className="float" style={{ left: x.x + '%' }}>{x.emoji}</span>)}
      </div>
    </>
  )
}

function Lobby({ snap, me, r, open }: { snap: Snapshot; me: string; r: ReturnType<typeof useRoom>; open: (s: SheetId) => void }) {
  const partner = snap.players.find(x => x.id !== me)
  const t = snap.team
  const [variant, setVariant] = useState<Variant>(() => (VARIANTS.find(v => v.id === ls.get('variant'))?.id ?? 'classic'))
  const pickVariant = (v: Variant) => { setVariant(v); ls.set('variant', v) }
  const dv = VARIANTS.find(v => v.id === snap.daily.variant)!
  const cur = VARIANTS.find(v => v.id === variant)!
  return (
    <div className="lobby">
      <div className="ltop">
        <div className="roomcode" onClick={() => share(snap.room)}>
          <small>Room code</small><b>{snap.room}</b><span>Tap to invite 💌</span>
        </div>
        <p className="sub">{partner ? <>{partner.name} {partner.online ? 'is here' : 'is away'} <i className="dot" style={{ background: partner.color }} /></> : 'Waiting for your partner to join…'}</p>
      </div>
      <div className="lmid">
        <button className="daily" onClick={() => r.send({ type: 'daily' })}>
          <span className="moon">🌙</span>
          <span className="dtxt">
            <b>Daily Panther</b>
            <small>{t?.dailyDoneToday ? '✅ Done today — come back tomorrow' : 'Today: ' + dv.name}</small>
          </span>
          {!!t?.streak && <span className="streak">🔥 {t.streak}-day streak</span>}
        </button>
        <div className="seg" role="tablist">
          {VARIANTS.map(v => <button key={v.id} role="tab" aria-selected={v.id === variant} className={v.id === variant ? 'on' : ''} onClick={() => pickVariant(v.id)}>{v.label}</button>)}
        </div>
        <p className="tip">{cur.tip}</p>
        <div className="diffs">
          {DIFFS.map(d => {
            const best = t?.best[variant + '-' + d.id]
            return (
              <button key={d.id} className="diff" onClick={() => r.send({ type: 'new', difficulty: d.id, variant })}>
                <div className="dcat"><Cat id={d.cat} /></div>
                <div><b>{d.name}</b><small>{d.sub[variant === 'cages' ? 1 : 0]}</small></div>
                {best !== undefined && <em className="best">Best {fmt(best)}</em>}
              </button>
            )
          })}
        </div>
      </div>
      <div className="lbot">
        {t && <p className="wins">🏆 {t.wins} puzzle{t.wins === 1 ? '' : 's'} solved together</p>}
        <div className="lrow">
          <button className="tool" onClick={() => open('closet')}><span>👗</span>Closet</button>
          <button className="tool" onClick={() => open('love')}><span>💌</span>Note{snap.love.mine && <i className="ldot" />}</button>
        </div>
        <button className="link" onClick={r.leave}>Leave room</button>
      </div>
    </div>
  )
}

function Timer({ p, off }: { p: Snapshot['puzzle']; off: number }) {
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick(n => n + 1), 1000); return () => clearInterval(t) }, [])
  const end = p.status === 'playing' ? Date.now() + off : p.finishedAt
  return <span className="timer">{fmt(end - p.startedAt)}</span>
}

// Paw Pad geometry (px): keys 52, gap 6, padding 10, bottom row 42 => 184 x 236
const PAD_W = 184, PAD_H = 236, ARROW = 8
type Pad = { cell: number; x: number; y: number; ax: number; up: boolean; notes: boolean }

function Game({ snap, me, r, desktop, open, onAgain }: { snap: Snapshot; me: string; r: ReturnType<typeof useRoom>; desktop: boolean; open: (s: SheetId) => void; onAgain: () => void }) {
  const p = snap.puzzle
  const [sel, setSel] = useState<number | null>(null)
  const [hl, setHl] = useState(0)
  const [notes, setNotes] = useState(ls.get('notes') === '1') // sticky per device
  const [pad, setPad] = useState<Pad | null>(null)
  const [reactOpen, setReactOpen] = useState(false)
  const partner = snap.players.find(x => x.id !== me)
  const playing = p.status === 'playing'

  useEffect(() => { setSel(null); setHl(0); setPad(null) }, [p.startedAt])
  useEffect(() => { if (desktop || !playing) setPad(null) }, [desktop, playing])
  useEffect(() => {
    if (!pad) return
    const down = (e: PointerEvent) => { if (!(e.target as Element).closest('.pad, .board')) setPad(null) }
    const close = () => setPad(null)
    document.addEventListener('pointerdown', down)
    window.addEventListener('resize', close)
    return () => { document.removeEventListener('pointerdown', down); window.removeEventListener('resize', close) }
  }, [!pad]) // eslint-disable-line

  const setSelected = (n: number | null) => { setSel(n); setHl(0); r.send({ type: 'select', cell: n }) }
  const pick = (i: number, el: HTMLElement, long = false) => {
    if (sel === i && !long) { setSelected(null); setPad(null); return }
    setSelected(i)
    if (desktop || !playing || p.givens[i]) return setPad(null)
    const b = el.getBoundingClientRect(), cx = b.left + b.width / 2
    const top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sat')) || 0
    const up = b.top - PAD_H - ARROW >= top + 8
    const x = Math.min(Math.max(cx - PAD_W / 2, 8), innerWidth - PAD_W - 8)
    setPad({ cell: i, x, y: up ? b.top - PAD_H - ARROW : b.bottom + ARROW, ax: Math.min(Math.max(cx - x, 22), PAD_W - 22), up, notes: long || notes })
  }
  const toggleNotes = (on: boolean) => { setNotes(on); ls.set('notes', on ? '1' : '0') }

  const selVal = sel !== null ? p.board[sel] : 0
  const hv = selVal || (sel === null ? hl : 0)
  const counts = useMemo(() => { const c = Array(10).fill(0); p.board.forEach(v => c[v]++); return c }, [p.board])
  const hintCell = r.hint && !p.board[r.hint.cell] && playing ? r.hint.cell : null
  const canEdit = playing && sel !== null && !p.board[sel]

  const place = (v: number, asNote: boolean) => r.send({ type: asNote ? 'note' : 'place', cell: sel!, value: v })
  const erase = () => { if (playing && sel !== null && !p.givens[sel] && (p.board[sel] || p.notes[sel])) r.send({ type: 'erase', cell: sel }) }
  // desktop keypad / keyboard: act on the selection, else highlight that cat everywhere
  const key = (v: number, asNote: boolean) => {
    if (canEdit) place(v, asNote)
    else { setHl(h => (h === v && sel === null ? 0 : v)); if (sel !== null) setSelected(null) }
  }
  const hint = () => { if (playing && p.hintsLeft > 0) r.send({ type: 'hint' }) }

  const kb = useRef<(e: KeyboardEvent) => void>(() => {})
  kb.current = e => {
    if (e.ctrlKey || e.metaKey || e.altKey || (e.target as Element).closest?.('input,textarea')) return
    const d = /^(?:Digit|Numpad)(\d)$/.exec(e.code)?.[1]
    const k = e.key.toLowerCase()
    const mv = ({ arrowleft: -1, a: -1, arrowright: 1, d: 1, arrowup: -9, w: -9, arrowdown: 9, s: 9 } as Record<string, number>)[k]
    if (d && d !== '0') key(+d, e.shiftKey || notes)
    else if (d === '0' || k === 'backspace' || k === 'delete') erase()
    else if (k === 'n') toggleNotes(!notes)
    else if (k === 'h') hint()
    else if (k === 'escape') { setSelected(null); setHl(0) }
    else if (mv) {
      const c = sel ?? 40, to = c + mv
      if (sel === null) setSelected(40)
      else if (to >= 0 && to < 81 && (Math.abs(mv) === 9 || ((c / 9) | 0) === ((to / 9) | 0))) setSelected(to)
    } else return
    e.preventDefault()
  }
  useEffect(() => {
    if (!desktop) return
    const f = (e: KeyboardEvent) => kb.current(e)
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [desktop])

  const hearts = (
    <div className="hearts" aria-label={`${p.lives} lives`}>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i + (i < p.lives ? 'a' : 'b')} className={'heart' + (i < p.lives ? '' : ' lost')}>{i < p.lives ? '❤️' : '🤍'}</span>
      ))}
    </div>
  )
  const hintBtn = (
    <button className="tool" disabled={!playing || p.hintsLeft <= 0} onClick={hint}>
      <span>💡</span>Hint<em className="badge">{p.hintsLeft}</em>
    </button>
  )
  const reactBtn = (
    <div className="reactwrap">
      <button className={'tool' + (reactOpen ? ' on' : '')} onClick={() => setReactOpen(o => !o)}><span>💗</span>React</button>
      {reactOpen && (
        <div className="reactpop">
          {EMOJI.map(e => <button key={e} onClick={() => { r.send({ type: 'react', emoji: e }); setReactOpen(false) }}>{e}</button>)}
        </div>
      )}
    </div>
  )
  const board = (
    <>
      <Board p={p} players={snap.players} me={me} sel={sel} hv={hv} hintCell={hintCell} wrong={r.wrong} longPress={!desktop} onSelect={pick} />
      <div className="zone">
        {hintCell !== null && r.hint ? (
          <div className="bubble"><div className="bcat"><Cat id={r.hint.value} /></div><span>{r.hint.reason}</span></div>
        ) : !partner ? (
          <div className="muted" onClick={() => share(snap.room)}>Tap the room code to invite your partner 🐾</div>
        ) : snap.love.partnerWrote && playing ? (
          <div className="muted">💌 {partner.name} left you a note…</div>
        ) : null}
      </div>
    </>
  )
  const loveBtn = (
    <button className="iconbtn" onClick={() => open('love')} aria-label="Love note">💌{snap.love.mine && <i className="ldot" />}</button>
  )
  const chip = <button className="chip" onClick={() => share(snap.room)}>{snap.room}</button>

  return (
    <div className={'game' + (desktop ? ' desk' : '')}>
      {desktop ? (
        <>
          <header className="dhead">
            <span className="word">🐾 Kitty Sudoku</span>
            <span className="dright">{chip}<Timer p={p} off={r.off} /></span>
          </header>
          <div className="dmain">
            <div className="dleft">{board}</div>
            <aside className="side">
              {hearts}
              <ul className="plist">
                {snap.players.map(x => (
                  <li key={x.id}><i className="dot" style={{ background: x.color }} />{x.name}{x.id === me ? ' (you)' : ''}<em className={x.online ? 'on' : ''}>{x.online ? 'online' : 'away'}</em></li>
                ))}
              </ul>
              <div className="keypad">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(v => {
                  const left = 9 - counts[v]
                  return (
                    <div key={v} className="kcol">
                      <button className={'key' + (left <= 0 ? ' done' : '') + (hv === v ? ' on' : '')} disabled={left <= 0} onClick={() => key(v, notes)} aria-label={`${CATS[v - 1].name} (${v}), ${left} left`}>
                        <Cat id={v} /><b className="num">{v}</b>
                      </button>
                      <small>{left} left</small>
                    </div>
                  )
                })}
              </div>
              <div className="sbtns">
                <button className={'tool' + (notes ? ' on' : '')} onClick={() => toggleNotes(!notes)}><span>✏️</span>Notes</button>
                <button className="tool" onClick={erase}><span>🧽</span>Erase</button>
                {hintBtn}
                {reactBtn}
                <button className="tool wide" onClick={() => open('love')}><span>💌</span>Love note{snap.love.mine && <i className="ldot" />}</button>
              </div>
              <p className="legend"><b>1–9</b> place · <b>⇧ 1–9</b> note · <b>N</b> notes mode · <b>←↑↓→ / WASD</b> move · <b>⌫</b> erase · <b>H</b> hint · <b>Esc</b> deselect</p>
            </aside>
          </div>
        </>
      ) : (
        <>
          <div className="top">
            {chip}
            <Timer p={p} off={r.off} />
            {hearts}
            {loveBtn}
            <Avatar pl={partner} />
          </div>
          <div className="mid">{board}</div>
          <div className="tools">{hintBtn}{reactBtn}</div>
        </>
      )}

      {pad && (
        <div className={'pad ' + (pad.up ? 'up' : 'down')} style={{ left: pad.x, top: pad.y, width: PAD_W, height: PAD_H, '--ax': pad.ax + 'px' } as React.CSSProperties} role="dialog" aria-label="Paw Pad">
          <div className="pkeys">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(v => {
              const done = !pad.notes && counts[v] >= 9
              return (
                <button key={v} className={'pkey' + (done ? ' done' : '')} disabled={done || !!p.board[pad.cell]} aria-label={`${CATS[v - 1].name} (${v})`}
                  onClick={() => { place(v, pad.notes); if (!pad.notes) setPad(null) }}>
                  <Cat id={v} /><b className="num">{v}</b>
                </button>
              )
            })}
          </div>
          <div className="prow2">
            <button className={'ptool' + (pad.notes ? ' on' : '')} onClick={() => { toggleNotes(!pad.notes); setPad({ ...pad, notes: !pad.notes }) }}>✏️ Notes</button>
            <button className="ptool" disabled={!(p.board[pad.cell] || p.notes[pad.cell])} onClick={() => { erase(); setPad(null) }}>🧽 Erase</button>
          </div>
        </div>
      )}

      {p.status === 'won' && <Win snap={snap} me={me} onAgain={onAgain} />}
      {p.status === 'lost' && (
        <div className="overlay">
          <div className="sheet">
            <div className="bigcat"><Cat id={3} hiss /></div>
            <h2>The cats got grumpy 😾</h2>
            <p>Out of lives after {fmt(p.finishedAt - p.startedAt)}.</p>
            <button className="btn primary" onClick={() => r.send(p.daily ? { type: 'daily' } : { type: 'new', difficulty: p.difficulty || 'lion', variant: p.variant })}>Try again</button>
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

function Win({ snap, me, onAgain }: { snap: Snapshot; me: string; onAgain: () => void }) {
  const p = snap.puzzle, w = snap.win, t = snap.team
  const confetti = useMemo(() => Array.from({ length: 26 }, (_, i) => ({ i, x: Math.random() * 100, d: Math.random() * 1.5, s: 14 + Math.random() * 14 })), [])
  const from = snap.players.find(x => x.id !== me)
  const hat = HATS.find(h => h.id === w?.hat)
  return (
    <div className="overlay">
      {confetti.map(c => <span key={c.i} className="paw" style={{ left: c.x + '%', animationDelay: c.d + 's', fontSize: c.s }}>🐾</span>)}
      <div className="sheet win">
        <div className="dance">{CATS.map((c, i) => <div key={c.id} style={{ animationDelay: i * 0.08 + 's' }}><Cat id={c.id} /></div>)}</div>
        <h2>Purrfect! 🎉</h2>
        <p>{snap.players.map(x => x.name).join(' & ')} solved it</p>
        <p className="stats"><b>{fmt(p.finishedAt - p.startedAt)}</b> · {p.lives} ❤️ left</p>
        {w?.streakUp && t && <p className="perk">🔥 streak +1! {t.streak} day{t.streak === 1 ? '' : 's'} in a row</p>}
        {w?.newBest && <p className="perk">⏱️ New best time!</p>}
        {hat && <p className="perk">🎁 New in the closet: {hat.name}!</p>}
        {snap.love.partner && from && <Envelope from={from.name} text={snap.love.partner} />}
        <button className="btn primary" onClick={onAgain}>Play again</button>
      </div>
    </div>
  )
}

function Envelope({ from, text }: { from: string; text: string }) {
  const [open, setOpen] = useState(false)
  useEffect(() => { const t = setTimeout(() => setOpen(true), 900); return () => clearTimeout(t) }, [])
  return (
    <div className={'envwrap' + (open ? ' open' : '')}>
      <button className="env" onClick={() => setOpen(o => !o)} aria-label={'Note from ' + from}>
        <i className="eflap" /><i className="ebody" /><span className="eheart">💗</span>
      </button>
      <div className="paper"><div><small>A note from {from}</small><p>{text}</p></div></div>
    </div>
  )
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="overlay sheetwrap" onClick={onClose}>
      <div className="bsheet" onClick={e => e.stopPropagation()} role="dialog" aria-label={title}>
        <h2>{title}</h2>
        {children}
        <button className="link" onClick={onClose}>Close</button>
      </div>
    </div>
  )
}

const CLOSET_CATS = [1, 2, 4, 7, 9, 5, 8, 3]
function Closet({ wins, cur, onPick, onClose }: { wins: number; cur: string; onPick: (h: string) => void; onClose: () => void }) {
  return (
    <Sheet title="👗 Cat closet" onClose={onClose}>
      <p className="tip">Win puzzles together to unlock outfits. Your cats wear it on the board!</p>
      <div className="closet">
        {HATS.map((h, i) => {
          const locked = wins < h.wins
          return (
            <button key={h.id} className={'hatt' + (cur === h.id ? ' on' : '') + (locked ? ' locked' : '')} disabled={locked} onClick={() => onPick(h.id)}>
              <div className="hcat"><Cat id={CLOSET_CATS[i]} hat={h.id} /></div>
              <b>{h.name}</b>
              <small>{locked ? `Win ${h.wins} puzzle${h.wins === 1 ? '' : 's'}` : h.emoji}</small>
            </button>
          )
        })}
      </div>
      <button className={'btn' + (cur === '' ? ' primary' : '')} onClick={() => onPick('')}>No outfit</button>
    </Sheet>
  )
}

function Love({ snap, me, r, onClose }: { snap: Snapshot; me: string; r: ReturnType<typeof useRoom>; onClose: () => void }) {
  const partner = snap.players.find(x => x.id !== me)
  const [text, setText] = useState(snap.love.mine)
  const save = (t: string) => { r.send({ type: 'love', text: t }); onClose() }
  return (
    <Sheet title="💌 Love note" onClose={onClose}>
      <p className="tip">Leave a note for {partner?.name ?? 'your partner'} — they'll see it when you solve this one</p>
      <textarea value={text} maxLength={140} rows={3} placeholder="You're my favorite cat…" onChange={e => setText(e.target.value)} />
      <small className="count">{text.length}/140</small>
      <button className="btn primary" onClick={() => save(text)}>{text.trim() ? 'Save note' : 'Clear note'}</button>
      {snap.love.mine && <button className="link" onClick={() => save('')}>Remove my note</button>}
    </Sheet>
  )
}
