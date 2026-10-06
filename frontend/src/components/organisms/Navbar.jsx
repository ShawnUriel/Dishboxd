import { NavLink } from 'react-router-dom'
import { FolderIcon, HomeIcon, SearchIcon, UserIcon, UsersIcon } from '../atoms/Icon.jsx'

const TYPE = 'text-[10px] tracking-wider sm:text-xs md:tracking-widest'
// Smaller and tighter, so "Collections" fits a phone's bottom bar and the narrow side tab
const LONG_TYPE = 'text-[9px] tracking-normal sm:text-xs sm:tracking-wider md:text-[9px] md:tracking-normal'

// Orange tab uses dark text: white on orange fails the 4.5:1 contrast check.
const tabs = [
  { to: '/', label: 'Home', Icon: HomeIcon, color: 'bg-brand text-white', end: true },
  { to: '/search', label: 'Search', Icon: SearchIcon, color: 'bg-accent text-white' },
  { to: '/lists', label: 'Collections', Icon: FolderIcon, color: 'bg-tray text-ink', type: LONG_TYPE },
  { to: '/friends', label: 'Friends', Icon: UsersIcon, color: 'bg-box-lavender text-ink' },
  { to: '/profile', label: 'Profile', Icon: UserIcon, color: 'bg-box-mint text-ink' },
]

// Index-card tabs down the left edge; on a phone they become a bottom tab bar.
// The active tab sticks out further, like a pulled divider in a card drawer.
export default function Navbar() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 bg-sidebar px-3 pt-2 pb-[env(safe-area-inset-bottom)] md:sticky md:top-0 md:h-screen md:w-20 md:shrink-0 md:px-0 md:pt-7 md:pb-0"
    >
      <ul className="flex gap-2 md:flex-col md:gap-4.5">
        {tabs.map(({ to, label, Icon, color, end, type = TYPE }) => (
          <li key={to} className="min-w-0 flex-1 md:flex-none">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-2 rounded-t-xl py-3 font-mono font-semibold uppercase transition-all ${type} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink md:ml-2.5 md:h-[102px] md:translate-y-0 md:rounded-t-none md:rounded-r-xl md:py-0 ${color} ${
                  isActive ? 'shadow-md md:w-20' : 'translate-y-1.5 hover:translate-y-0.5 md:w-[70px] md:hover:w-[74px]'
                }`
              }
            >
              <Icon />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
