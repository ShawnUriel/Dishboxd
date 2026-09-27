// Five clickable stars. Works with a keyboard too (each star is a button).
export default function StarRating({ value, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
          onClick={() => onChange(star)}
          className="text-xl leading-none text-brand transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-brand"
        >
          {star <= value ? '★' : '☆'}
        </button>
      ))}
    </div>
  )
}
