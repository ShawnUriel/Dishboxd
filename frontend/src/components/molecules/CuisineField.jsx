import { useId } from 'react'
import { CUISINES, passportCuisine } from '../../lib/passport.js'

export default function CuisineField({ value, onChange, hint, disabled = false }) {
  const id = useId()
  const stamp = passportCuisine(value)
  return <div className="rounded-lg border border-dashed border-accent/40 bg-accent/5 p-4">
    <label htmlFor={id} className="font-mono text-xs uppercase tracking-widest text-muted">Cuisine tag <span className="normal-case tracking-normal">(optional)</span></label>
    <input id={id} list={`${id}-choices`} value={value} onChange={event => onChange(event.target.value)} maxLength={40} disabled={disabled} autoComplete="off" placeholder="Japanese, Filipino, Italian…" aria-describedby={`${id}-hint ${id}-stamp`} className="mt-2 w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-faint" />
    <datalist id={`${id}-choices`}>{CUISINES.map(cuisine => <option key={cuisine.id} value={cuisine.name} />)}</datalist>
    <p id={`${id}-hint`} role="status" className="mt-2 text-xs leading-6 text-muted">{hint || 'Tag this meal to collect its matching passport stamp. You can leave it blank.'}</p>
    <div role="group" aria-label="Quick cuisine choices" className="mt-3 flex flex-wrap gap-2">
      {CUISINES.map(cuisine => <button key={cuisine.id} type="button" disabled={disabled} aria-pressed={stamp === cuisine.name} onClick={() => onChange(stamp === cuisine.name ? '' : cuisine.name)} className={`rounded-full border px-3 py-1 text-[11px] transition-colors disabled:opacity-60 ${stamp === cuisine.name ? 'border-accent bg-accent text-white' : 'border-line bg-card text-muted hover:border-accent hover:text-accent'}`}>{cuisine.name}</button>)}
      {value && <button type="button" disabled={disabled} className="px-2 text-xs text-accent underline" onClick={() => onChange('')}>Clear tag</button>}
    </div>
    <p id={`${id}-stamp`} className="mt-3 border-t border-dashed border-line pt-3 text-xs leading-6 text-muted">{stamp ? `${stamp} passport stamp · collected when you save this review.` : value.trim() ? 'Your tag will be saved. This cuisine does not have a passport stamp yet.' : 'A little taste of everywhere. One cuisine, one stamp.'}</p>
  </div>
}
