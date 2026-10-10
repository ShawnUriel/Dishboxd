import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Photo from '../atoms/Photo.jsx'

function PhotoViewer({ ids, initialIndex, name, onClose }) {
  const dialog = useRef(null)
  const [index, setIndex] = useState(initialIndex)
  const [actualSize, setActualSize] = useState(false)
  useEffect(() => {
    const element = dialog.current
    const previousOverflow = document.body.style.overflow
    element.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      element.close()
      document.body.style.overflow = previousOverflow
    }
  }, [])
  function move(offset) {
    setIndex((current) => (current + offset + ids.length) % ids.length)
    setActualSize(false)
  }
  return createPortal(
    <dialog ref={dialog} aria-label={`${name} photos`} onCancel={onClose}
      className="fixed inset-0 m-auto h-[92dvh] w-[96vw] max-w-none rounded-xl border border-line bg-paper p-0 text-ink backdrop:bg-black/80">
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-line p-4">
          <p className="text-sm">Photo {index + 1} of {ids.length}</p>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <button type="button" aria-pressed={actualSize} onClick={() => setActualSize(!actualSize)} className="text-accent underline">{actualSize ? 'Fit to screen' : 'Actual size'}</button>
            <button type="button" autoFocus onClick={onClose} className="rounded-md border border-line px-4 py-2">Close</button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-ink/5 p-3" tabIndex={0} aria-label="Photo; scroll to explore at actual size">
          <Photo key={ids[index]} id={ids[index]} alt={`${name}, photo ${index + 1}`} fit="contain" loading="eager"
            className={actualSize ? 'block max-w-none' : 'mx-auto block h-full w-full'} />
        </div>
        {ids.length > 1 && <div className="flex shrink-0 justify-between border-t border-line p-3 text-sm">
          <button type="button" className="rounded-md px-4 py-2 text-accent" onClick={() => move(-1)}>← Previous</button>
          <button type="button" className="rounded-md px-4 py-2 text-accent" onClick={() => move(1)}>Next →</button>
        </div>}
      </div>
    </dialog>, document.body,
  )
}

// Where each photo sits in a card's 4:3 frame (a 2 × 2 grid): one fills it, two share it
// side by side, three are a tall photo on the left and two stacked on the right.
const frameCells = {
  1: ['col-span-2 row-span-2'],
  2: ['row-span-2', 'row-span-2'],
  3: ['row-span-2', '', ''],
}

// In feeds every review's photos share the same 4:3 frame, so cards stay one size whatever
// shape the photos are; each photo fills its tile, trimmed at the edges rather than squashed.
// The full review page shows every photo whole, at its own proportions and never stretched
// past its real size. Both use the original upload, so the photos lose no quality.
export default function ReviewPhotos({ ids, name, expanded = false }) {
  const [selected, setSelected] = useState(null)
  const shown = expanded ? ids : ids.slice(0, 3)
  const button = (id, index, className) => (
    <button key={id} type="button" onClick={() => setSelected(index)}
      aria-label={`View ${name}, photo ${index + 1} full size`}
      className={`overflow-hidden rounded-md bg-paper focus-visible:outline-2 focus-visible:outline-brand ${className}`}>
      {expanded
        ? <Photo id={id} alt={`${name}, photo ${index + 1}`} fit="contain" loading="eager" className="block h-auto max-w-full" />
        : <Photo id={id} alt={`${name}, photo ${index + 1}`} fit="cover" loading="eager" className="absolute inset-0 size-full" />}
    </button>
  )
  return <>
    {expanded
      ? <div className="mt-4 grid justify-items-center gap-3">{shown.map((id, index) => button(id, index, 'block w-fit max-w-full'))}</div>
      : <div data-photo-frame className="mt-4 grid aspect-[4/3] grid-cols-2 grid-rows-2 gap-1.5">
          {shown.map((id, index) => button(id, index, `relative ${frameCells[shown.length][index]}`))}
        </div>}
    <p className="mt-2 text-[10px] text-muted">Select a photo to view full size.</p>
    {selected !== null && <PhotoViewer ids={ids} initialIndex={selected} name={name} onClose={() => setSelected(null)} />}
  </>
}
