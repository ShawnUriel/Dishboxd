import SectionLabel from '../atoms/SectionLabel.jsx'
import DishFormRow from '../molecules/DishFormRow.jsx'
import { newDish } from '../../lib/dishes.js'
import { formatMoney } from '../../lib/format.js'

const MAX_DISHES = 20

// The ticket's line items: a repeating list of dishes, "+ add line item", and the total.
export default function DishEntryList({ dishes, onChange }) {
  const total = dishes.reduce((sum, dish) => sum + (Number(dish.price) || 0), 0)

  function update(index, dish) {
    onChange(dishes.map((current, i) => (i === index ? dish : current)))
  }

  function remove(index) {
    onChange(dishes.filter((_, i) => i !== index))
  }

  return (
    <section aria-labelledby="items-label">
      <SectionLabel id="items-label">Items</SectionLabel>
      <ul className="mt-3">
        {dishes.map((dish, index) => (
          <DishFormRow
            key={dish.key}
            index={index}
            dish={dish}
            onChange={(updated) => update(index, updated)}
            onRemove={() => remove(index)}
            canRemove={dishes.length > 1}
          />
        ))}
      </ul>
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
