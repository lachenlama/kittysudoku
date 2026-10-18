import { useId, type ReactNode } from 'react'

// "Kawaii sticker" cats, shared geometry, per-cat palette. See docs/superpowers/specs/2026-10-19-kitty-v2-design.md
const HEAD = 'M50 26 C76 26 92 39 92 59 C92 80 73 91 50 91 C27 91 8 80 8 59 C8 39 24 26 50 26Z'
const EAR_L = 'M13 46 Q10 16 21 11 Q29 8 45 29 Z'
const EAR_R = 'M87 46 Q90 16 79 11 Q71 8 55 29 Z'
const NOSE = 'M46.5 65 Q50 63.8 53.5 65 Q53.5 67.2 50 69.5 Q46.5 67.2 46.5 65Z'
const HEART = 'M50 70.5 C45 67.5 45.5 63.5 48 63.5 C49.2 63.5 50 64.3 50 65.3 C50 64.3 50.8 63.5 52 63.5 C54.5 63.5 55 67.5 50 70.5Z'

type Spec = { fur: string; line: string; eye: string; dark?: boolean }
const P: Spec[] = [
  { fur: '', line: '', eye: '' },
  { fur: '#FFFFFF', line: '#C9BBB2', eye: '#6EC1FF' }, // Mochi
  { fur: '#FF9D3D', line: '#C9661A', eye: '#5A3B1E' }, // Biscuit
  { fur: '#2F2C38', line: '#15131A', eye: '#F2C94C', dark: true }, // Oreo
  { fur: '#FFFFFF', line: '#C9BBB2', eye: '#7A5634' }, // Patches
  { fur: '#8FA3BF', line: '#5F7391', eye: '#F2B84B' }, // Smokey
  { fur: '#211E29', line: '#0D0B11', eye: '#6FD08C', dark: true }, // Luna
  { fur: '#F6E7CF', line: '#B79C7A', eye: '#4C8DF0' }, // Tofu
  { fur: '#8B5E3C', line: '#5A3A22', eye: '#C9E265' }, // Tiger
  { fur: '#F7B6C8', line: '#D0809A', eye: '#7A3B52' }, // Peach
]
const INK = '#231A1E'

