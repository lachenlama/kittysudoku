import { useRef, type CSSProperties } from 'react'
import { CATS, type PlayerInfo, type PuzzleState } from './shared'
import Cat from './Cat'

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
  return (
    <div className="board">
      {p.board.map((v, i) => {
        const r = (i / 9) | 0, c = i % 9
        const peer = sel !== null && (r === sr || c === sc || (((r / 3) | 0) === ((sr / 3) | 0) && ((c / 3) | 0) === ((sc / 3) | 0)))
        const isWrong = wrong?.cell === i
        const cls = ['cell']
        if (c % 3 === 2 && c < 8) cls.push('bR')
        if (r % 3 === 2 && r < 8) cls.push('bB')
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
            {isWrong ? (
              <span className="face pop"><Cat id={wrong!.value} hiss /></span>
            ) : v ? (
              <>
                <span className={'face' + (p.givens[i] ? '' : ' pop')} key={v}><Cat id={v} /></span>
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
    </div>
  )
}
