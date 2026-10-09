import { Link } from 'react-router-dom'
import Photo from '../atoms/Photo.jsx'
import FoodSticker from '../atoms/FoodSticker.jsx'
import { formatDate } from '../../lib/format.js'

export default function HomeMemoryCollage({ visits }) {
  const latest = [...visits].sort((a, b) => b.date.localeCompare(a.date))[0]
  return <div className="home-memory-collage">
    <span className="collage-orbit" aria-hidden="true" />
    <span className="collage-label sticker-label" aria-hidden="true">Good food<br /><em>good mood.</em></span>
    <Link to={latest ? `/review/${latest.id}` : '/log/new'} className="memory-polaroid" aria-label={latest ? `Revisit your meal at ${latest.restaurant?.name || 'your last restaurant'}` : 'Write your first food memory'}>
      <span className="scrapbook-tape" aria-hidden="true" />
      {latest?.photoIds?.[0] ? <Photo id={latest.photoIds[0]} alt={`Your meal at ${latest.restaurant?.name || 'your last restaurant'}`} className="memory-photo" /> : <div className="memory-illustration"><span className="memory-illustration-halo" /><FoodSticker kind="bowl" /><span className="memory-spark memory-spark-one" aria-hidden="true">✧</span><span className="memory-spark memory-spark-two" aria-hidden="true">✳</span></div>}
      <span className="memory-caption">{latest?.restaurant?.name || 'A memory in the making'}</span>
      <span className="memory-date">{latest ? formatDate(latest.date) : 'Just add one really good meal'}</span>
    </Link>
    <FoodSticker kind="coffee" className="collage-coffee" />
    <FoodSticker kind="cherry" className="collage-cherries" />
    <span className="collage-postmark" aria-hidden="true"><span>SAVOUR</span><b>THE LITTLE</b><span>THINGS</span></span>
    <svg className="collage-doodle" viewBox="0 0 110 70" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M8 12c29 1 15 37 43 36 20-1 15-24 3-20-11 4 7 37 40 25m-9-9 11 9-10 9" /></svg>
  </div>
}
