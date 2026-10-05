// Small label for a restaurant's category ("Matcha bar"). Nothing when it has none.
export default function CategoryTag({ category, className = '' }) {
  if (!category?.trim()) return null
  return (
    <span
      className={`inline-block max-w-full truncate rounded-sm border border-accent/30 bg-accent/5 px-2 py-0.5 align-middle text-[10px] font-medium uppercase tracking-wider text-accent ${className}`}
    >
      {category}
    </span>
  )
}
