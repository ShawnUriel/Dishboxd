import { useEffect, useState } from 'react'
import { stickerUrl } from '../../lib/stickers.js'

// One sticker picture. Loads once per session and is shared by every card that uses it.
// A sticker that cannot be loaded (deleted from its owner's book) simply disappears.
// onShape gets the picture's height / width once it has loaded.
export default function StickerImage({ id, alt = '', className = '', onShape }) {
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
  return (
    <img
      src={loaded.url}
      alt={alt}
      draggable={false}
      onLoad={(event) => {
        const { naturalWidth, naturalHeight } = event.currentTarget
        if (naturalWidth) onShape?.(naturalHeight / naturalWidth)
      }}
      className={`sticker-img select-none ${className}`}
    />
  )
}
