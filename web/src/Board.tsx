import type { CSSProperties } from 'react'
import { CATS, type PlayerInfo, type PuzzleState } from './shared'
import Cat from './Cat'

type Props = {
  p: PuzzleState
  players: PlayerInfo[]
  me: string
  sel: number | null
  hv: number // cat value to ring everywhere (0 = none)
  showNumbers: boolean
  hintCell: number | null
  wrong: { cell: number; value: number } | null
  onSelect: (i: number) => void
}

export default function Board({ p, players, me, sel, hv, showNumbers, hintCell, wrong, onSelect }: Props) {
  const partner = players.find(x => x.id !== me && x.online && x.selected !== null)
  const color = (id: string) => players.find(x => x.id === id)?.color
  const sr = sel === null ? -1 : (sel / 9) | 0
  const sc = sel === null ? -1 : sel % 9
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
        const dot = !p.givens[i] && v ? color(p.by[i]) : undefined
        const pt = partner && partner.selected === i ? partner : null
        const nm = p.notes[i]
        return (
          <button
            key={i}
            className={cls.join(' ')}
            style={pt ? ({ '--pc': pt.color } as CSSProperties) : undefined}
            onClick={() => onSelect(i)}
            aria-label={`row ${r + 1} column ${c + 1}${v ? ', ' + CATS[v - 1].name : ''}`}
          >
            {pt && <span className="tag" style={{ background: pt.color }}>{pt.name}</span>}
            {pt && <span className="pglow" />}
            {isWrong ? (
              <span className="face pop"><Cat id={wrong!.value} hiss /></span>
            ) : v ? (
              <span className={'face' + (p.givens[i] ? '' : ' pop')} key={v}><Cat id={v} /></span>
            ) : nm ? (
              <span className="notes">
                {CATS.map(k => (
                  <i key={k.id} style={nm & (1 << (k.id - 1)) ? { background: k.color } : undefined} className={nm & (1 << (k.id - 1)) ? 'on' : ''}>
                    {showNumbers && nm & (1 << (k.id - 1)) ? k.id : ''}
                  </i>
                ))}
              </span>
            ) : null}
            {showNumbers && v && !isWrong ? <b className="num">{v}</b> : null}
            {dot && <span className="pdot" style={{ background: dot }} />}
          </button>
        )
      })}
    </div>
  )
}
