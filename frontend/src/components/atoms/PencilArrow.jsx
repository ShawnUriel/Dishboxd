import { useId } from 'react'

const round = (value) => Math.round(value * 10) / 10

// The line bows to one side (bow is a share of its length; negative bows the other way),
// and the head's two strokes are slightly uneven, the way a hand draws them.
function arrowPaths(from, to, bow = 0.25) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy) || 1
  const bend = Math.sign(bow) * Math.min(48, length * Math.abs(bow))
  const cx = (from.x + to.x) / 2 - (dy / length) * bend
  const cy = (from.y + to.y) / 2 + (dx / length) * bend
  const angle = Math.atan2(to.y - cy, to.x - cx)
  const wing = (spread, size) =>
    `${round(to.x - size * Math.cos(angle + spread))} ${round(to.y - size * Math.sin(angle + spread))}`
  return {
    line: `M${round(from.x)} ${round(from.y)} Q${round(cx)} ${round(cy)} ${round(to.x)} ${round(to.y)}`,
    head: `M${wing(0.5, 16)} L${round(to.x)} ${round(to.y)} L${wing(-0.42, 13)}`,
  }
}

// A hand-drawn pencil arrow, sketched onto the page: a grainy, slightly wobbly line with a
// faint second pass beside it. Goes inside an <svg>; coordinates are that SVG's units.
export default function PencilArrow({ from, to, bow, className = '' }) {
  const filter = `pencil-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const { line, head } = arrowPaths(from, to, bow)
  return (
    <g className={`pencil-arrow ${className}`} aria-hidden="true">
      <defs>
        <filter id={filter} filterUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="wobble" />
          <feDisplacementMap in="SourceGraphic" in2="wobble" scale="2.4" xChannelSelector="R" yChannelSelector="G" result="drawn" />
          <feTurbulence type="fractalNoise" baseFrequency="1.7" seed="11" result="grain" />
          <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.6 1.45" result="tooth" />
          <feComposite in="drawn" in2="tooth" operator="in" />
        </filter>
      </defs>
      <g filter={`url(#${filter})`}>
        <path className="pencil-arrow-ghost" d={line} pathLength="1" />
        <path className="pencil-arrow-line" d={line} pathLength="1" />
        <path className="pencil-arrow-head" d={head} pathLength="1" />
      </g>
    </g>
  )
}
