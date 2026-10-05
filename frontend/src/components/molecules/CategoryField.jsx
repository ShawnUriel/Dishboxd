import { useId } from 'react'
import { CATEGORY_SUGGESTIONS, QUICK_CATEGORIES } from '../../lib/categories.js'

// Pick a category with one tap, or type any other ("Samgyupsal", "Matcha bar"...).
export default function CategoryField({ value, onChange, label = 'Category', hint }) {
  const id = useId()
  const listId = `${id}-suggestions`
  const quick = value && !QUICK_CATEGORIES.includes(value) ? [value, ...QUICK_CATEGORIES] : QUICK_CATEGORIES
  return (
    <div>
      <label htmlFor={id} className="font-mono text-xs uppercase tracking-widest text-muted">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        maxLength={40}
        list={listId}
        autoComplete="off"
        placeholder="Cafe, matcha bar, Italian…"
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full border-b border-dotted border-muted bg-transparent py-1.5 font-mono text-base text-ink placeholder:text-faint focus:border-solid focus:border-brand focus:outline-none"
      />
      <datalist id={listId}>
        {CATEGORY_SUGGESTIONS.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      {hint && <p className="mt-1 font-mono text-xs text-muted">{hint}</p>}
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={`Quick ${label.toLowerCase()} choices`}>
        {quick.map((name) => {
          const selected = value.trim().toLowerCase() === name.toLowerCase()
          return (
            <button
              key={name}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(selected ? '' : name)}
              className={`rounded-full border px-3 py-1 text-[11px] transition-colors ${
                selected ? 'border-accent bg-accent text-white' : 'border-line bg-card text-muted hover:border-accent hover:text-accent'
              }`}
            >
              {name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
