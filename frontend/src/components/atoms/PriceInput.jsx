// Price in pesos, with "₱" in front. On leaving the field it tidies the value
// to two decimals between 0 and 10,000, e.g. "95.5" becomes "95.50".
export default function PriceInput({ value, onChange, label }) {
  function tidy() {
    if (value === '') return
    const amount = Math.min(Math.max(Number(value) || 0, 0), 10000)
    onChange(amount.toFixed(2))
  }

  return (
    <label className="flex shrink-0 items-center font-mono text-sm">
      <span aria-hidden="true">₱</span>
      <span className="sr-only">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min="0"
        max="10000"
        step="0.01"
        placeholder="0.00"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={tidy}
        className="no-spinner w-20 border-b border-transparent bg-transparent text-right placeholder:text-faint focus:border-brand focus:outline-none"
      />
    </label>
  )
}
