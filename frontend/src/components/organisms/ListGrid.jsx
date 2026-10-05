import { FolderIcon } from '../atoms/Icon.jsx'
import ListCard from '../molecules/ListCard.jsx'

export default function ListGrid({ boxes, restaurantsById, onCreate }) {
  return (
    <ul className="stagger grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
      {boxes.map((box) => (
        <ListCard key={box.id} box={box} restaurantsById={restaurantsById} />
      ))}
      <li className="min-w-0 pt-7">
        <button
          type="button"
          onClick={onCreate}
          className="group flex h-full min-h-64 w-full flex-col items-center justify-center rounded-xl border border-dashed border-muted/45 bg-card/60 px-6 py-8 text-center transition-colors hover:border-brand hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
        >
          <span className="mb-4 grid size-12 place-items-center rounded-full border border-line bg-paper text-accent transition-colors group-hover:border-brand group-hover:text-brand"><FolderIcon /></span>
          <span className="font-serif text-2xl font-semibold">Room for one more.</span>
          <span className="mt-2 max-w-48 text-xs leading-6 text-muted">A new craving, a new collection.</span>
          <span className="mt-5 text-[11px] font-semibold uppercase tracking-widest text-brand">+ New box</span>
        </button>
      </li>
    </ul>
  )
}
