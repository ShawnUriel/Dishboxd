import { useState } from 'react'
import Flames from '../atoms/Flames.jsx'
import { StickerIcon } from '../atoms/Icon.jsx'
import PriceInput from '../atoms/PriceInput.jsx'
import ScoreInput from './ScoreInput.jsx'
import StickerLayer from './StickerLayer.jsx'
import StickerTray from './StickerTray.jsx'
import { fireLevel } from '../../lib/scores.js'

// One item on the ticket, in its own container: name, price, its own score out of 10,
// a note about it and one sticker. Past 10 the container catches fire.
// `listId` points the name at a <datalist> of dishes logged here before.
export default function DishCard({ index, dish, listId, onChange, onRemove, canRemove }) {
  const [choosingSticker, setChoosingSticker] = useState(false)
  const number = index + 1
  const level = fireLevel(dish.score)

  function stick(stickerId) {
    onChange({ ...dish, sticker: { key: crypto.randomUUID(), stickerId, x: 70, y: 9, rotation: 8, scale: 1 } })
    setChoosingSticker(false)
  }

  return (
    <li className={`dish-card relative rounded-xl border bg-card p-4 sm:p-5 ${level ? 'on-fire pb-14 sm:pb-14' : 'border-card-edge'}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-sm bg-sidebar px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          Item {String(number).padStart(2, '0')}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove item ${number}`}
            className="rounded px-2 text-lg leading-none text-muted hover:text-brand"
          >
            ×
          </button>
        )}
      </div>
      <div className="mt-3 flex items-end gap-3">
        <label className="min-w-0 flex-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">What did you have?</span>
          <input
            type="text"
            value={dish.name}
            maxLength={80}
            list={listId}
            placeholder="Spanish latte, classic fries…"
            onChange={(event) => onChange({ ...dish, name: event.target.value })}
            className="mt-1 w-full border-b border-dotted border-muted bg-transparent pb-1 font-serif text-xl text-ink placeholder:font-mono placeholder:text-sm placeholder:text-faint focus:border-solid focus:border-brand focus:outline-none"
          />
        </label>
        <PriceInput value={dish.price} onChange={(price) => onChange({ ...dish, price })} label={`Item ${number} price`} />
      </div>
      <div className="mt-4">
        <ScoreInput
          value={dish.score}
          onChange={(score) => onChange({ ...dish, score })}
          label={dish.name.trim() ? `Your score for ${dish.name.trim()}` : `Your score for item ${number}`}
        />
      </div>
      <label className="mt-4 block">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">How was it?</span>
        <textarea
          rows={2}
          maxLength={500}
          value={dish.description}
          placeholder="Silky, not too sweet. Would order again."
          onChange={(event) => onChange({ ...dish, description: event.target.value })}
          className="bg-notes mt-1 block w-full resize-y rounded-md p-2 text-sm placeholder:text-faint"
        />
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
        <button
          type="button"
          onClick={() => setChoosingSticker(!choosingSticker)}
          aria-expanded={choosingSticker}
          className="flex items-center gap-1.5 text-accent underline underline-offset-4"
        >
          <StickerIcon /> {dish.sticker ? 'Change sticker' : 'Add a sticker'}
        </button>
        {dish.sticker && (
          <button type="button" onClick={() => onChange({ ...dish, sticker: null })} className="text-muted underline underline-offset-4">
            Remove sticker
          </button>
        )}
        {dish.sticker && <span className="text-muted">Drag it anywhere on this item.</span>}
      </div>
      {choosingSticker && (
        <div className="mt-3">
          <StickerTray title="Stick one on this item" onPick={stick} onClose={() => setChoosingSticker(false)} />
        </div>
      )}
      <StickerLayer
        placements={dish.sticker ? [dish.sticker] : []}
        size={54}
        editing
        onUpdate={(placement, changes) => onChange({ ...dish, sticker: { ...placement, ...changes } })}
        onRemove={() => onChange({ ...dish, sticker: null })}
        label={`Sticker on item ${number}`}
      />
      {level > 0 && <Flames level={level} />}
    </li>
  )
}
