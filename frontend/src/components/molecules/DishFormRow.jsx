import Leader from '../atoms/Leader.jsx'
import PriceInput from '../atoms/PriceInput.jsx'

// One line item on the ticket: number, dish name ..... $price
export default function DishFormRow({ index, dish, onChange, onRemove, canRemove }) {
  const number = index + 1
  return (
    <li className="flex items-center gap-2 py-1.5 font-mono text-sm">
      <span className="w-4 text-muted">{number}</span>
      <label className="min-w-0 flex-[0_1_13rem]">
        <span className="sr-only">Dish {number} name</span>
        <input
          type="text"
          value={dish.name}
          maxLength={80}
          placeholder="Dish name"
          onChange={(event) => onChange({ ...dish, name: event.target.value })}
          className="w-full border-b border-transparent bg-transparent placeholder:text-faint focus:border-brand focus:outline-none"
        />
      </label>
      <Leader />
      <PriceInput
        value={dish.price}
        onChange={(price) => onChange({ ...dish, price })}
        label={`Dish ${number} price`}
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove dish ${number}`}
        className={`px-1 text-muted hover:text-brand ${canRemove ? '' : 'invisible'}`}
      >
        ×
      </button>
    </li>
  )
}
