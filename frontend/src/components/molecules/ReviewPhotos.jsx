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

// A compact review card shows its first photo centred like a post, trimmed to the same medium square
// on every card (cropped at the edges, never squashed), with a count of any others. It is part of
// the card: clicking the card opens the expanded review, which shows every photo whole, at its own
// proportions and never stretched past its real size. Both use the original upload, so the photos
// lose no quality.
export default function ReviewPhotos({ ids, name, expanded = false }) {
  const [selected, setSelected] = useState(null)
  if (!expanded) {
    return (
      <div data-photo-frame className="relative mx-auto mt-2 size-64 shrink-0 overflow-hidden rounded-md bg-paper sm:size-72">
        <Photo id={ids[0]} alt={`${name}, photo 1 of ${ids.length}`} fit="cover" loading="eager" className="absolute inset-0 size-full" />
        {ids.length > 1 && (
          <span className="absolute right-2 bottom-2 rounded-full bg-black/65 px-2 py-0.5 font-mono text-[11px] text-white">
            +{ids.length - 1} {ids.length === 2 ? 'photo' : 'photos'}
          </span>
        )}
      </div>
    )
  }
  return <>
    <div className="mt-4 grid justify-items-center gap-3">
      {ids.map((id, index) => (
        <button key={id} type="button" onClick={() => setSelected(index)}
          aria-label={`View ${name}, photo ${index + 1} full size`}
          className="block w-fit max-w-full overflow-hidden rounded-md bg-paper focus-visible:outline-2 focus-visible:outline-brand">
          <Photo id={id} alt={`${name}, photo ${index + 1}`} fit="contain" loading="eager" className="block h-auto max-w-full" />
        </button>
      ))}
    </div>
    <p className="mt-2 text-[10px] text-muted">Select a photo to view it at actual size.</p>
    {selected !== null && <PhotoViewer ids={ids} initialIndex={selected} name={name} onClose={() => setSelected(null)} />}
  </>
}
