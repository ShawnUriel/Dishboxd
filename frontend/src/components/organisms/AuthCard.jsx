// Shared frame for the log in, sign up and code pages: a ticket-style card on ruled paper.
export default function AuthCard({ title, subtitle, children, footer }) {
  return (
    <div className="bg-lined grid min-h-screen place-items-center px-4 py-10">
      <main id="main" className="w-full max-w-[440px]">
        <p className="text-center font-serif text-4xl font-bold tracking-tight">Dishboxd</p>
        <p className="mt-1 text-center font-mono text-xs uppercase tracking-widest text-muted">
          Your personal food journal
        </p>

        <section aria-labelledby="auth-title" className="mt-6 bg-card shadow-lg">
          <header className="border-b border-dashed border-line px-6 py-5 text-center md:px-8">
            <h1 id="auth-title" className="font-serif text-2xl font-bold uppercase tracking-wide">
              {title}
            </h1>
            {subtitle && <p className="mt-1 font-mono text-sm text-muted">{subtitle}</p>}
          </header>
          <div className="px-6 py-6 md:px-8">{children}</div>
          {footer && (
            <footer className="border-t border-dashed border-line px-6 py-4 text-center font-mono text-sm text-muted md:px-8">
              {footer}
            </footer>
          )}
        </section>
      </main>
    </div>
  )
}

// "— or —" divider between the email form and Google
export function OrDivider() {
  return (
    <div className="my-5 flex items-center gap-3 font-mono text-xs uppercase tracking-widest text-muted" aria-hidden="true">
      <span className="h-px flex-1 bg-line" />
      or
      <span className="h-px flex-1 bg-line" />
    </div>
  )
}

export function FormError({ message }) {
  if (!message) return null
  return (
    <p role="alert" className="mt-4 font-mono text-sm text-brand">
      {message}
    </p>
  )
}
