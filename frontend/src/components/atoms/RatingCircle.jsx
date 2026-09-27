import { formatRating } from '../../lib/format.js'

const sizes = {
  sm: 'size-11 text-sm',
  md: 'size-12 text-sm',
  lg: 'size-18 text-xl',
}

// Red outlined circle with the rating inside, like a grade on a paper.
// value null means "not rated yet" and shows a dash.
export default function RatingCircle({ value, size = 'md', decimals = 1 }) {
  const unrated = value == null
  const text = unrated ? '–' : formatRating(value, decimals)
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full border-[1.5px] border-brand font-mono font-medium text-brand ${sizes[size]}`}
      aria-label={unrated ? 'Not rated yet' : `Rated ${text} out of 5`}
    >
      {text}
    </span>
  )
}
