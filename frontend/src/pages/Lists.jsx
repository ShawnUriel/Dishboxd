import ListGrid from '../components/organisms/ListGrid.jsx'
import { useJournal } from '../state/useJournal.js'

// "The Card Catalog": every box (list) of restaurants.
export default function Lists() {
  const { boxes, addBox } = useJournal()

  return (
    <>
      <h1 className="font-serif text-4xl font-bold tracking-tight">The Card Catalog</h1>
      <p className="mt-1 font-mono text-sm uppercase tracking-widest text-muted">
        {boxes.length} {boxes.length === 1 ? 'box' : 'boxes'} on file
      </p>
      <div className="mt-8">
        <ListGrid boxes={boxes} onCreate={addBox} />
      </div>
    </>
  )
}
