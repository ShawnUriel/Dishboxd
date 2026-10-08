import { useState } from 'react'
import { Link } from 'react-router-dom'
import { collectPassport } from '../../lib/passport.js'
import { useJournal } from '../../state/useJournal.js'
import CuisineIllustration from '../molecules/CuisineIllustration.jsx'

export default function FoodPassport({ name }) {
  const { visits, restaurants } = useJournal()
  const [open, setOpen] = useState(false)
  const [spread, setSpread] = useState(0)
  const stamps = collectPassport(visits, restaurants)
  const earned = stamps.filter(stamp => stamp.earned).length
  const pages = [stamps.slice(spread * 6, spread * 6 + 3), stamps.slice(spread * 6 + 3, spread * 6 + 6)]
  return (
    <section className="food-passport" aria-labelledby="passport-title">
      <div className="keepsake-heading">
        <div><p className="keepsake-eyebrow">A little taste of everywhere</p><h2 id="passport-title">Your food passport</h2></div>
        <span className="keepsake-count" aria-label={`${earned} of ${stamps.length} cuisine stamps collected`}>{String(earned).padStart(2, '0')} / {stamps.length}</span>
      </div>
      {!open ? (
        <button type="button" className="passport-cover" onClick={() => setOpen(true)} aria-label={`Open food passport, ${earned} cuisine stamps collected`} aria-expanded="false" aria-controls="passport-pages">
          <span className="passport-cover-border">
            <span className="passport-issuer">Dishboxd · Dining society</span>
            <span className="passport-cover-title">Food<br /><em>Passport</em></span>
            <svg className="passport-emblem" viewBox="0 0 100 80" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><circle cx="50" cy="36" r="27"/><ellipse cx="50" cy="36" rx="12" ry="27"/><path d="M23 36h54M28 22h44M28 50h44M13 16v41m-5-41v13h10V16m70 0v41m0-41c-11 4-11 17 0 17M39 72h22"/></svg>
            <span className="passport-owner">Issued to {name}</span>
            <span className="passport-open-hint">{earned ? `${earned} cuisine${earned === 1 ? '' : 's'} tasted` : 'Your first stamp is one meal away'} <span aria-hidden="true">↗</span> Open your book</span>
          </span>
        </button>
      ) : (
        <div id="passport-pages" className="passport-open">
          <div className="passport-book-toolbar"><span>Permission to explore</span><button type="button" onClick={() => setOpen(false)} aria-expanded="true" aria-controls="passport-pages">Close book ×</button></div>
          <div className="passport-spread" key={spread}>
            {pages.map((page, index) => (
              <div className="passport-page" key={index}>
                <p className="passport-page-caption">{index === 0 ? 'A world of flavour' : 'Memories, stamped'}</p>
                <div className="passport-stamps">
                  {page.map(stamp => {
                    const content = <><CuisineIllustration type={stamp.icon} /><span className="passport-stamp-name">{stamp.name}</span><span className="passport-stamp-date">{stamp.earned ? stamp.firstVisit.date : 'Not yet tasted'}</span></>
                    return stamp.earned ? <Link className="passport-stamp is-earned" key={stamp.id} style={{ '--stamp-ink': stamp.color }} to={`/review/${stamp.firstVisit.id}`} aria-label={`${stamp.name} stamp, earned ${stamp.firstVisit.date}. Open first review.`}>{content}</Link>
                      : <div className="passport-stamp is-locked" key={stamp.id} aria-label={`${stamp.name}, not yet collected`}>{content}</div>
                  })}
                </div>
                <span className="passport-page-number">{String(spread * 2 + index + 1).padStart(2, '0')}</span>
              </div>
            ))}
          </div>
          <div className="passport-pagination"><button type="button" disabled={spread === 0} onClick={() => setSpread(value => value - 1)} aria-label="Previous passport pages">← Previous</button><span role="status">Pages {spread * 2 + 1}–{spread * 2 + 2} of 4</span><button type="button" disabled={spread === 1} onClick={() => setSpread(value => value + 1)} aria-label="Next passport pages">Next →</button></div>
        </div>
      )}
      <p className="keepsake-footnote">One cuisine, one stamp. Choose a cuisine in your restaurant’s category and save a review to collect it. Your existing reviews count, too.</p>
      <Link className="keepsake-link" to="/log/new">Where will your next bite take you? →</Link>
    </section>
  )
}
