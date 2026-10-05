import { useRef, useState } from 'react'
import { api } from './api.js'

// Stickers stuck on one saved card (a profile, review, box or dish): add, move, tilt, resize, peel off.
// Every change is saved straight away; onSync gets the new list so the page can keep its copy current.
export function useStickerPlacements(target, initial = [], onSync) {
  const [placements, setPlacements] = useState(initial)
  const [error, setError] = useState('')
  const current = useRef(initial)

  function commit(next) {
    current.current = next
    setPlacements(next)
    onSync?.(next)
  }

  async function add(stickerId) {
    setError('')
    const draft = {
      stickerId,
      x: Math.round(62 + Math.random() * 30),
      y: Math.round(10 + Math.random() * 30),
      rotation: Math.round(Math.random() * 20 - 10),
      scale: 1,
    }
    try {
      const { placement } = await api('/api/stickers/placements', { method: 'POST', body: { ...draft, target } })
      commit(target.type === 'dish' ? [placement] : [...current.current, placement])
    } catch (failure) {
      setError(failure.message)
    }
  }

  async function update(placement, changes) {
    setError('')
    const before = current.current
    commit(before.map((p) => (p.id === placement.id ? { ...p, ...changes } : p)))
    try {
      const { placement: saved } = await api(`/api/stickers/placements/${placement.id}`, {
        method: 'PATCH',
        body: changes,
      })
      commit(current.current.map((p) => (p.id === saved.id ? saved : p)))
    } catch (failure) {
      setError(failure.message)
      commit(before)
    }
  }

  async function remove(placement) {
    setError('')
    const before = current.current
    commit(before.filter((p) => p.id !== placement.id))
    try {
      await api(`/api/stickers/placements/${placement.id}`, { method: 'DELETE' })
    } catch (failure) {
      setError(failure.message)
      commit(before)
    }
  }

  return { placements, add, update, remove, error }
}
