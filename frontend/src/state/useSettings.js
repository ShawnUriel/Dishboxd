import { useContext } from 'react'
import { SettingsContext } from './settingsContext.js'
export const useSettings = () => useContext(SettingsContext)
