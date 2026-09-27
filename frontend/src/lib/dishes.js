// A blank line item for the ticket. The key keeps React rows stable when one is removed.
export function newDish() {
  return { key: crypto.randomUUID(), name: '', price: '' }
}
