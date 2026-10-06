import { useState } from 'react'
import StickerImage from '../atoms/StickerImage.jsx'
import { StickerIcon } from '../atoms/Icon.jsx'
import StickerMaker from './StickerMaker.jsx'
import { useJournal } from '../../state/useJournal.js'

// The sticker book: tap a sticker to stick it on, or make a new one from a picture.
export default function StickerTray({ onPick, onClose, onBusyChange, title = 'Your sticker book' }) {
  const { stickers, deleteSticker } = useJournal()
  const [making, setMaking] = useState(false)
  const [managing, setManaging] = useState(false)
  const [confirming, setConfirming] = useState(null)
  const [error, setError] = useState('')

  async function remove(id) {
    if (confirming !== id) {
      setConfirming(id)
      return
    }
    setError('')
    try {
      await deleteSticker(id)
    } catch (failure) {
      setError(failure.message)
    }
    setConfirming(null)
  }

  return (
    <section className="rounded-xl border border-line bg-card p-4 text-left shadow-lg" aria-label={title}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-serif text-lg font-semibold">
          <span className="text-brand">
            <StickerIcon />
          </span>
          {making ? 'Make a sticker' : title}
        </h3>
        <div className="flex items-center gap-3 text-xs">
          {!making && stickers.length > 0 && (
            <button type="button" onClick={() => setManaging(!managing)} className="text-muted underline underline-offset-4">
              {managing ? 'Done' : 'Manage'}
            </button>
          )}
          {onClose && (
            <button type="button" onClick={onClose} className="text-accent underline underline-offset-4">
              Close
            </button>
          )}
        </div>
      </div>
      {making ? (
        <StickerMaker
          onBusyChange={onBusyChange}
          onDone={(sticker) => {
            setMaking(false)
            onPick?.(sticker.id)
          }}
          onCancel={() => setMaking(false)}
        />
      ) : (
        <>
          <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            <li>
              <button
                type="button"
                onClick={() => setMaking(true)}
                className="grid aspect-square w-full place-items-center rounded-lg border border-dashed border-brand/40 bg-brand/5 p-1 text-center text-[10px] font-semibold uppercase leading-4 tracking-wider text-brand hover:bg-brand/10"
              >
                + Make one
              </button>
            </li>
            {stickers.map((sticker, index) => (
              <li key={sticker.id} className="relative">
                <button
                  type="button"
                  onClick={() => (managing ? remove(sticker.id) : onPick?.(sticker.id))}
                  aria-label={managing ? `Delete sticker ${index + 1}` : `Stick sticker ${index + 1} (${sticker.style})`}
                  className={`sticker-preview grid aspect-square w-full place-items-center rounded-lg border p-1.5 transition-transform hover:-rotate-3 hover:scale-105 ${
                    managing ? 'border-brand/50' : 'border-line'
                  }`}
                >
                  <StickerImage id={sticker.id} className="max-h-full w-full object-contain" />
                </button>
                {managing && (
                  <span className="pointer-events-none absolute -top-2 -right-2 rounded-full bg-brand px-1.5 py-0.5 text-[9px] font-semibold uppercase text-white">
                    {confirming === sticker.id ? 'Sure?' : '×'}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] leading-5 text-muted">
            {managing
              ? 'Tap a sticker twice to delete it. It is peeled off every card it is on.'
              : stickers.length
                ? 'Tap a sticker to stick it on, then drag it into place.'
                : 'No stickers yet. Make one from a photo of your food, your pet, anything.'}
          </p>
          {error && (
            <p role="alert" className="mt-2 text-sm text-brand">
              {error}
            </p>
          )}
        </>
      )}
    </section>
  )
}
