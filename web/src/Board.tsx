import { useMemo, useRef, type CSSProperties } from 'react'
import { CATS, type Cage, type PlayerInfo, type PuzzleState } from './shared'
import Cat from './Cat'

const D = 0.075 // dashed cage line inset, in cell units (~3 px on a phone, ~5 px on desktop)
/** Dashed outline of every cage as SVG path data in cell units (board = 9x9), inset D inside the cage. */
function cagePath(cages: Cage[]): string {
  const own: number[] = Array(81).fill(-1)
  cages.forEach((c, k) => c.cells.forEach(i => (own[i] = k)))
  const at = (r: number, c: number) => (r < 0 || c < 0 || r > 8 || c > 8 ? -2 : own[r * 9 + c])
  let d = ''
  for (let i = 0; i < 81; i++) {
    const r = (i / 9) | 0, c = i % 9, k = own[i]
    for (const [nr, nc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      if (at(r + nr, c + nc) === k) continue
      const tr = nr ? 0 : 1, tc = nr ? 1 : 0 // tangent along the edge
      // end offsets: convex corner pulls in by D, concave pushes out by D, straight continues
      const off = (sgn: number) => {
        const ar = r + sgn * tr, ac = c + sgn * tc
        return at(ar, ac) !== k ? D : at(ar + nr, ac + nc) === k ? -D : 0
      }
      const a = off(-1), b = off(1)
      const line = nr ? r + (nr < 0 ? D : 1 - D) : c + (nc < 0 ? D : 1 - D)
      const s = nr ? c : r
      const [x0, y0, x1, y1] = nr ? [s + a, line, s + 1 - b, line] : [line, s + a, line, s + 1 - b]
      d += `M${x0.toFixed(3)} ${y0.toFixed(3)}L${x1.toFixed(3)} ${y1.toFixed(3)}`
    }
  }
  return d
}

type Props = {
  p: PuzzleState
  players: PlayerInfo[]
  me: string
  sel: number | null
  hv: number // cat value to ring everywhere (0 = none)
  hintCell: number | null
  wrong: { cell: number; value: number } | null
  longPress: boolean // phone: 450 ms press opens the Paw Pad in notes mode
  onSelect: (i: number, el: HTMLElement, long?: boolean) => void
}

export default function Board({ p, players, me, sel, hv, hintCell, wrong, longPress, onSelect }: Props) {
  const lp = useRef({ t: 0, fired: false })
  const partner = players.find(x => x.id !== me && x.online && x.selected !== null)
  const color = (id: string) => players.find(x => x.id === id)?.color
  const sr = sel === null ? -1 : (sel / 9) | 0
  const sc = sel === null ? -1 : sel % 9
  const stop = () => clearTimeout(lp.current.t)
  const hat = (id: string) => players.find(x => x.id === id)?.hat || ''
  const cageD = useMemo(() => (p.cages ? cagePath(p.cages) : ''), [p.cages])
  const sums = useMemo(() => new Map((p.cages ?? []).map(c => [Math.min(...c.cells), c.sum])), [p.cages])
  return (
    <div className={'board v-' + p.variant}>
      {p.board.map((v, i) => {
        const r = (i / 9) | 0, c = i % 9
        const peer = sel !== null && (r === sr || c === sc || (((r / 3) | 0) === ((sr / 3) | 0) && ((c / 3) | 0) === ((sc / 3) | 0)))
        const isWrong = wrong?.cell === i
        const cls = ['cell']
        if (c % 3 === 2 && c < 8) cls.push('bR')
        if (r % 3 === 2 && r < 8) cls.push('bB')
        if (p.variant === 'diagonal' && (r === c || r + c === 8)) cls.push('dg')
        if (sums.has(i)) cls.push('hassum')
        if (p.givens[i]) cls.push('given')
        if (peer) cls.push('peer')
        if (hv && v === hv) cls.push('same')
        if (i === sel) cls.push('sel')
        if (i === hintCell) cls.push('hint')
        if (isWrong) cls.push('shake')
        const pt = partner && partner.selected === i ? partner : null
        const nm = p.notes[i]
        return (
          <button
            key={i}
            className={cls.join(' ')}
            style={pt ? ({ '--pc': pt.color } as CSSProperties) : undefined}
            onPointerDown={e => {
              lp.current.fired = false
              stop()
              const el = e.currentTarget
              if (longPress && !p.givens[i]) lp.current.t = window.setTimeout(() => { lp.current.fired = true; onSelect(i, el, true) }, 450)
            }}
            onPointerUp={stop}
            onPointerLeave={stop}
            onPointerCancel={stop}
            onContextMenu={e => e.preventDefault()}
            onClick={e => { if (lp.current.fired) lp.current.fired = false; else onSelect(i, e.currentTarget) }}
            aria-label={`row ${r + 1} column ${c + 1}${v ? ', ' + CATS[v - 1].name + ' ' + v : ''}`}
          >
            {pt && <span className="tag" style={{ background: pt.color }}>{pt.name}</span>}
            {pt && <span className="pglow" />}
            {sums.has(i) && <span className="csum">{sums.get(i)}</span>}
            {isWrong ? (
              <span className="face pop"><Cat id={wrong!.value} hiss /></span>
            ) : v ? (
              <>
                <span className={'face' + (p.givens[i] ? '' : ' pop')} key={v}><Cat id={v} hat={p.givens[i] ? '' : hat(p.by[i])} /></span>
                <b className={'num' + (p.givens[i] ? '' : ' pl')} style={p.givens[i] ? undefined : { background: color(p.by[i]) || '#ddd' }}>{v}</b>
              </>
            ) : nm ? (
              <span className="notes">
                {CATS.map(k => {
                  const on = nm & (1 << (k.id - 1))
                  return <i key={k.id} style={on ? { color: `color-mix(in srgb, ${k.color} 55%, var(--ink))` } : undefined}>{on ? k.id : ''}</i>
                })}
              </span>
            ) : null}
          </button>
        )
      })}
      {p.variant === 'diagonal' && (
        <svg className="ov" viewBox="0 0 9 9" preserveAspectRatio="none" aria-hidden="true"><path className="dline" d="M0 0L9 9M9 0L0 9" /></svg>
      )}
      {cageD && <svg className="ov" viewBox="0 0 9 9" preserveAspectRatio="none" aria-hidden="true"><path className="cline" d={cageD} /></svg>}
    </div>
  )
}
