// Labeled input on a dotted line, like the search slip. Shows an optional hint underneath.
export default function TextField({ id, label, hint, className = '', ...inputProps }) {
  const hintId = hint ? `${id}-hint` : undefined
  return (
    <div className={className}>
      <label htmlFor={id} className="font-mono text-xs uppercase tracking-widest text-muted">
        {label}
      </label>
      <input
        id={id}
        aria-describedby={hintId}
        className="mt-1 w-full border-b border-dotted border-muted bg-transparent py-1.5 font-mono text-base text-ink placeholder:text-faint focus:border-solid focus:border-brand focus:outline-none"
        {...inputProps}
      />
      {hint && (
        <p id={hintId} className="mt-1 font-mono text-xs text-muted">
          {hint}
        </p>
      )}
    </div>
  )
}
