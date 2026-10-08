import { useEffect, useState } from 'react'
import { api } from '../../lib/api.js'
import { useStickerPlacements } from '../../lib/useStickerPlacements.js'
import { useJournal } from '../../state/useJournal.js'
import StickerLayer from '../molecules/StickerLayer.jsx'
import StickerTray from '../molecules/StickerTray.jsx'

function DecorationCanvas({ userId, initial }) {
  const { stickers } = useJournal()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const saved = useStickerPlacements({ type: 'home', id: userId }, initial)
  // Deleting a sticker from the book also removes it from this private corner.
  const available = new Set(stickers.map(sticker => sticker.id))
  const placements = saved.placements.filter(placement => available.has(placement.stickerId))
  return <>
    <div className={`sticker-corner-canvas relative isolate ${editing ? 'is-editing' : ''}`}>
      <span className="corner-tape" aria-hidden="true" />
      <p className="corner-handwriting" aria-hidden="true">little things I love</p>
      <StickerLayer placements={placements} size={78} editing={editing && !busy} onUpdate={saved.update} onRemove={saved.remove} label="Your home stickers" />
      {!placements.length && <div className="corner-empty"><span aria-hidden="true">✳</span><p>A tiny space,<br />entirely yours.</p><span>Food photos, doodles, happy little finds.</span></div>}
      <span className="corner-private">Just for you · {placements.length}/12 stickers</span>
    </div>
    {saved.error && <p role="alert" className="mt-3 text-xs text-brand">{saved.error}</p>}
    <div className="corner-actions"><button type="button" className="keepsake-link" disabled={busy} onClick={() => setEditing(value => !value)} aria-expanded={editing}>{editing ? 'Done decorating ✓' : 'Decorate your corner ↗'}</button><span>{editing ? 'Changes save automatically' : 'Your own little scrapbook'}</span></div>
    {editing && <div className="mt-3"><StickerTray title="Pick a little keepsake" onBusyChange={setBusy} onPick={async id => { setBusy(true); try { await saved.add(id) } finally { setBusy(false) } }} /><p className="keepsake-footnote">Drag to arrange. Tap to tilt, resize, or peel off. Keyboard: arrows move; brackets tilt; + / − resize; Delete removes.</p></div>}
  </>
}

export default function HomeStickerCorner({ userId }) {
  const [initial, setInitial] = useState(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    if (!userId) return
    const controller = new AbortController()
    api('/api/stickers/home', { signal: controller.signal }).then(data => { if (!controller.signal.aborted) { setInitial(data.placements); setError('') } }).catch(failure => { if (!controller.signal.aborted) setError(failure.message) })
    return () => controller.abort()
  }, [userId, retry])
  return <section className="home-sticker-corner" aria-labelledby="sticker-corner-title"><div className="keepsake-heading"><div><p className="keepsake-eyebrow">Collected & cherished</p><h2 id="sticker-corner-title">Your sticker corner</h2></div><span className="corner-heading-star" aria-hidden="true">✳</span></div>
    {error ? <div className="sticker-corner-canvas grid place-content-center p-6 text-center"><p role="alert" className="text-sm text-brand">Could not open your sticker corner.</p><button className="keepsake-link mt-3" type="button" onClick={() => setRetry(value => value + 1)}>Try again</button></div> : initial === null ? <div className="sticker-corner-canvas grid place-content-center"><p role="status" className="text-xs text-muted">Unpacking your stickers…</p></div> : <DecorationCanvas key={userId} userId={userId} initial={initial} />}
  </section>
}
