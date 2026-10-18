const HEAD = ['', '#FFFFFF', '#F4A261', '#3C3A47', '#FFFFFF', '#A5ABB8', '#2E2B36', '#F6E7CF', '#B88B5E', '#FFB36B']
const EYE = ['', '#5BA8E8', '#4A3A35', '#E8C547', '#8B5E34', '#E0A526', '#6FD08C', '#4C8DF0', '#C79A2E', '#3B2F2A']
const DARK = [false, false, false, true, false, false, true, false, false, false]
const STROKE = 'rgba(74,58,53,.18)'

export default function Cat({ id, hiss = false }: { id: number; hiss?: boolean }) {
  const head = HEAD[id]
  const dark = DARK[id]
  const earL = id === 4 ? '#F4A261' : id === 7 ? '#7A5C4A' : head
  const earR = id === 4 ? '#3C3A47' : earL
  const inner = dark ? '#C98AA0' : '#FFB8C6'
  const whisk = dark ? 'rgba(255,255,255,.75)' : '#B8A89E'
  const eyeInk = dark || id === 7 ? '#fff' : '#3B2F2A'
  return (
    <svg viewBox="0 0 100 100" className="cat" aria-hidden="true">
      <polygon points="16,48 18,8 48,26" fill={earL} stroke={STROKE} strokeWidth="1.5" strokeLinejoin="round" />
      <polygon points="84,48 82,8 52,26" fill={earR} stroke={STROKE} strokeWidth="1.5" strokeLinejoin="round" />
      <polygon points="24,40 25,19 40,29" fill={inner} />
      <polygon points="76,40 75,19 60,29" fill={inner} />
      <defs><clipPath id="catclip"><circle cx="50" cy="58" r="36" /></clipPath></defs>
      <circle cx="50" cy="58" r="36" fill={head} stroke={STROKE} strokeWidth="1.5" />
      {id === 2 && <g stroke="#D9772B" strokeWidth="4" strokeLinecap="round"><path d="M50 26V38M42 28L44 38M58 28L56 38" /><path d="M16 58H25M16 66H25M84 58H75M84 66H75" /></g>}
      {id === 3 && <g fill="#fff"><ellipse cx="50" cy="71" rx="17" ry="13" /><path d="M50 24L43 54H57Z" /></g>}
      {id === 4 && <g clipPath="url(#catclip)"><ellipse cx="29" cy="40" rx="22" ry="18" fill="#F4A261" /><ellipse cx="78" cy="68" rx="16" ry="15" fill="#3C3A47" /></g>}
      {id === 6 && <path d="M50 28a6 6 0 1 0 5 8a5 5 0 1 1-5-8z" fill="#F6D860" />}
      {id === 7 && <ellipse cx="50" cy="64" rx="20" ry="19" fill="#8A6A55" />}
      {id === 8 && <g stroke="#5B4030" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none"><path d="M38 42L42 29L50 37L58 29L62 42" /><path d="M16 56L26 59M16 66L26 65M84 56L74 59M84 66L74 65" /></g>}
      {id === 9 && <g fill="#FF8FA3" opacity=".55"><circle cx="29" cy="68" r="5.5" /><circle cx="71" cy="68" r="5.5" /></g>}
      {hiss ? (
        <>
          <path d="M30 49L44 56L30 63M70 49L56 56L70 63" stroke={eyeInk} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <ellipse cx="50" cy="76" rx="8" ry="7" fill="#C0392B" />
          <polygon points="44,71 48,71 46,77" fill="#fff" /><polygon points="56,71 52,71 54,77" fill="#fff" />
        </>
      ) : (
        <>
          {[37, 63].map(x => (
            <g key={x}>
              <ellipse cx={x} cy="56" rx="5.5" ry="6.5" fill={EYE[id]} />
              <ellipse cx={x} cy="56" rx="2.6" ry="5" fill="#1d1717" />
              <circle cx={x + 1.8} cy="53.5" r="1.8" fill="#fff" />
            </g>
          ))}
          {id === 9
            ? <path d="M50 70C43 65 43 60 47.5 60C49.3 60 50 61.2 50 62C50 61.2 50.7 60 52.5 60C57 60 57 65 50 70Z" fill="#FF4F7B" />
            : <polygon points="46,62 54,62 50,67.5" fill="#FF8FA3" stroke="#FF8FA3" strokeWidth="1.5" strokeLinejoin="round" />}
          <path d="M50 68Q46 74 41 71M50 68Q54 74 59 71" stroke={dark || id === 7 ? '#fff' : '#5a4540'} strokeWidth="1.8" strokeLinecap="round" fill="none" opacity={dark || id === 7 ? 0.8 : 1} />
        </>
      )}
      {id === 5 && <g transform="translate(76 28)"><polygon points="0,0 -11,-8 -11,8" fill="#FF6F91" /><polygon points="0,0 11,-8 11,8" fill="#FF6F91" /><circle r="4" fill="#E0527A" /></g>}
      <path d="M26 64L7 60M26 70L8 73M74 64L93 60M74 70L92 73" stroke={whisk} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
