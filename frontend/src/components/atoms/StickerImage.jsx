import { useEffect, useState } from 'react'
import { stickerUrl } from '../../lib/stickers.js'

// One sticker picture. Loads once per session and is shared by every card that uses it.
// A sticker that cannot be loaded (deleted from its owner's book) simply disappears.
export default function StickerImage({ id, alt = '', className = '' }) {
  const [loaded, setLoaded] = useState(null)
  useEffect(() => {
    let active = true
    stickerUrl(id)
      .then((url) => active && setLoaded({ id, url }))
      .catch(() => active && setLoaded({ id, url: null }))
    return () => {
      active = false
    }
  }, [id])
  if (loaded?.id !== id) {
    return <span aria-hidden="true" className={`block aspect-square rounded-full bg-sidebar/40 ${className}`} />
  }
  if (!loaded.url) return null
  return <img src={loaded.url} alt={alt} draggable={false} className={`sticker-img select-none ${className}`} />
}
