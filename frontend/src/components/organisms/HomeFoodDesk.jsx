import { useState } from 'react'
import { Link } from 'react-router-dom'
import FoodSticker from '../atoms/FoodSticker.jsx'
import { useJournal } from '../../state/useJournal.js'
import { todayIso } from '../../lib/format.js'

function weekDates() {
  const today = new Date()
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7))
  return { start: `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`, end: todayIso() }
}

export default function HomeFoodDesk() {
  const { bookmarks, visits, restaurants } = useJournal()
  const [choiceId, setChoiceId] = useState(null)
  const [draw, setDraw] = useState(0)
  const choice = bookmarks.find(place => place.id === choiceId)
  const { start, end } = weekDates()
  const thisWeek = visits.filter(visit => visit.date >= start && visit.date <= end)
  const oldPlaces = new Set(visits.filter(visit => visit.date < start).map(visit => visit.restaurantId))
  const newPlaces = new Set(thisWeek.filter(visit => !oldPlaces.has(visit.restaurantId)).map(visit => visit.restaurantId))
  const dishCount = thisWeek.reduce((total, visit) => total + visit.dishes.length, 0)
  const favourite = thisWeek.flatMap(visit => visit.dishes.map(dish => ({ ...dish, visitId: visit.id }))).filter(dish => dish.score != null).sort((a, b) => b.score - a.score)[0]
  function shuffle() {
    const pool = bookmarks.length > 1 ? bookmarks.filter(place => place.id !== choiceId) : bookmarks
    if (!pool.length) return
    setChoiceId(pool[Math.floor(Math.random() * pool.length)].id)
    setDraw(value => value + 1)
  }
  return <section className="home-food-desk" aria-labelledby="food-desk-title">
    <div className="food-desk-heading"><div><p className="keepsake-eyebrow">A little room for spontaneity</p><h2 id="food-desk-title">What sounds good today?</h2></div><span className="desk-handwriting" aria-hidden="true">follow your appetite <span>↙</span></span></div>
    <div className="food-desk-cards">
      <article className="next-bite-card">
        <span className="scrapbook-tape" aria-hidden="true" />
        <div className="next-bite-top"><span className="desk-ticket-label">The indecisive diner’s club</span><span className="desk-ticket-number">No. {String(bookmarks.length).padStart(3, '0')}</span></div>
        <FoodSticker kind="star" className="next-bite-star" />
        <h3>Let your next bite<br /><em>find you.</em></h3>
        <p className="next-bite-copy">{bookmarks.length ? `${bookmarks.length} saved ${bookmarks.length === 1 ? 'place' : 'places'}, a world of possibilities. Pick a little adventure from your want-to-try list.` : 'That café you keep walking past? Save it to your want-to-try list. We’ll help you pick where to go next.'}</p>
        <div className="next-bite-result" aria-live="polite" aria-atomic="true">
          {choice ? <div className="bite-reveal" key={draw}><span className="bite-reveal-eyebrow">Your next stop could be…</span><p className="bite-place-name">{choice.name}</p><p className="bite-place-address">{choice.address || choice.category || 'A fresh page in your food journal.'}</p><Link to="/log/new" state={{ place: choice }} className="keepsake-link">Been here? Write a review →</Link><span className="bite-confetti" aria-hidden="true">✦</span></div> : <div className="bite-placeholder"><span aria-hidden="true">?</span><p>A delicious little plot twist.</p></div>}
        </div>
        <div className="next-bite-actions">{bookmarks.length ? <button type="button" className="bite-shuffle-button" onClick={shuffle}><svg className="shuffle-icon" key={draw} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01" strokeWidth="3" strokeLinecap="round"/></svg>{choice ? bookmarks.length === 1 ? 'Pick again' : 'Shuffle again' : 'Pick my next bite'}</button> : <Link to="/bookmarks" className="bite-shuffle-button">+ Save your first place</Link>}<Link to="/bookmarks" className="keepsake-link">Your want-to-try list ↗</Link></div>
      </article>
      <article className="weekly-receipt" aria-labelledby="weekly-receipt-title">
        <span className="receipt-pin" aria-hidden="true" />
        <div className="receipt-head"><span className="receipt-mini-star" aria-hidden="true">✳</span><p>Dishboxd / A good week, on paper</p><h3 id="weekly-receipt-title">Your week in bites</h3><span>Monday → today · {end.slice(5).replace('-', '/')}</span></div>
        <dl className="receipt-tallies">{[[thisWeek.length, 'Meals remembered'], [dishCount, 'Dishes tried'], [newPlaces.size, 'New places discovered']].map(([count, label]) => <div key={label}><dt>{label}</dt><dd>{String(count).padStart(2, '0')}</dd></div>)}</dl>
        <div className="receipt-highlight"><span className="receipt-label">{favourite ? 'Your highest-rated bite' : 'A little quest for the week'}</span>{favourite ? <><Link to={`/review/${favourite.visitId}`}>{favourite.name} <span>{favourite.score}/10</span></Link><p>Good taste. Worth remembering.</p></> : <><p className="receipt-quest">{newPlaces.size ? 'A new place. A new memory. ✓' : 'Try one place you’ve never reviewed.'}</p><Link to={restaurants.length ? '/search' : '/log/new'} className="keepsake-link">{newPlaces.size ? 'Find another little discovery →' : 'Make a little discovery →'}</Link></>}</div>
        <div className="receipt-footer"><span aria-hidden="true" className="receipt-barcode" /><p>No rush. Just good food.</p></div>
      </article>
    </div>
  </section>
}
