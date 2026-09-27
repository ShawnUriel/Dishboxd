// One button style per job, so every button in the app looks the same.
// Primary/accent read like stamped labels; secondary is quieter, in normal case.
const loud = 'font-semibold uppercase tracking-widest'
const variants = {
  primary: `${loud} bg-brand text-white hover:bg-brand-dark border-brand`,
  secondary: 'font-normal bg-card text-ink hover:border-ink border-line',
  accent: `${loud} bg-accent text-white hover:bg-accent-dark border-accent`,
}

// Padding lives here (not in className) so sizes never fight each other
const sizes = {
  md: 'px-3 py-3 md:px-6',
  sm: 'px-4 py-2',
}

export default function Button({ variant = 'primary', size = 'md', className = '', type = 'button', ...props }) {
  return (
    <button
      type={type}
      className={`rounded-md border font-mono text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  )
}
