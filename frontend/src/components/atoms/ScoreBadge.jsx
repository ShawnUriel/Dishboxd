import { isOnFire, scoreWord } from '../../lib/scores.js'

// An item's score, like "7/10". Past 10 it burns: "11/10" in a flame-coloured badge.
export default function ScoreBadge({ score, size = 'md' }) {
  if (score == null) return null
  const fire = isOnFire(score)
  const sizes = { sm: 'px-2 py-0.5 text-[11px]', md: 'px-2.5 py-1 text-xs', lg: 'px-3 py-1.5 text-sm' }
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full font-mono font-semibold tabular-nums ${sizes[size]} ${
        fire ? 'score-fire text-white' : 'border border-brand/30 bg-card text-brand'
      }`}
      aria-label={`${score} out of 10, ${scoreWord(score)}`}
      title={scoreWord(score)}
    >
      {fire && (
        <svg viewBox="0 0 16 16" className="size-3" fill="currentColor" aria-hidden="true">
          <path d="M8.6 1c.3 2.2 2.1 3.3 3 5 1.4 2.6.4 6.2-2.6 7.6.9-1.6.5-3.3-.9-4.4.1 1.4-.6 2.4-1.6 2.9.4-1.8-.6-3-1.6-4-.6 1.2-1.9 2-1.7 3.9-1.4-1.5-1.5-3.8-.3-5.8C4.3 4 7.6 3.6 8.6 1Z" />
        </svg>
      )}
      {score}/10
    </span>
  )
}
