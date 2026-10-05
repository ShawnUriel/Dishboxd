import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Button from '../components/atoms/Button.jsx'
import CategoryTag from '../components/atoms/CategoryTag.jsx'
import { FolderIcon, PencilIcon, SearchIcon, StickerIcon } from '../components/atoms/Icon.jsx'
import Photo from '../components/atoms/Photo.jsx'
import RatingCircle from '../components/atoms/RatingCircle.jsx'
import BoxColorPicker from '../components/molecules/BoxColorPicker.jsx'
import StickerLayer from '../components/molecules/StickerLayer.jsx'
import StickerTray from '../components/molecules/StickerTray.jsx'
import { boxHex, isDarkBox } from '../lib/colors.js'
import { formatDate, restaurantCode } from '../lib/format.js'
import { averageRating, newestFirst } from '../lib/stats.js'
import { useStickerPlacements } from '../lib/useStickerPlacements.js'
import { useJournal } from '../state/useJournal.js'
import NotFound from './NotFound.jsx'

export default function ListDetail() {
  const { id } = useParams()
  const { boxes } = useJournal()
  const box = boxes.find((b) => b.id === id)
  if (!box) return <NotFound />
  return <BoxContent key={box.id} box={box} />
}

// One open box: its name, description, colour and stickers can all be changed here
function BoxContent({ box }) {
  const { restaurants, visits, updateBox, setBoxStickers } = useJournal()
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [decorating, setDecorating] = useState(false)
  const stickers = useStickerPlacements({ type: 'box', id: box.id }, box.stickers ?? [], (next) =>
    setBoxStickers(box.id, next),
  )

  const filed = box.restaurantIds
    .map((restaurantId) => restaurants.find((r) => r.id === restaurantId))
    .filter(Boolean)
  const restaurantIds = new Set(filed.map((restaurant) => restaurant.id))
  const boxVisits = visits.filter((visit) => restaurantIds.has(visit.restaurantId))
  const rating = averageRating(boxVisits)
  // While editing, the box shows the colour being picked
  const shownColor = draft?.color ?? box.color
  const folder = { background: boxHex(shownColor), color: isDarkBox(shownColor) ? '#ffffff' : 'var(--color-ink)' }

  async function save(event) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setEditError('')
    try {
      await updateBox(box.id, { title: draft.title, description: draft.description, color: draft.color })
      setDraft(null)
    } catch (failure) {
      setEditError(failure.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-enter mx-auto min-w-0 max-w-6xl">
      <nav aria-label="Breadcrumb" className="mb-7 flex flex-wrap items-center gap-3 text-xs">
        <Link to="/lists" className="text-accent underline decoration-accent/35 underline-offset-4 hover:text-brand">
          <span aria-hidden="true">← </span>Back to your tray
        </Link>
        <span aria-hidden="true" className="text-line">/</span>
        <span className="text-muted">Open box</span>
      </nav>

      <header className="relative pt-8">
        <div style={folder} className="absolute top-0 left-0 flex h-10 items-center gap-2 rounded-t-xl border border-b-0 border-ink/10 px-5 text-[10px] font-semibold uppercase tracking-[0.16em]">
          <FolderIcon /> From your card catalog
        </div>
        <div style={folder} className="relative rounded-tl-none rounded-tr-2xl border border-ink/10 px-6 py-7 sm:px-8 sm:py-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0 flex-1 basis-64">
              <p className="mb-3 text-[10px] uppercase tracking-[0.2em] opacity-75">A collection of good places</p>
              <h1 className="break-words font-serif text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">{draft?.title || box.title}</h1>
              <p className="mt-4 max-w-2xl whitespace-pre-wrap break-words text-sm leading-7 opacity-85">
                {(draft ? draft.description : box.description) ||
                  'A little corner of your food world, saved for the next time you need a good idea.'}
              </p>
            </div>
            <div className="flex flex-col items-start gap-3 sm:items-end">
              <span className="rounded border border-current/30 px-3 py-2 text-[10px] uppercase tracking-widest">
                {box.isPublic ? 'Public box' : 'Personal box'}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  aria-expanded={Boolean(draft)}
                  onClick={() => setDraft(draft ? null : { title: box.title, description: box.description, color: box.color })}
                  className="flex items-center gap-1.5 rounded-md border border-current/30 bg-white/30 px-3 py-2 text-[11px] font-medium hover:bg-white/50"
                >
                  <PencilIcon /> {draft ? 'Close' : 'Edit box'}
                </button>
                <button
                  type="button"
                  aria-expanded={decorating}
                  onClick={() => setDecorating(!decorating)}
                  className="flex items-center gap-1.5 rounded-md border border-current/30 bg-white/30 px-3 py-2 text-[11px] font-medium hover:bg-white/50"
                >
                  <StickerIcon /> {decorating ? 'Done' : 'Stickers'}
                </button>
              </div>
            </div>
          </div>
          <StickerLayer
            placements={stickers.placements}
            size={64}
            editing={decorating}
            onUpdate={stickers.update}
            onRemove={stickers.remove}
            label="Stickers on this box"
          />
        </div>
        <dl className="grid grid-cols-3 rounded-b-xl border border-t-0 border-card-edge bg-card shadow-[0_3px_0_#e9e0bd70]">
          {[
            [filed.length, 'Places filed'],
            [boxVisits.length, 'Visits logged'],
            [rating == null ? '—' : rating.toFixed(1), 'Avg. meal rating'],
          ].map(([value, label]) => (
            <div key={label} className="min-w-0 border-r border-dashed border-line px-3 py-5 last:border-r-0 sm:px-7">
              <dt className="text-[9px] uppercase leading-5 tracking-wider text-muted sm:text-[10px]">{label}</dt>
              <dd className="mt-1 font-serif text-3xl font-semibold text-brand">
                {value}
                {label === 'Avg. meal rating' && rating != null && <span className="ml-1 font-mono text-xs font-normal text-muted">/ 5</span>}
              </dd>
            </div>
          ))}
        </dl>
      </header>

      {draft && (
        <form onSubmit={save} className="paper-card mt-6 space-y-5 p-5 sm:p-7" aria-labelledby="edit-box-heading">
          <h2 id="edit-box-heading" className="font-serif text-2xl font-semibold">Make this box yours.</h2>
          <div>
            <label htmlFor="box-title" className="mb-2 block text-xs font-medium">Box name</label>
            <input
              id="box-title"
              required
              maxLength={60}
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              className="w-full rounded-md border border-line bg-paper px-4 py-3 text-sm focus:border-brand"
            />
          </div>
          <div>
            <label htmlFor="box-description" className="mb-2 block text-xs font-medium">Description</label>
            <textarea
              id="box-description"
              rows={3}
              maxLength={300}
              value={draft.description}
              placeholder="What belongs in this box? Sunday coffee, places to take visitors…"
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              className="w-full rounded-md border border-line bg-paper px-4 py-3 text-sm focus:border-brand"
            />
            <p className="mt-1 text-right text-xs text-muted">{draft.description.length}/300</p>
          </div>
          <BoxColorPicker value={draft.color} onChange={(color) => setDraft({ ...draft, color })} />
          {editError && (
            <p role="alert" className="text-sm text-brand">
              {editError}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" size="sm" disabled={saving || !draft.title.trim()}>
              {saving ? 'Saving…' : 'Save box'}
            </Button>
            <Button variant="secondary" size="sm" disabled={saving} onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
      {decorating && (
        <div className="mt-6">
          <StickerTray title="Decorate this box" onPick={stickers.add} onClose={() => setDecorating(false)} />
        </div>
      )}
      {stickers.error && (
        <p role="alert" className="mt-4 text-sm text-brand">
          {stickers.error}
        </p>
      )}

      <section aria-labelledby="filed-places-title" className="mt-9">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 id="filed-places-title" className="font-serif text-2xl font-semibold">The places inside</h2>
            <p className="mt-1 text-xs leading-6 text-muted">
              {filed.length ? 'Open a card to revisit the meals and memories.' : 'Every good collection starts with one place.'}
            </p>
          </div>
          <Link to="/search" className="inline-flex items-center gap-2 rounded-md border border-line bg-card px-4 py-3 text-xs text-accent transition-colors hover:border-accent hover:bg-sidebar/50">
            <SearchIcon /> Find a place
          </Link>
        </div>

        {filed.length ? (
          <ul className="stagger grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filed.map((restaurant, index) => {
              const restaurantVisits = boxVisits.filter((visit) => visit.restaurantId === restaurant.id).sort(newestFirst)
              const photoId = restaurantVisits.find((visit) => visit.photoIds?.length)?.photoIds[0]
              const latest = restaurantVisits[0]
              return (
                <li key={restaurant.id} className="min-w-0">
                  <Link to={`/restaurant/${restaurant.id}`} className="paper-card paper-lift group flex h-full flex-col overflow-hidden">
                    <div className="relative border-b border-card-edge">
                      {photoId ? (
                        <Photo id={photoId} alt={`Your visit to ${restaurant.name}`} className="aspect-[16/10] w-full" />
                      ) : (
                        <div aria-hidden="true" className="relative flex aspect-[16/10] items-center justify-center overflow-hidden bg-sidebar/60">
                          <div className="absolute inset-x-5 top-6 border-t border-dashed border-line" />
                          <div className="grid size-24 place-items-center rounded-full border border-brand/20 ring-8 ring-paper/60">
                            <span className="font-serif text-4xl italic text-brand/65">{String(index + 1).padStart(2, '0')}</span>
                          </div>
                          <span className="absolute bottom-4 text-[9px] uppercase tracking-[0.2em] text-muted">A place worth keeping</span>
                        </div>
                      )}
                      <span className="absolute top-3 left-3 rounded-sm border border-card-edge bg-card/95 px-2 py-1 text-[9px] uppercase tracking-wider text-muted">
                        {restaurantCode(restaurant.number)}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <CategoryTag category={restaurant.category} className="mb-2" />
                          <h3 className="break-words font-serif text-xl font-semibold leading-snug transition-colors group-hover:text-brand">{restaurant.name}</h3>
                          <p className="mt-2 break-words text-xs leading-6 text-muted">{restaurant.address || 'Address not added'}</p>
                        </div>
                        <RatingCircle value={averageRating(restaurantVisits)} size="sm" />
                      </div>
                      <div className="mt-auto pt-5">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-line pt-4 text-[10px] uppercase tracking-wide text-muted">
                          <span>{restaurantVisits.length} {restaurantVisits.length === 1 ? 'visit' : 'visits'} logged</span>
                          <span className="text-accent">Open card <span aria-hidden="true">↗</span></span>
                        </div>
                        {latest && <p className="mt-2 text-[10px] text-muted">Last visit {formatDate(latest.date)}</p>}
                      </div>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="paper-card grid gap-6 px-6 py-9 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-center sm:px-9 sm:py-10">
            <div aria-hidden="true" className="relative mx-auto h-24 w-28 sm:mx-0">
              <div className="absolute inset-x-3 top-0 h-20 -rotate-6 rounded border border-card-edge bg-paper" />
              <div className="absolute inset-x-1 top-2 h-20 rotate-3 rounded border border-card-edge bg-paper" />
              <div style={folder} className="absolute inset-x-0 bottom-0 grid h-18 place-items-center rounded border border-ink/10">
                <FolderIcon />
              </div>
            </div>
            <div className="text-center sm:text-left">
              <h3 className="font-serif text-3xl font-semibold">Room for a new favourite.</h3>
              <p className="mt-3 max-w-xl text-sm leading-7 text-muted">
                Find a restaurant, save a visit, then choose <span className="font-medium text-ink">+ File in a box</span> on its page to keep it here.
              </p>
              <Link to="/search" className="mt-5 inline-flex items-center gap-2 rounded-md bg-brand px-5 py-3 text-xs font-semibold uppercase tracking-wide text-white transition-colors hover:bg-brand-dark">
                Find your first place <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        )}
        {filed.length > 0 && (
          <p className="mt-5 text-center text-[11px] leading-6 text-muted">
            Growing this collection? Open any restaurant and choose <span className="text-ink">+ File in a box.</span>
          </p>
        )}
      </section>
    </div>
  )
}
