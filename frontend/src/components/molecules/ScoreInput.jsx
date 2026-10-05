import { useId } from 'react'
import { MAX_SCORE, PERFECT, isOnFire, scoreWord } from '../../lib/scores.js'
import ScoreBadge from '../atoms/ScoreBadge.jsx'

// Score one item out of 10 with − / + or the slider. Going past 10 (up to 12) sets it on fire.
// null means "not scored yet"; the score is optional.
export default function ScoreInput({ value, onChange, label }) {
  const id = useId()
  const current = value ?? 0
  const fire = isOnFire(value)
  const set = (next) => onChange(Math.min(MAX_SCORE, Math.max(0, next)))
  return (
    <div className={`rounded-lg border px-3 py-3 ${fire ? 'border-[#f08a24]/60 bg-[#fff4e6]' : 'border-line bg-paper/70'}`}>
      {/* On a narrow phone the − score + control moves under the label instead of squeezing it */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="min-w-[9rem] flex-1">
          <label htmlFor={id} className="block text-[10px] uppercase tracking-[0.16em] text-muted">
            {label}
          </label>
          <p className={`mt-0.5 font-mono text-xs ${fire ? 'font-semibold text-[#c2410c]' : value == null ? 'text-faint' : 'text-ink'}`}>
            {value == null ? 'Not scored yet' : scoreWord(value)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => set(current - 1)}
            disabled={value == null || value <= 0}
            aria-label={`Lower the score for ${label.toLowerCase()}`}
            className="grid size-8 place-items-center rounded-full border border-line bg-card text-lg leading-none text-muted hover:border-brand hover:text-brand disabled:opacity-40"
          >
            −
          </button>
          {value == null ? (
            <span className="w-16 text-center font-mono text-sm text-faint">–/10</span>
          ) : (
            <span className="flex w-16 justify-center">
              <ScoreBadge score={value} size="lg" />
            </span>
          )}
          <button
            type="button"
            onClick={() => set(value == null ? 7 : current + 1)}
            disabled={value != null && value >= MAX_SCORE}
            aria-label={`Raise the score for ${label.toLowerCase()}`}
            className="grid size-8 place-items-center rounded-full border border-line bg-card text-lg leading-none text-muted hover:border-brand hover:text-brand disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>
      <input
        id={id}
        type="range"
        min="0"
        max={MAX_SCORE}
        step="1"
        value={current}
        onChange={(event) => set(Number(event.target.value))}
        aria-valuetext={value == null ? 'Not scored yet' : `${value} out of 10, ${scoreWord(value)}`}
        className={`score-range mt-3 w-full ${value == null ? 'opacity-50' : ''}`}
        style={{ '--fill': `${(current / MAX_SCORE) * 100}%`, '--perfect': `${(PERFECT / MAX_SCORE) * 100}%` }}
      />
      {/* 0 and 10 sit under their places on the slider; past 10 is the fire */}
      <div aria-hidden="true" className="relative mt-1 h-4 font-mono text-[10px] text-muted">
        <span className="absolute left-0">0</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${(PERFECT / MAX_SCORE) * 100}%` }}>
          10
        </span>
        <span className="absolute right-0">🔥</span>
      </div>
    </div>
  )
}
