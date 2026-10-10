import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import Button from '../atoms/Button.jsx'
import PencilArrow from '../atoms/PencilArrow.jsx'

// Each step points at an element marked data-tour="<target>" on Home or in the tab bar
const steps = [
  { target: 'new-review', title: 'Log a meal', body: 'Start here. Add where you ate, then score each dish out of 10.' },
  { target: 'search', title: 'Find a place', body: 'Search for restaurants, or add one yourself if it is not listed.' },
  { target: 'collections', title: 'Sort your spots', body: 'Keep places in boxes: coffee corners, date nights, anything you like.' },
  { target: 'friends', title: 'Find your food people', body: 'Follow other diners and see the reviews they share.' },
  { target: 'profile', title: 'Your card', body: 'Your username, photo, bio and top picks live here.' },
  { target: 'notifications', title: 'Stay in the loop', body: 'Follows, comments and co-review invites land here.' },
]

const PAD = 8 // spotlight room around the target
const GAP = 104 // space between the note and the target, for the arrow
const EDGE = 16 // the note keeps this far from the screen edge
const SWEEP = 40 // the arrow starts off the target's line, so it curves in rather than running flat

const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max))

// Put the note on the side of the target with the most room, then aim the arrow from the
// note's nearest edge to the target's.
function layout(target, note, width, height) {
  const room = { right: width - target.right, left: target.left, above: target.top, below: height - target.bottom }
  const fits = {
    right: room.right >= note.width + GAP + EDGE,
    left: room.left >= note.width + GAP + EDGE,
    above: room.above >= note.height + GAP + EDGE,
    below: room.below >= note.height + GAP + EDGE,
  }
  const sides = Object.keys(room).sort((a, b) => fits[b] - fits[a] || room[b] - room[a])
  const side = sides[0]
  const cx = target.left + target.width / 2
  const cy = target.top + target.height / 2
  const x = (value) => clamp(value, EDGE, width - note.width - EDGE)
  const y = (value) => clamp(value, EDGE, height - note.height - EDGE)
  const spot = {
    right: { left: target.right + GAP, top: y(cy - note.height / 2) },
    left: { left: target.left - GAP - note.width, top: y(cy - note.height / 2) },
    above: { left: x(cx - note.width / 2), top: target.top - GAP - note.height },
    below: { left: x(cx - note.width / 2), top: target.bottom + GAP },
  }[side]
  spot.left = x(spot.left)
  spot.top = y(spot.top)
  const toward = (from, center) => (center >= from ? 1 : -1)
  const alongX = clamp(cx + toward(cx, spot.left + note.width / 2) * SWEEP, spot.left + 32, spot.left + note.width - 32)
  const alongY = clamp(cy + toward(cy, spot.top + note.height / 2) * SWEEP, spot.top + 28, spot.top + note.height - 28)
  const arrow = {
    right: { from: { x: spot.left - 10, y: alongY }, to: { x: target.right + 6, y: cy }, bow: 0.3 },
    left: { from: { x: spot.left + note.width + 10, y: alongY }, to: { x: target.left - 6, y: cy }, bow: -0.3 },
    above: { from: { x: alongX, y: spot.top + note.height + 10 }, to: { x: cx, y: target.top - 6 }, bow: -0.3 },
    below: { from: { x: alongX, y: spot.top - 10 }, to: { x: cx, y: target.bottom + 6 }, bow: 0.3 },
  }[side]
  const length = Math.hypot(arrow.to.x - arrow.from.x, arrow.to.y - arrow.from.y)
  return { note: spot, arrow: length > 24 ? arrow : null }
}

