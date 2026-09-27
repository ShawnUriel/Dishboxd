import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <>
      <h1 className="font-serif text-4xl font-bold tracking-tight">Nothing on file</h1>
      <p className="mt-2 font-mono text-sm text-muted">That page, restaurant or box does not exist.</p>
      <Link
        to="/"
        className="mt-8 inline-block font-mono text-sm font-semibold uppercase tracking-widest text-accent hover:underline"
      >
        <span aria-hidden="true">←</span> Back to the log
      </Link>
    </>
  )
}
