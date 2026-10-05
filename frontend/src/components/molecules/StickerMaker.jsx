import { useEffect, useRef, useState } from 'react'
import Button from '../atoms/Button.jsx'
import { STICKER_STYLES, readStickerImage, renderSticker } from '../../lib/stickers.js'
import { useJournal } from '../../state/useJournal.js'

// Turn any picture into a sticker: just the image, pixelated, flat "vector" colours or
// translucent, with an optional cut-out background and white sticker edge.
export default function StickerMaker({ onDone, onCancel }) {
  const { addSticker } = useJournal()
  const [source, setSource] = useState(null)
  const [options, setOptions] = useState({ style: 'original', cutOut: true, outline: true })
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const urls = useRef([])

  useEffect(() => {
    const created = urls.current
    return () => created.forEach((url) => URL.revokeObjectURL(url))
  }, [])

  useEffect(() => () => source?.close(), [source])

  useEffect(() => {
    if (!source) return
    let active = true
    renderSticker(source, options)
      .then((result) => {
        if (!active) return
        const url = URL.createObjectURL(result.blob)
        urls.current.push(url)
        setPreview({ ...result, url })
        setError('')
      })
      .catch((failure) => active && setError(failure.message))
    return () => {
      active = false
    }
  }, [source, options])

  async function choose(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError('')
    try {
      setSource(await readStickerImage(file))
    } catch (failure) {
      setError(failure.message)
    }
  }

  async function save() {
    if (!preview || busy) return
    setBusy(true)
    setError('')
    try {
      const sticker = await addSticker(preview.blob, options.style)
      onDone?.(sticker)
    } catch (failure) {
      setError(failure.message)
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <div className="sticker-preview grid aspect-square place-items-center overflow-hidden rounded-xl border border-line">
          {preview && source ? (
            <img src={preview.url} alt="Your sticker preview" className="max-h-[85%] max-w-[85%] object-contain drop-shadow" />
          ) : (
            <span className="px-4 text-center text-[11px] leading-5 text-muted">Your sticker shows up here</span>
          )}
        </div>
        <div className="min-w-0 space-y-3">
          <label className="block cursor-pointer rounded-lg border border-dashed border-accent/50 bg-accent/5 px-4 py-3 text-center text-xs text-accent hover:bg-accent/10 focus-within:outline-2 focus-within:outline-brand">
            {source ? 'Choose a different picture' : '+ Choose a picture'}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={choose} className="sr-only" />
          </label>
          <fieldset>
            <legend className="text-[10px] uppercase tracking-[0.16em] text-muted">Sticker style</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {STICKER_STYLES.map((style) => (
                <label
                  key={style.value}
                  className={`cursor-pointer rounded-lg border px-3 py-2 text-xs ${
                    options.style === style.value ? 'border-brand bg-brand/5' : 'border-line bg-card hover:border-muted'
                  }`}
                >
                  <input
                    type="radio"
                    name="sticker-style"
                    value={style.value}
                    checked={options.style === style.value}
                    onChange={() => setOptions({ ...options, style: style.value })}
                    className="sr-only"
                  />
                  <span className="block font-semibold text-ink">{style.label}</span>
                  <span className="mt-0.5 block text-[10px] leading-4 text-muted">{style.hint}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.cutOut}
                onChange={(event) => setOptions({ ...options, cutOut: event.target.checked })}
                className="accent-brand"
              />
              Cut out a plain background
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.outline}
                onChange={(event) => setOptions({ ...options, outline: event.target.checked })}
                className="accent-brand"
              />
              White sticker edge
            </label>
          </div>
          {source && preview && options.cutOut && !preview.cutOut && (
            <p className="text-[11px] leading-5 text-muted">No plain background found, so the whole picture is kept.</p>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-brand">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={save} disabled={!preview || !source || busy}>
          {busy ? 'Saving…' : 'Save sticker'}
        </Button>
        <Button size="sm" variant="secondary" onClick={onCancel} disabled={busy}>
          Back
        </Button>
      </div>
    </div>
  )
}