// Accessories, drawn in the same 100x100 space as the head (head top y=26, ears reach y~8). ids match HATS in shared.
const hs = { strokeLinejoin: 'round', strokeLinecap: 'round' } as const
const HAT_SVG: Record<string, ReactNode> = {
  bow: (
    <g transform="rotate(-16 20 31)" fill="#FF5C8A" stroke="#D93A68" strokeWidth="1.4" {...hs}>
      <path d="M20 31 L6 22 Q2 31 6 40Z" />
      <path d="M20 31 L34 22 Q38 31 34 40Z" />
      <circle cx="20" cy="31" r="4.3" fill="#FF86A8" />
    </g>
  ),
  flower: (
    <g {...hs}>
      <path d="M26 34 Q50 17 74 34" stroke="#4FAE62" strokeWidth="3.4" fill="none" />
      {[[33, 29.5, '#FF9EC0'], [50, 25.5, '#FFFFFF'], [67, 29.5, '#FF9EC0']].map(([x, y, c]) => (
        <g key={x as number}><circle cx={x as number} cy={y as number} r="5.4" fill={c as string} stroke="#E0709C" strokeWidth="1.2" /><circle cx={x as number} cy={y as number} r="2" fill="#FFD84D" /></g>
      ))}
    </g>
  ),
  party: (
    <g transform="rotate(9 50 30)" {...hs}>
      <path d="M36 31 L50 4 L64 31Z" fill="#7C9CFF" stroke="#4F6BD6" strokeWidth="1.6" />
      <path d="M42 21 L58 21 M39.5 27 L60.5 27" stroke="#FFD93D" strokeWidth="2.8" />
      <circle cx="50" cy="4.5" r="4" fill="#FF6F91" stroke="#D93A68" strokeWidth="1.2" />
    </g>
  ),
  glasses: (
    <g {...hs} stroke="#5B47D6" strokeWidth="2.8" fill="none">
      <circle cx="35" cy="59" r="11.5" fill="rgba(170,215,255,.28)" />
      <circle cx="65" cy="59" r="11.5" fill="rgba(170,215,255,.28)" />
      <path d="M46.5 57.5 Q50 54.5 53.5 57.5 M23.5 56 L9 51 M76.5 56 L91 51" />
    </g>
  ),
  witch: (
    <g {...hs} fill="#3B2F5E" stroke="#241A3F" strokeWidth="1.6">
      <path d="M36 29 Q43 14 47 7 Q50 2 57 4 Q52 8 55 16 Q59 23 64 29Z" />
      <ellipse cx="50" cy="29" rx="31" ry="6.5" />
      <path d="M39 23.5 Q50 28 61 23.5" stroke="#B48CFF" strokeWidth="4.4" fill="none" />
      <rect x="46" y="23" width="8" height="6" rx="1.5" fill="#F6C945" stroke="#C99A1F" strokeWidth="1.2" />
    </g>
  ),
  crown: (
    <g {...hs}>
      <path d="M33 32 L29 13 L41 22 L50 9 L59 22 L71 13 L67 32Z" fill="#F7C93B" stroke="#C99A1F" strokeWidth="1.8" />
      <circle cx="50" cy="26.5" r="2.6" fill="#E8423F" /><circle cx="39" cy="28" r="1.8" fill="#4FA8FF" /><circle cx="61" cy="28" r="1.8" fill="#4FA8FF" />
    </g>
  ),
  halo: (
    <g fill="none" {...hs}>
      <ellipse cx="50" cy="15" rx="15" ry="4.8" stroke="#FFF1A8" strokeWidth="7" opacity=".55" />
      <ellipse cx="50" cy="15" rx="15" ry="4.8" stroke="#F7C93B" strokeWidth="3.4" />
    </g>
  ),
  santa: (
    <g {...hs}>
      <path d="M27 31 Q27 12 47 9 Q67 6 79 24 L72 31Z" fill="#E8423F" stroke="#B02A2A" strokeWidth="1.6" />
      <rect x="23" y="26" width="54" height="9" rx="4.5" fill="#fff" stroke="#E2D6D0" strokeWidth="1.4" />
      <circle cx="79" cy="24" r="5.4" fill="#fff" stroke="#E2D6D0" strokeWidth="1.4" />
    </g>
  ),
}

