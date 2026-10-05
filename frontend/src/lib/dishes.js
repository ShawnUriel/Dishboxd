// A blank item for the ticket. The key keeps React rows stable when one is removed.
// Each item has its own score out of 10, a note, and room for one sticker.
export function newDish() {
  return { key: crypto.randomUUID(), name: '', price: '', score: null, description: '', sticker: null }
}
