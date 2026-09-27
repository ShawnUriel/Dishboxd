import { Link } from 'react-router-dom'

// Light boxes use dark text and the dark plum box uses white, so every label passes 4.5:1 contrast.
const colors = {
  orange: 'bg-box-orange text-ink',
  mint: 'bg-box-mint text-ink',
  lavender: 'bg-box-lavender text-ink',
  pink: 'bg-box-pink text-ink',
  plum: 'bg-box-plum text-white',
}

// One card catalog box on the Boxes page.
export default function ListCard({ box }) {
  const count = box.restaurantIds.length
  return (
    <li>
      <Link
        to={`/lists/${box.id}`}
        className="block rounded-sm transition hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
      >
        <div className={`clip-trapezoid flex h-48 flex-col justify-end p-6 font-mono ${colors[box.color]}`}>
          <span className="font-semibold">{box.title}</span>
          <span className="text-sm">
            {count} restaurant{count === 1 ? '' : 's'}
          </span>
        </div>
      </Link>
    </li>
  )
}
