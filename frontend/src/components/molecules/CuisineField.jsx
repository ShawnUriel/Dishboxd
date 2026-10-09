import { useId, useState } from 'react'
import { collectPassport, cuisineStamp, normalizeCuisine } from '../../lib/passport.js'
import { useJournal } from '../../state/useJournal.js'

export default function CuisineField({ value, onChange, hint, disabled = false }) {
  const id = useId()
  const [search, setSearch] = useState('')
  const { visits, restaurants } = useJournal()
  const choices = collectPassport(visits, restaurants)
  const stamp = cuisineStamp(value)?.name || ''
  const query = normalizeCuisine(search)
  const results = choices.filter(cuisine => [cuisine.name, ...cuisine.aliases].some(name => normalizeCuisine(name).includes(query))).sort((a, b) => a.name.localeCompare(b.name))
  const quick = choices.slice(0, 12)
  const chip = cuisine => <button key={cuisine.id} type="button" disabled={disabled} aria-pressed={stamp === cuisine.name} onClick={() => onChange(stamp === cuisine.name ? '' : cuisine.name)} className={`max-w-full rounded-full border px-3 py-1 text-[11px] [overflow-wrap:anywhere] transition-colors disabled:opacity-60 ${stamp === cuisine.name ? 'border-accent bg-accent text-white' : 'border-line bg-card text-muted hover:border-accent hover:text-accent'}`}>{cuisine.name}</button>
  return <div className="rounded-lg border border-dashed border-accent/40 bg-accent/5 p-4">
    <label htmlFor={id} className="font-mono text-xs uppercase tracking-widest text-muted">Cuisine tag <span className="normal-case tracking-normal">(optional)</span></label>
    <input id={id} list={`${id}-choices`} value={value} onChange={event => onChange(event.target.value)} maxLength={40} disabled={disabled} autoComplete="off" placeholder="Japanese, Filipino, Italian…" aria-describedby={`${id}-hint ${id}-stamp`} className="mt-2 w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-faint" />
    <datalist id={`${id}-choices`}>{choices.map(cuisine => <option key={cuisine.id} value={cuisine.name} />)}</datalist>
    <p id={`${id}-hint`} role="status" className="mt-2 text-xs leading-6 text-muted">{hint || 'Tag this meal to collect its matching passport stamp. You can leave it blank.'}</p>
    <div role="group" aria-label="Quick cuisine choices" className="mt-3 flex flex-wrap gap-2">
      {quick.map(chip)}
      {value && <button type="button" disabled={disabled} className="px-2 text-xs text-accent underline" onClick={() => onChange('')}>Clear tag</button>}
    </div>
    <details className="mt-4 rounded-md border border-line bg-paper p-3">
      <summary className="text-xs text-accent">Browse all cuisines ({choices.length})</summary>
      <label htmlFor={`${id}-search`} className="mt-3 block text-xs text-muted">Find a cuisine</label>
      <input id={`${id}-search`} type="search" value={search} onChange={event => setSearch(event.target.value)} disabled={disabled} placeholder="Search cuisines worldwide…" className="mt-2 w-full rounded-md border border-line bg-card px-3 py-2 text-sm" />
      <div role="group" aria-label="All cuisine choices" className="mt-3 flex max-h-56 flex-wrap content-start gap-2 overflow-y-auto p-1">{results.map(chip)}</div>
      {!results.length && <p role="status" className="mt-2 text-xs leading-6 text-muted">No matching suggestion. Type this cuisine in the tag above to create its stamp.</p>}
    </details>
    <p id={`${id}-stamp`} className="mt-3 border-t border-dashed border-line pt-3 text-xs leading-6 text-muted">{stamp ? `${stamp} passport stamp · collected when you save this review.` : 'Any cuisine can earn a stamp. Choose a suggestion or type your own regional, family or fusion cuisine.'}</p>
  </div>
}
