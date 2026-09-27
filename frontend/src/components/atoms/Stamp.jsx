// Rubber-stamp label, slightly tilted (used for "+ New entry" and "Public").
const shapes = {
  pill: 'rounded-full px-5 py-2 text-sm',
  smallPill: 'rounded-full px-4 py-1.5 text-xs',
  box: 'rounded-md px-3 py-1.5 text-sm',
}

export default function Stamp({ children, shape = 'pill', className = '' }) {
  return (
    <span
      className={`inline-block -rotate-6 border-[1.5px] border-brand font-mono font-semibold uppercase tracking-widest text-brand ${shapes[shape]} ${className}`}
    >
      {children}
    </span>
  )
}
