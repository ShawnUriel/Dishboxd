import { useEffect, useId, useRef, useState } from 'react'
import { StickerIcon } from '../atoms/Icon.jsx'
import StickerImage from '../atoms/StickerImage.jsx'
import ReviewCard from './ReviewCard.jsx'
import StickerTray from './StickerTray.jsx'

const MAX_REVIEW_STICKERS = 12

// Draft placements stay local until the whole ticket is submitted successfully.
export default function ReviewStickerComposer({ review, placements, onChange, onBusyChange, disabled = false }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [makingSticker, setMakingSticker] = useState(false)
  const latest = useRef(placements)
  useEffect(() => { latest.current = placements }, [placements])

  function commit(next) {
    latest.current = next
    onChange(next)
  }

  function reportBusy(busy) {
    setMakingSticker(busy)
    onBusyChange?.(busy)
  }

  function add(stickerId) {
    if (disabled) return
    const current = latest.current
    if (current.length >= MAX_REVIEW_STICKERS) {
      setError('A review can hold up to 12 stickers. Peel one off to make room.')
      return
    }
    setError('')
    commit([...current, {
      key: crypto.randomUUID(),
      stickerId,
      x: 82 - (current.length % 3) * 16,
      y: 18 + Math.floor(current.length / 3) * 14,
      rotation: current.length % 2 ? -6 : 8,
      scale: 1,
    }])
  }

  function update(placement, changes) {
    if (!disabled) commit(latest.current.map((item) => item.key === placement.key ? { ...item, ...changes } : item))
  }

  function remove(placement) {
    if (disabled) return
    commit(latest.current.filter((item) => item.key !== placement.key))
    setError('')
  }

  return (
    <section aria-labelledby={`${id}-title`} className="rounded-lg border border-line bg-sidebar/25 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id={`${id}-title`} className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted">
            <StickerIcon /> Stickers on your review
          </h2>
          <p className="mt-1 text-xs leading-6 text-muted">
            {placements.length ? `${placements.length} of 12 stickers attached. They save with your review.` : 'A little personality for the whole review. Pick a sticker or make your own.'}
          </p>
        </div>
        <button
          type="button"
          disabled={disabled || makingSticker}
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls={`${id}-editor`}
          className="rounded-md border border-accent/35 bg-card px-3 py-2 text-xs font-medium text-accent hover:bg-accent/5 disabled:opacity-50"
        >
          {open ? 'Done decorating' : placements.length ? 'Edit stickers' : '+ Add stickers'}
        </button>
      </div>
      {!open && placements.length > 0 && (
        <div aria-hidden="true" className="mt-3 flex flex-wrap gap-2">
          {placements.map((placement) => <StickerImage key={placement.key} id={placement.stickerId} className="size-10 object-contain" />)}
        </div>
      )}
      {open && (
        <fieldset id={`${id}-editor`} disabled={disabled || makingSticker} className="mt-4 min-w-0 space-y-5">
          <legend className="sr-only">Decorate your review</legend>
          <p className="text-xs leading-6 text-muted">Drag stickers into place on the preview. Select one to turn, resize, or peel it off. You can also move it with the arrow keys.</p>
          <ReviewCard
            review={review}
            preview
            stickerEditor={{ placements, update, remove, editing: !disabled && !makingSticker }}
          />
          <StickerTray title="Choose a review sticker" onPick={add} onBusyChange={reportBusy} />
          {error && <p role="alert" className="text-xs text-brand">{error}</p>}
        </fieldset>
      )}
    </section>
  )
}
