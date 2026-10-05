import SectionLabel from '../atoms/SectionLabel.jsx'
import DishCard from '../molecules/DishCard.jsx'
import { newDish } from '../../lib/dishes.js'
import { formatMoney } from '../../lib/format.js'
import { averageScore } from '../../lib/scores.js'

const MAX_DISHES = 20
const SUGGESTIONS_ID = 'dish-suggestions'

// Every item from this restaurant, each in its own container, then "+ add another item" and the total.
// `suggestions` are dishes logged here before; picking one fills in the last price paid.
export default function DishEntryList({ dishes, onChange, suggestions = [] }) {
  const total = dishes.reduce((sum, dish) => sum + (Number(dish.price) || 0), 0)
  const average = averageScore(dishes.filter((dish) => dish.name.trim()))

  function withLastPrice(dish, previous) {
    if (dish.price !== '' || dish.name === previous.name) return dish
    const match = suggestions.find((suggestion) => suggestion.name.toLowerCase() === dish.name.trim().toLowerCase())
    return match ? { ...dish, price: match.price.toFixed(2) } : dish
  }

  function update(index, dish) {
    onChange(dishes.map((current, i) => (i === index ? withLastPrice(dish, current) : current)))
  }

  function remove(index) {
    onChange(dishes.filter((_, i) => i !== index))
  }

  return (
    <section aria-labelledby="items-label">
      <SectionLabel id="items-label">What you ordered</SectionLabel>
      <p className="mt-1 font-mono text-xs leading-6 text-muted">
        Score each item out of 10. Something unforgettable? Take it past 10.
        {suggestions.length > 0 && ' Dishes you’ve had here before come up as you type.'}
      </p>
      <ul className="mt-4 space-y-4">
        {dishes.map((dish, index) => (
          <DishCard
            key={dish.key}
            index={index}
            dish={dish}
            listId={suggestions.length > 0 ? SUGGESTIONS_ID : undefined}
            onChange={(updated) => update(index, updated)}
            onRemove={() => remove(index)}
            canRemove={dishes.length > 1}
          />
        ))}
      </ul>
      {suggestions.length > 0 && (
        <datalist id={SUGGESTIONS_ID}>
          {suggestions.map((suggestion) => (
            <option key={suggestion.name} value={suggestion.name} />
          ))}
        </datalist>
      )}
      <button
        type="button"
        onClick={() => onChange([...dishes, newDish()])}
        disabled={dishes.length >= MAX_DISHES}
        className="mt-4 w-full rounded-xl border border-dashed border-line bg-card/60 py-3 font-mono text-sm text-muted transition-colors hover:border-brand hover:text-brand focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50"
      >
        + add another item
      </button>
      <div className="mt-5 flex justify-between border-t-2 border-line pt-4 font-mono font-semibold">
        <span>
          TOTAL
          {average != null && (
            <span className="ml-3 text-xs font-normal text-muted">avg. score {average.toFixed(1)}/10</span>
          )}
        </span>
        <span>{formatMoney(total)}</span>
      </div>
    </section>
  )
}