export default function Cat({ id, hiss = false, hat = '' }: { id: number; hiss?: boolean; hat?: string }) {
  const clip = 'c' + useId().replace(/\W/g, '')
  const { fur, line, eye, dark } = P[id]
  const earL = id === 4 ? '#2F2C38' : id === 7 ? '#5B3D2E' : fur
  const earR = id === 7 ? '#5B3D2E' : fur
  const mask = id === 7 // siamese: dark face mask, so features turn light
  const light = dark || mask
  const mouth = id === 3 ? '#15131A' : light ? 'rgba(255,255,255,.85)' : line
  const whisk = light ? 'rgba(255,255,255,.6)' : line
  const inner = (c: string) => (c === '#2F2C38' || c === '#5B3D2E' || dark ? '#C98AA0' : id === 9 ? '#F08CA8' : '#FFB8C6')
  const sil = (p: object) => (
    <>
      <path d={EAR_L} {...p} />
      <path d={EAR_R} {...p} />
      <path d={HEAD} {...p} />
    </>
  )
  const stripe = (c: string, d: string) => <path d={d} stroke={c} strokeWidth="3.6" strokeLinecap="round" fill="none" />
  // chevron ink must read on the eye's surroundings (white on dark fur / dark patches)
  const chev = (left: boolean) => (light || (id === 4 && left) ? '#fff' : INK)

  return (
    <svg viewBox="0 0 100 100" className="cat" aria-hidden="true">
      <defs><clipPath id={clip}><path d={HEAD} /></clipPath></defs>
      {/* sticker rim, then outline, then fur */}
      <g fill="var(--sticker,#fff)" stroke="var(--sticker,#fff)" strokeWidth="10" strokeLinejoin="round">{sil({})}</g>
      <g fill={line} stroke={line} strokeWidth="5" strokeLinejoin="round">{sil({})}</g>
      <path d={EAR_L} fill={earL} />
      <path d={EAR_R} fill={earR} />
      <path d={HEAD} fill={fur} />

      <g clipPath={`url(#${clip})`}>
        {id === 2 && (
          <g>
            {stripe('#D9711F', 'M50 30 V41')}{stripe('#D9711F', 'M40 31.5 L42 40')}{stripe('#D9711F', 'M60 31.5 L58 40')}
            {stripe('#D9711F', 'M6 54 H19')}{stripe('#D9711F', 'M6 62 H17')}{stripe('#D9711F', 'M94 54 H81')}{stripe('#D9711F', 'M94 62 H83')}
          </g>
        )}
        {id === 3 && (
          <g fill="#fff">
            <path d="M44.5 26 H55.5 L54 46 Q50 54 46 46Z" />
            <ellipse cx="50" cy="72" rx="13" ry="9" />
          </g>
        )}
        {id === 4 && (
          <g>
            <ellipse cx="32" cy="56" rx="16" ry="15" fill="#2F2C38" />
            <ellipse cx="77" cy="36" rx="14" ry="10" fill="#E7A867" />
          </g>
        )}
        {id === 7 && <ellipse cx="50" cy="65" rx="26" ry="19" fill="#5B3D2E" />}
        {id === 8 && (
          <g stroke="#3E2716" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" fill="none">
            <path d="M42 41 V32 L50 38.5 L58 32 V41" />
            <path d="M6 48 L18 51 M6 56 L17 58 M94 48 L82 51 M94 56 L83 58" />
          </g>
        )}
        <ellipse cx="50" cy="84" rx="34" ry="10" fill={line} opacity=".1" />
      </g>
      {/* inner ears */}
      <path d={EAR_L} fill={inner(earL)} transform="translate(30 42) scale(.55) translate(-30 -42)" />
      <path d={EAR_R} fill={inner(earR)} transform="translate(70 42) scale(.55) translate(-70 -42)" />
      {id === 5 && (
        <g fill="#FF6F91" stroke="#E0527A" strokeWidth="1" strokeLinejoin="round">
          <path d="M80 32 L69 24 Q66 31 69 38Z" />
          <path d="M80 32 L91 24 Q94 31 91 38Z" />
          <circle cx="80" cy="32" r="4" />
        </g>
      )}
      {id === 6 && <path d="M52 32 A8.5 8.5 0 1 0 58.5 44 A7 7 0 1 1 52 32Z" fill="#F6D860" />}

      {/* face */}
      <ellipse cx="23" cy="70" rx="6.5" ry="3.6" fill="#FF8FA3" opacity={id === 9 ? 0.85 : 0.5} />
      <ellipse cx="77" cy="70" rx="6.5" ry="3.6" fill="#FF8FA3" opacity={id === 9 ? 0.85 : 0.5} />
      {hiss ? (
        <g fill="none" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M29 52 L41 59 L29 66" stroke={chev(true)} />
          <path d="M71 52 L59 59 L71 66" stroke={chev(false)} />
        </g>
      ) : (
        [35, 65].map(x => (
          <g key={x}>
            <ellipse cx={x} cy="59" rx="7.5" ry="8.5" fill={eye} />
            <ellipse cx={x} cy="59" rx="4" ry="6.5" fill={INK} />
            <circle cx={x + 2.6} cy="55.8" r="2.8" fill="#fff" />
            <circle cx={x - 2.4} cy="61.8" r="1.3" fill="#fff" />
          </g>
        ))
      )}
      <path d={id === 9 ? HEART : NOSE} fill={id === 9 ? '#FF4F7B' : '#FF8FA3'} stroke={id === 9 ? '#FF4F7B' : '#FF8FA3'} strokeWidth="1.2" strokeLinejoin="round" />
      {hiss ? (
        <g>
          <ellipse cx="50" cy="75" rx="5.5" ry="4.5" fill="#C0392B" />
          <path d="M45.8 71.2 H49 L47.4 74.6Z M51 71.2 H54.2 L52.6 74.6Z" fill="#fff" />
        </g>
      ) : (
        <path d="M43.5 71 Q46.75 75 50 71.5 Q53.25 75 56.5 71" stroke={mouth} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      )}
      <path d="M18 66 L6 64 M18 71 L6 73 M82 66 L94 64 M82 71 L94 73" stroke={whisk} strokeWidth="1.5" strokeLinecap="round" opacity={light ? 1 : 0.45} />
      {HAT_SVG[hat]}
    </svg>
  )
}
