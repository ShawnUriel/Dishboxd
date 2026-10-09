import { useEffect, useState } from 'react'
import { api } from '../../lib/api.js'

export default function Photo({ id, alt, className = '', fallback = 'Photo', fit = 'cover', ...props }) {
  const [photo, setPhoto] = useState(null)
  useEffect(() => {
    if (!id) return
    const controller = new AbortController()
    let url
    api(`/api/media/${id}`, { binary: true, signal: controller.signal })
      .then((blob) => {
        if (controller.signal.aborted) return
        url = URL.createObjectURL(blob)
        setPhoto({ id, url })
      })
      .catch(() => {})
    return () => {
      controller.abort()
      if (url) URL.revokeObjectURL(url)
    }
  }, [id])
  if (!id || photo?.id !== id) {
    return (
      <div role="img" aria-label={alt} className={`grid place-items-center bg-badge text-brand ${className}`}>
        <span className="font-serif text-2xl">{fallback}</span>
      </div>
    )
  }
  return <img src={photo.url} alt={alt} loading="lazy" decoding="async" className={`${fit === 'contain' ? 'object-contain' : 'object-cover'} ${className}`} {...props} />
}
