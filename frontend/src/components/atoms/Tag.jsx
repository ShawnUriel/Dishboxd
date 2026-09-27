// Little red flag pinned to the corner of a catalog card ("ON FILE").
export default function Tag({ children }) {
  return (
    <span className="absolute -top-2 right-5 rotate-2 rounded-sm bg-brand px-3 py-1 font-mono text-xs font-semibold uppercase tracking-widest text-white shadow-sm">
      {children}
    </span>
  )
}
