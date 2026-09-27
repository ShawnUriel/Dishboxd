// Round catalog number badge: "R14" for a restaurant on file, dashed "NEW" otherwise.
export default function CodeBadge({ code }) {
  const isNew = !code
  return (
    <span
      className={`grid size-10 shrink-0 place-items-center rounded-full font-mono text-xs font-medium text-muted ${
        isNew ? 'border border-dashed border-line' : 'border border-card-edge bg-badge'
      }`}
    >
      {code || 'NEW'}
    </span>
  )
}
