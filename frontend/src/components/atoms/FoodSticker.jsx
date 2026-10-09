// Small vector stickers stay crisp at any size and match the journal's drawn artwork.
export default function FoodSticker({ kind = 'bowl', className = '' }) {
  return <span className={`food-sticker food-sticker-${kind} ${className}`} aria-hidden="true">
    <svg viewBox="0 0 160 160" fill="none" strokeLinecap="round" strokeLinejoin="round">
      {kind === 'bowl' && <>
        <path d="M20 73h120c-5 44-24 64-60 64S25 117 20 73Z" fill="#c66350" stroke="#fffaf0" strokeWidth="13" />
        <path d="M20 73h120c-5 44-24 64-60 64S25 117 20 73Z" stroke="#69392f" strokeWidth="2.5" />
        <ellipse cx="80" cy="73" rx="60" ry="17" fill="#eacb88" stroke="#69392f" strokeWidth="2.5" />
        <path d="M37 73c8-14 14 13 22-2s14 13 23-2 14 13 23-2 12 5 19 3" stroke="#ae7742" strokeWidth="3" />
        <path d="m72 64 40-45m-29 45 47-38" stroke="#fffaf0" strokeWidth="11" /><path d="m72 64 40-45m-29 45 47-38" stroke="#63492e" strokeWidth="4" />
        <path d="M60 108q20 22 40 0" stroke="#542e2b" strokeWidth="3" /><path d="M58 99v2m44-2v2" stroke="#542e2b" strokeWidth="5" />
        <path d="M40 48c-10-10 10-13 0-23m15 20c-8-9 8-12 0-21" stroke="#7c8872" strokeWidth="3" />
      </>}
      {kind === 'coffee' && <>
        <path d="M38 48h76v11h10c31 0 31 46 0 46h-14c-6 19-18 28-35 28-24 0-37-17-37-42Z" fill="#aac6ca" stroke="#fffaf0" strokeWidth="13" />
        <path d="M111 67h12c20 0 20 29 0 29h-12" stroke="#48656b" strokeWidth="6" /><path d="M38 48h76v43c0 25-14 42-39 42S38 117 38 91Z" fill="#aac6ca" stroke="#48656b" strokeWidth="2.5" />
        <ellipse cx="76" cy="49" rx="38" ry="10" fill="#76533d" stroke="#48656b" strokeWidth="2.5" /><path d="M65 85c-12-13-23 5 10 22 32-19 20-35 8-22l-8 8Z" fill="#fff6dd" stroke="#fff6dd" strokeWidth="2" />
        <path d="M59 29c-9-11 10-12 0-23m25 23c-9-11 10-12 0-23" stroke="#718b80" strokeWidth="3" />
        <path d="M27 140h96" stroke="#fffaf0" strokeWidth="10" /><path d="M27 140h96" stroke="#48656b" strokeWidth="3" />
      </>}
      {kind === 'cherry' && <>
        <path d="M43 103c10-29 20-53 56-71m-2 2c-5 35 5 55 16 72" stroke="#fffaf0" strokeWidth="12" /><path d="M43 103c10-29 20-53 56-71m-2 2c-5 35 5 55 16 72" stroke="#587046" strokeWidth="4" />
        <path d="M94 37C60 44 61 9 103 21Z" fill="#879b6d" stroke="#fffaf0" strokeWidth="7" />
        <circle cx="44" cy="112" r="28" fill="#bd4e55" stroke="#fffaf0" strokeWidth="8" /><circle cx="112" cy="116" r="29" fill="#aa4149" stroke="#fffaf0" strokeWidth="8" />
        <path d="M28 103q2-10 13-11m53 15q2-10 13-11" stroke="#f7c4b2" strokeWidth="5" />
      </>}
      {kind === 'star' && <><path d="m80 9 18 43 47 4-36 31 11 47-40-25-40 25 11-47L15 56l47-4Z" fill="#e7bd66" stroke="#fffaf0" strokeWidth="9" /><path d="M61 74v4m38-4v4M67 92q13 15 26 0" stroke="#795731" strokeWidth="4" /></>}
    </svg>
  </span>
}
