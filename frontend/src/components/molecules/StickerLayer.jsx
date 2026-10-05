import { useRef, useState } from 'react'
import StickerImage from '../atoms/StickerImage.jsx'

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value))
const tidy = (value) => Math.round(value * 10) / 10
const keyOf = (placement) => placement.id ?? placement.key ?? placement.stickerId

// The stickers stuck on one card (the card itself needs `relative`).
// While `editing`: drag a sticker to move it, tap it for tilt / size / peel-off buttons.
// Keyboard: arrows move (Shift for bigger steps), [ and ] tilt, - and + resize, Delete peels it off.
export default function StickerLayer({ placements, size = 64, editing = false, onUpdate, onRemove, label = 'Stickers' }) {
  const layer = useRef(null)
  const [selected, setSelected] = useState(null)
  const [drag, setDrag] = useState(null)
  if (!placements?.length) return null

  function startDrag(event, placement) {
    if (!editing || event.button > 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    setDrag({
      key: keyOf(placement),
      rect: layer.current.getBoundingClientRect(),
      startX: event.clientX,
      startY: event.clientY,
      fromX: placement.x,
      fromY: placement.y,
      x: placement.x,
      y: placement.y,
      moved: false,
    })
  }

  function moveDrag(event) {
    if (!drag) return
    const dx = ((event.clientX - drag.startX) / drag.rect.width) * 100
    const dy = ((event.clientY - drag.startY) / drag.rect.height) * 100
    setDrag({
      ...drag,
      x: clamp(drag.fromX + dx),
      y: clamp(drag.fromY + dy),
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
    onUpdate?.(placement, {
      ...(changes.x === undefined ? {} : { x: tidy(clamp(changes.x)) }),
      ...(changes.y === undefined ? {} : { y: tidy(clamp(changes.y)) }),
      ...(changes.rotation === undefined ? {} : { rotation: clamp(changes.rotation, -45, 45) }),
      ...(changes.scale === undefined ? {} : { scale: tidy(clamp(changes.scale, 0.5, 2)) }),
    })
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

  return (
    <div
      ref={layer}
      className="pointer-events-none absolute inset-0 z-20"
      role={editing ? 'group' : undefined}
      aria-label={editing ? label : undefined}
      aria-hidden={editing ? undefined : 'true'}
    >
      {placements.map((placement, index) => {
        const key = keyOf(placement)
        const dragging = drag?.key === key
        const x = dragging ? drag.x : placement.x
        const y = dragging ? drag.y : placement.y
        const isSelected = editing && selected === key
        const style = {
          left: `${x}%`,
          top: `${y}%`,
          width: `${size * placement.scale}px`,
          transform: `translate(-50%, -50%) rotate(${placement.rotation}deg)`,
          zIndex: isSelected || dragging ? 40 : 10 + index,
        }
        return (
          <div key={key}>
            {editing ? (
              <button
                type="button"
                style={style}
                aria-label={`Sticker ${index + 1}. Drag to move, or use arrow keys. Brackets tilt, minus and plus resize, Delete peels it off.`}
                aria-pressed={isSelected}
                onPointerDown={(event) => startDrag(event, placement)}
                onPointerMove={moveDrag}
                onPointerUp={() => endDrag(placement)}
                onPointerCancel={() => setDrag(null)}
                onKeyDown={(event) => handleKey(event, placement)}
                onFocus={(event) => event.currentTarget.matches(':focus-visible') && setSelected(key)}
                className={`pointer-events-auto absolute cursor-grab touch-none rounded-md active:cursor-grabbing ${
                  isSelected ? 'outline-2 outline-offset-4 outline-dashed outline-accent' : ''
                }`}
              >
                <StickerImage id={placement.stickerId} className="w-full" />
              </button>
            ) : (
              <span style={style} className="absolute block">
                <StickerImage id={placement.stickerId} className="w-full" />
              </span>
            )}
            {isSelected && !dragging && (
              <div
                className="pointer-events-auto absolute z-50 flex -translate-x-1/2 gap-1 rounded-full border border-line bg-card p-1 shadow-md"
                style={{ left: `${clamp(x, 12, 88)}%`, top: `calc(${y}% + ${(size * placement.scale) / 2 + 10}px)` }}
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
  )
}
