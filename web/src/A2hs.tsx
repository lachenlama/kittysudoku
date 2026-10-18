import { useEffect, useState } from 'react'
import Cat from './Cat'

type BIPEvent = Event & { prompt: () => Promise<unknown> }
// beforeinstallprompt can fire before React mounts, so catch it at module load
let deferred: BIPEvent | null = null
const listeners = new Set<() => void>()
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e as BIPEvent; listeners.forEach(f => f()) })

const ua = navigator.userAgent
const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const notSafari = /CriOS|FxiOS|EdgiOS|OPiOS|FBAN|FBAV|FB_IAB|Instagram|Line\/|WhatsApp|MicroMessenger|Snapchat|TikTok|Twitter|GSA\//.test(ua)
const standalone = (navigator as unknown as { standalone?: boolean }).standalone || matchMedia('(display-mode: standalone)').matches
const SKIP = 'kitty.skipA2hs'
const skipped = () => { try { return sessionStorage.getItem(SKIP) === '1' } catch { return false } }

const Share = () => (
  <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#2F7BF5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Share">
    <path d="M12 15V3M8 7l4-4 4 4M8 10H7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1" />
  </svg>
)
const Plus = () => (
  <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" aria-label="Add">
    <rect x="3.5" y="3.5" width="17" height="17" rx="4" /><path d="M12 8v8M8 12h8" />
  </svg>
)

export default function A2hs({ room }: { room: string }) {
  const [, rerender] = useState(0)
  const [hidden, setHidden] = useState(skipped())
  const [sheet, setSheet] = useState(false)
  const [copied, setCopied] = useState(false)
  useEffect(() => { const f = () => rerender(n => n + 1); listeners.add(f); return () => { listeners.delete(f) } }, [])
  const skip = () => { try { sessionStorage.setItem(SKIP, '1') } catch { /* private mode */ } setHidden(true) }

  if (standalone || hidden) return null
  const mode = ios ? (notSafari ? 'safari' : 'ios') : deferred ? 'install' : null
  if (!mode) return null // desktop Safari / others: no reliable install path

  const act = async () => {
    if (mode === 'ios') setSheet(true)
    else if (mode === 'install') { await deferred!.prompt(); deferred = null; rerender(n => n + 1) }
    else { try { await navigator.clipboard.writeText(location.href); setCopied(true) } catch { /* ignore */ } }
  }
  const label = mode === 'install' ? 'Install Kitty' : mode === 'safari' ? (copied ? 'Link copied!' : 'Copy link') : room ? 'Add to Home Screen first' : 'Show me how'
  return (
    <>
      <div className="a2card">
        {room && <div className="a2room">Room <b>{room}</b></div>}
        <p>{mode === 'safari' ? <>📲 <b>Open this page in Safari</b> to add Kitty to your Home Screen</> : <>📲 <b>Add Kitty to your Home Screen</b> — full screen, no browser bars</>}</p>
        <button className="btn primary" onClick={act}>{label}</button>
        <button className="link" onClick={skip}>{room && mode === 'ios' ? 'Just play in Safari' : 'Skip, play in browser'}</button>
      </div>
      {sheet && (
        <div className="overlay sheetwrap" onClick={() => setSheet(false)}>
          <div className="bsheet" onClick={e => e.stopPropagation()}>
            <h2>Add Kitty to Home Screen</h2>
            <ol className="steps">
              <li><i><Share /></i><span>Tap the <b>Share</b> icon in Safari&rsquo;s toolbar</span></li>
              <li><i><Plus /></i><span>Scroll down and tap <b>Add to Home Screen</b></span></li>
              <li><i className="sc"><Cat id={2} /></i><span>Open <b>Kitty</b> from your Home Screen</span></li>
            </ol>
            {room && <div className="a2room">Then enter code <b>{room}</b></div>}
            <button className="btn primary" onClick={() => setSheet(false)}>Got it</button>
          </div>
        </div>
      )}
    </>
  )
}