// A short guided tour of Home for a new account: a paper note per step, with a pencil arrow
// pointing at the part of the screen it explains. Escape or "Skip tour" ends it early.
export default function WelcomeTour({ onDone, busy = false, error = '' }) {
  const location = useLocation()
  const navigate = useNavigate()
  const dialog = useRef(null)
  const noteRef = useRef(null)
  const next = useRef(null)
  const [index, setIndex] = useState(0)
  const [found, setFound] = useState(null) // { index, element } for the step whose target was found
  const [box, setBox] = useState(null)
  const [noteSize, setNoteSize] = useState(null)
  const step = steps[index]
  const last = index === steps.length - 1
  const target = found?.index === index ? found.element : null

  useEffect(() => {
    const element = dialog.current
    if (!element.open) element.showModal()
    return () => element.close()
  }, [])
  // The tour explains Home, so it always starts there
  useEffect(() => {
    if (location.pathname !== '/') navigate('/')
  }, [location.pathname, navigate])

  // Wait for the journal to load without silently marking an unseen tour complete.
  useEffect(() => {
    const find = () => {
      const element = document.querySelector(`[data-tour="${step.target}"]`)
      const rect = element?.getBoundingClientRect()
      if (rect?.width && rect.height) return setFound({ index, element })
      frame = requestAnimationFrame(find)
    }
    let frame = requestAnimationFrame(find)
    return () => cancelAnimationFrame(frame)
  }, [index, step.target, location.pathname])

  // Follow the target as the page scrolls or resizes
  useLayoutEffect(() => {
    if (!target) return
    // The spotlight copies the target's roundest corner, so a pill button gets a pill-shaped cutout
    const radius = Math.max(0, ...getComputedStyle(target).borderRadius.split(/[\s/]+/).map(parseFloat).filter(Number.isFinite))
    const measure = () => {
      const rect = target.getBoundingClientRect()
      setBox({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height, radius })
    }
    const rect = target.getBoundingClientRect()
    if (rect.top < 0 || rect.bottom > window.innerHeight) target.scrollIntoView({ block: 'center' })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(target)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [target])

  // The note's size decides where it fits, so measure it after each step's text renders
  useLayoutEffect(() => {
    const element = noteRef.current
    if (!element) return
    const measure = () => setNoteSize({ width: element.offsetWidth, height: element.offsetHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [index])

  const ready = Boolean(target && box && noteSize)
  const placed = ready ? layout(box, noteSize, window.innerWidth, window.innerHeight) : null
  // Focus Next once the note is on screen (a hidden button cannot take focus)
  useEffect(() => {
    if (target && ready) next.current?.focus()
  }, [target, ready])

  return createPortal(
    <dialog
      ref={dialog}
      className="tour-dialog"
      aria-labelledby="tour-title"
      aria-describedby="tour-body"
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onDone()
      }}
    >
      {ready && (
        <>
          <div
            className="tour-spotlight"
            style={{
              left: box.left - PAD,
              top: box.top - PAD,
              width: box.width + PAD * 2,
              height: box.height + PAD * 2,
              borderRadius: box.radius + PAD,
            }}
          />
          {placed.arrow && (
            <svg className="tour-arrow" width={window.innerWidth} height={window.innerHeight}>
              <PencilArrow key={index} {...placed.arrow} />
            </svg>
          )}
        </>
      )}
      <div
        ref={noteRef}
        className="tour-note"
        style={placed ? { left: placed.note.left, top: placed.note.top } : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-brand">
          Step {index + 1} of {steps.length}
        </p>
        <h2 id="tour-title" className="mt-1.5 font-serif text-2xl font-semibold italic leading-tight">
          {step.title}
        </h2>
        <p id="tour-body" className="mt-2 font-mono text-sm leading-6 text-muted">
          {step.body}
        </p>
        {!ready && <p role="status" className="mt-2 text-xs text-muted">Waiting for your journal to load…</p>}
        {error && <p role="alert" className="mt-3 text-xs text-brand">{error} Try finishing or skipping again.</p>}
        <div className="mt-4 flex items-center gap-2">
          <button type="button" disabled={busy} onClick={onDone} className="mr-auto font-mono text-xs text-accent underline underline-offset-4 disabled:opacity-50">
            Skip tour
          </button>
          {index > 0 && (
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => setIndex(index - 1)}>
              Back
            </Button>
          )}
          <Button ref={next} size="sm" disabled={busy || !ready} onClick={() => (last ? onDone() : setIndex(index + 1))}>
            {busy ? 'Saving…' : last ? 'Done' : 'Next'}
          </Button>
        </div>
      </div>
    </dialog>,
    document.body,
  )
}
