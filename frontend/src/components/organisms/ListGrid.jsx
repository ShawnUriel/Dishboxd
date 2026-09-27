import { useState } from 'react'
import Button from '../atoms/Button.jsx'
import ListCard from '../molecules/ListCard.jsx'

// Grid of card catalog boxes, plus the dashed "New box" slot at the end.
export default function ListGrid({ boxes, onCreate }) {
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    const cleanTitle = title.trim()
    if (!cleanTitle) return
    onCreate(cleanTitle)
    setTitle('')
    setAdding(false)
  }

  return (
    <ul className="grid max-w-4xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {boxes.map((box) => (
        <ListCard key={box.id} box={box} />
      ))}
      <li>
        {adding ? (
          <form
            onSubmit={handleSubmit}
            className="flex h-48 flex-col justify-center gap-3 border border-dashed border-line bg-card p-5"
          >
            <label htmlFor="new-box" className="font-mono text-sm uppercase tracking-widest text-muted">
              Box name
            </label>
            <input
              id="new-box"
              type="text"
              value={title}
              maxLength={60}
              autoFocus
              onChange={(event) => setTitle(event.target.value)}
              className="border-b border-muted bg-transparent font-mono focus:border-brand focus:outline-none"
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={!title.trim()}>
                Save
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="grid h-48 w-full place-items-center border border-dashed border-line font-mono text-sm font-semibold text-muted transition-colors hover:border-brand hover:text-brand focus-visible:outline-2 focus-visible:outline-brand"
          >
            <span>
              <span className="block text-2xl font-normal" aria-hidden="true">
                +
              </span>
              New box
            </span>
          </button>
        )}
      </li>
    </ul>
  )
}
