import { useRef, useState } from 'react'
import StickerImage from '../atoms/StickerImage.jsx'

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value))
const tidy = (value) => Math.round(value * 10) / 10
const keyOf = (placement) => placement.id ?? placement.key ?? placement.stickerId
const EDGE = 4 // px kept clear between a sticker and the card's edge

// How far a sticker reaches from its centre, tilt included, in px
function reachOf(placement, size, shape = 1) {
  const width = size * placement.scale
  const height = width * shape
  const angle = (Math.abs(placement.rotation) * Math.PI) / 180
  return {
    x: (width * Math.cos(angle) + height * Math.sin(angle)) / 2 + EDGE,
    y: (width * Math.sin(angle) + height * Math.cos(angle)) / 2 + EDGE,
  }
}

// A position in % of the card, moved in just enough for the whole sticker to fit. The same card
// shows up in different sizes (a box on the shelf and opened), so the CSS does it for every size.
const within = (percent, reach) => `clamp(${reach}px, ${percent}%, calc(100% - ${reach}px))`
const keepInside = (percent, reach, length) => {
  const margin = Math.min(50, (reach / length) * 100)
  return clamp(percent, margin, 100 - margin)
}

// The stickers stuck on one card. The card needs `relative isolate`: the pictures are drawn between
// the card's paper and its content, so they never cover any text, wherever they are placed.
// They also stay inside the card: nothing spills over its edge onto the page or the next card.
// While `editing`, an invisible handle sits over each sticker: drag it to move the sticker, tap it for
// tilt / size / peel-off buttons. The picture itself stays behind the text even then.
// Keyboard: arrows move (Shift for bigger steps), [ and ] tilt, - and + resize, Delete peels it off.
export default function StickerLayer({ placements, size = 64, editing = false, onUpdate, onRemove, label = 'Stickers' }) {
  const layer = useRef(null)
  const [selected, setSelected] = useState(null)
  const [drag, setDrag] = useState(null)
  const [shapes, setShapes] = useState({})
  if (!placements?.length) return null

  const reach = (placement) => reachOf(placement, size, shapes[placement.stickerId])
  const learnShape = (stickerId) => (shape) =>
    setShapes((known) => (known[stickerId] === shape ? known : { ...known, [stickerId]: shape }))

  function startDrag(event, placement) {
    if (!editing || event.button > 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const rect = layer.current.getBoundingClientRect()
    const { x: reachX, y: reachY } = reach(placement)
    // Start from where the sticker is drawn, which can be further in than where it was saved
    const fromX = keepInside(placement.x, reachX, rect.width)
    const fromY = keepInside(placement.y, reachY, rect.height)
    setDrag({
      key: keyOf(placement),
      rect,
      reachX,
      reachY,
      startX: event.clientX,
      startY: event.clientY,
      fromX,
      fromY,
      x: fromX,
      y: fromY,
      moved: false,
    })
  }

  function moveDrag(event) {
    if (!drag) return
    const dx = ((event.clientX - drag.startX) / drag.rect.width) * 100
    const dy = ((event.clientY - drag.startY) / drag.rect.height) * 100
    setDrag({
      ...drag,
      x: keepInside(drag.fromX + dx, drag.reachX, drag.rect.width),
      y: keepInside(drag.fromY + dy, drag.reachY, drag.rect.height),
      moved: drag.moved || Math.abs(event.clientX - drag.startX) + Math.abs(event.clientY - drag.startY) > 4,
    })
  }

  function endDrag(placement) {
    if (!drag) return
    if (drag.moved) onUpdate?.(placement, { x: tidy(drag.x), y: tidy(drag.y) })
    else setSelected((current) => (current === drag.key ? null : drag.key))
    setDrag(null)
  }

  function nudge(placement, changes) {
    const next = {
      ...placement,
      ...changes,
      rotation: clamp(changes.rotation ?? placement.rotation, -45, 45),
      scale: tidy(clamp(changes.scale ?? placement.scale, 0.5, 2)),
    }
    // Still all on the card after a move, and after it grows or tilts near an edge
    const rect = layer.current.getBoundingClientRect()
    const { x: reachX, y: reachY } = reach(next)
    next.x = tidy(keepInside(next.x, reachX, rect.width))
    next.y = tidy(keepInside(next.y, reachY, rect.height))
    const changed = ['x', 'y', 'rotation', 'scale'].filter((field) => next[field] !== placement[field])
    if (changed.length) onUpdate?.(placement, Object.fromEntries(changed.map((field) => [field, next[field]])))
  }

  function handleKey(event, placement) {
    const step = event.shiftKey ? 6 : 2
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    if (moves[event.key]) {
      event.preventDefault()
      nudge(placement, { x: placement.x + moves[event.key][0], y: placement.y + moves[event.key][1] })
    } else if (event.key === '[' || event.key === ']') {
      nudge(placement, { rotation: placement.rotation + (event.key === '[' ? -5 : 5) })
    } else if (event.key === '-' || event.key === '+' || event.key === '=') {
      nudge(placement, { scale: placement.scale + (event.key === '-' ? -0.1 : 0.1) })
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      onRemove?.(placement)
    } else if (event.key === 'Escape') {
      setSelected(null)
    }
  }

  function place(placement, index) {
    const key = keyOf(placement)
    const dragging = drag?.key === key
    return {
      key,
      dragging,
      x: dragging ? drag.x : placement.x,
      y: dragging ? drag.y : placement.y,
      isSelected: editing && selected === key,
      index,
      reach: reach(placement),
    }
  }

  const styleOf = ({ x, y, index, reach }, placement) => ({
    left: within(x, reach.x),
    top: within(y, reach.y),
    width: `${size * placement.scale}px`,
    transform: `translate(-50%, -50%) rotate(${placement.rotation}deg)`,
    zIndex: index + 1,
  })

  return (
    <>
      {/* The pictures, always behind the card's content */}
      <div ref={layer} aria-hidden="true" className="pointer-events-none absolute inset-0 z-[-1] overflow-hidden rounded-[inherit]">
        {placements.map((placement, index) => {
          const spot = place(placement, index)
          return (
            <span key={spot.key} style={styleOf(spot, placement)} className="absolute block">
              <StickerImage id={placement.stickerId} onShape={learnShape(placement.stickerId)} className="w-full" />
            </span>
          )
        })}
      </div>
      {editing && (
        <div role="group" aria-label={label} className="pointer-events-none absolute inset-0 z-30">
          {placements.map((placement, index) => {
            const spot = place(placement, index)
            return (
              <div key={spot.key}>
                {/* An invisible handle the size of the sticker, so it can be grabbed through the text */}
                <button
                  type="button"
                  style={{ ...styleOf(spot, placement), zIndex: spot.isSelected || spot.dragging ? 40 : index + 1 }}
                  aria-label={`Sticker ${index + 1}. Drag to move, or use arrow keys. Brackets tilt, minus and plus resize, Delete peels it off.`}
                  aria-pressed={spot.isSelected}
                  onPointerDown={(event) => startDrag(event, placement)}
                  onPointerMove={moveDrag}
                  onPointerUp={() => endDrag(placement)}
                  onPointerCancel={() => setDrag(null)}
                  onKeyDown={(event) => handleKey(event, placement)}
                  onFocus={(event) => event.currentTarget.matches(':focus-visible') && setSelected(spot.key)}
                  className={`pointer-events-auto absolute cursor-grab touch-none rounded-md active:cursor-grabbing ${
                    spot.isSelected
                      ? 'outline-2 outline-offset-4 outline-dashed outline-accent'
                      : 'hover:outline-1 hover:outline-offset-2 hover:outline-dashed hover:outline-accent/60'
                  }`}
                >
                  <StickerImage id={placement.stickerId} className="w-full opacity-0" />
                </button>
                {spot.isSelected && !spot.dragging && (
                  <div
                    className="pointer-events-auto absolute z-50 flex -translate-x-1/2 gap-1 rounded-full border border-line bg-card p-1 shadow-md"
                    style={{ left: `${clamp(spot.x, 12, 88)}%`, top: `calc(${within(spot.y, spot.reach.y)} + ${spot.reach.y + 6}px)` }}
                  >
                    {[
                      ['⟲', 'Tilt left', { rotation: placement.rotation - 10 }],
                      ['⟳', 'Tilt right', { rotation: placement.rotation + 10 }],
                      ['−', 'Smaller', { scale: placement.scale - 0.15 }],
                      ['+', 'Bigger', { scale: placement.scale + 0.15 }],
                    ].map(([symbol, name, changes]) => (
                      <button
                        key={name}
                        type="button"
                        aria-label={name}
                        title={name}
                        onClick={() => nudge(placement, changes)}
                        className="grid size-7 place-items-center rounded-full text-sm text-ink hover:bg-sidebar"
                      >
                        {symbol}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(null)
                        onRemove?.(placement)
                      }}
                      className="rounded-full px-2 text-[10px] font-semibold uppercase tracking-wider text-brand hover:bg-brand/10"
                    >
                      Peel off
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
