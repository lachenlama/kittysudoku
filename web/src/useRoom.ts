import { useCallback, useEffect, useRef, useState } from 'react'
import type { ClientMsg, Hint, ServerMsg, Snapshot } from './shared'

const WS_URL: string = import.meta.env.VITE_WS_URL || `ws://${location.hostname}:8787`

export function playerId() {
  try {
    let id = localStorage.getItem('kitty.pid')
    if (!id) { id = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('kitty.pid', id) }
    return id
  } catch { return 'anon' + Math.random().toString(36).slice(2) }
}

export type Reaction = { id: number; emoji: string; x: number }

export function useRoom() {
  const [conn, setConn] = useState<'idle' | 'connecting' | 'open' | 'down'>('idle')
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [hint, setHint] = useState<Hint | null>(null)
  const [wrong, setWrong] = useState<{ cell: number; value: number; n: number } | null>(null)
  const [reacts, setReacts] = useState<Reaction[]>([])
  const [error, setError] = useState('')
  const [off, setOff] = useState(0) // server clock - local clock
  const S = useRef({ ws: null as WebSocket | null, p: null as null | { room: string; name: string; color: string }, tries: 0, t: 0, started: -1, n: 0 })

  const connect = useCallback(() => {
    const s = S.current
    if (!s.p) return
    setConn('connecting')
    const ws = new WebSocket(WS_URL)
    s.ws = ws
    ws.onopen = () => {
      s.tries = 0
      setConn('open')
      const msg: ClientMsg = { type: 'join', room: s.p!.room || undefined, playerId: playerId(), name: s.p!.name, color: s.p!.color }
      ws.send(JSON.stringify(msg))
    }
    ws.onmessage = e => {
      let m: ServerMsg
      try { m = JSON.parse(e.data) } catch { return }
      if (m.type === 'state') {
        s.p!.room = m.room
        setSnap(m)
        setOff(m.now - Date.now())
        if (m.puzzle.startedAt !== s.started) { s.started = m.puzzle.startedAt; setHint(null) }
        if (new URLSearchParams(location.search).get('room') !== m.room) history.replaceState(null, '', '?room=' + m.room)
      } else if (m.type === 'hint') setHint(m)
      else if (m.type === 'wrong') {
        const n = ++s.n
        setWrong({ cell: m.cell, value: m.value, n })
        setTimeout(() => setWrong(w => (w && w.n === n ? null : w)), 600)
      } else if (m.type === 'react') {
        const r = { id: ++s.n, emoji: m.emoji, x: 12 + Math.random() * 70 }
        setReacts(a => [...a, r])
        setTimeout(() => setReacts(a => a.filter(x => x.id !== r.id)), 2400)
      } else if (m.type === 'error') {
        setError(m.message)
        if (m.fatal) {
          s.p = null; s.ws = null; ws.close()
          setSnap(null); setConn('idle')
          history.replaceState(null, '', location.pathname)
        }
      }
    }
    ws.onclose = () => {
      if (s.ws !== ws) return
      s.ws = null
      if (!s.p) return
      setConn('down')
      s.t = window.setTimeout(connect, Math.min(10000, 1000 * 2 ** s.tries++))
    }
  }, [])

  const join = useCallback((room: string, name: string, color: string) => {
    const s = S.current
    setError('')
    clearTimeout(s.t)
    if (s.ws) { const w = s.ws; s.ws = null; w.close() }
    s.p = { room, name, color }
    s.tries = 0
    connect()
  }, [connect])

  const leave = useCallback(() => {
    const s = S.current
    clearTimeout(s.t)
    s.p = null
    if (s.ws) { const w = s.ws; s.ws = null; w.close() }
    setSnap(null); setConn('idle'); setHint(null)
    history.replaceState(null, '', location.pathname)
  }, [])

  const send = useCallback((m: ClientMsg) => {
    const ws = S.current.ws
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m))
  }, [])

  // iOS suspends sockets in the background: reconnect right away when coming back
  useEffect(() => {
    const wake = () => {
      const s = S.current
      if (document.visibilityState === 'visible' && s.p && !s.ws) { clearTimeout(s.t); s.tries = 0; connect() }
    }
    document.addEventListener('visibilitychange', wake)
    window.addEventListener('online', wake)
    return () => { document.removeEventListener('visibilitychange', wake); window.removeEventListener('online', wake) }
  }, [connect])

  return { conn, snap, hint, wrong, reacts, error, off, join, leave, send }
}
