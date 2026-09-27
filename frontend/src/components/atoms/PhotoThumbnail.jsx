// Striped placeholder until real photos come from Google Places.
export default function PhotoThumbnail({ className = 'size-24 rounded-lg' }) {
  return (
    <div
      className={`photo-stripes grid shrink-0 place-items-center font-mono text-xs uppercase tracking-widest text-muted ${className}`}
      role="img"
      aria-label="Photo coming soon"
    >
      Photo
    </div>
  )
}
