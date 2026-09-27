import { createContext } from 'react'

// Shared by JournalProvider (which fills it) and useJournal (which reads it)
export const JournalContext = createContext(null)
