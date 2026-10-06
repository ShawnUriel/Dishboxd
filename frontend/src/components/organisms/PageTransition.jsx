import { useLocation } from 'react-router-dom'
import './page-transition.css'

// Only the page sheet turns: navigation and the loaded journal stay in place.
// A pathname key also covers back/forward navigation without replaying on filters.
export default function PageTransition({ children }) {
  const { pathname } = useLocation()
  return (
    <div className="paper-page-frame">
      <div key={pathname} className="paper-page">
        {children}
      </div>
    </div>
  )
}
