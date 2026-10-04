import SectionLabel from '../atoms/SectionLabel.jsx'
import DishFormRow from '../molecules/DishFormRow.jsx'
import { newDish } from '../../lib/dishes.js'
import { formatMoney } from '../../lib/format.js'

const MAX_DISHES = 20
const SUGGESTIONS_ID = 'dish-suggestions'

// The ticket's line items: a repeating list of dishes, "+ add line item", and the total.
// `suggestions` are dishes logged here before; picking one fills in the last price paid.
export default function DishEntryList({ dishes, onChange, suggestions = [] }) {
  const total = dishes.reduce((sum, dish) => sum + (Number(dish.price) || 0), 0)

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
      <SectionLabel id="items-label">Items</SectionLabel>
      {suggestions.length > 0 && (
        <p className="mt-1 font-mono text-xs text-muted">Dishes you've had here before come up as you type.</p>
      )}
      <ul className="mt-3">
        {dishes.map((dish, index) => (
          <DishFormRow
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
        className="mt-2 w-full rounded-sm border border-dashed border-line py-2 font-mono text-sm text-muted transition-colors hover:border-brand hover:text-brand focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50"
      >
        + add line item
      </button>
      <div className="mt-5 flex justify-between border-t-2 border-line pt-4 font-mono font-semibold">
        <span>TOTAL</span>
        <span>{formatMoney(total)}</span>
      </div>
    </section>
  )
}
