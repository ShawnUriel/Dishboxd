import { useContext } from 'react'
import { JournalContext } from './journalContext.js'

// Restaurants, visits, boxes and the actions that change them
export function useJournal() {
  const journal = useContext(JournalContext)
  if (!journal) throw new Error('useJournal must be used inside <JournalProvider>')
  return journal
}
