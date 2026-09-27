import { useEffect } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import Navbar from './components/organisms/Navbar.jsx'
import Home from './pages/Home.jsx'
import ListDetail from './pages/ListDetail.jsx'
import Lists from './pages/Lists.jsx'
import NotFound from './pages/NotFound.jsx'
import RestaurantProfile from './pages/RestaurantProfile.jsx'
import Search from './pages/Search.jsx'
import VisitForm from './pages/VisitForm.jsx'
import { JournalProvider } from './state/JournalProvider.jsx'

// Start each new page at the top instead of keeping the old scroll position
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function App() {
  return (
    <BrowserRouter>
      <JournalProvider>
        <ScrollToTop />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-30 focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>
        <div className="min-h-screen md:flex">
          <Navbar />
          <main id="main" className="bg-lined min-h-screen min-w-0 flex-1 pb-24 md:pb-0">
            <div className="max-w-[90rem] px-4 pt-8 pb-12 md:px-15 md:pt-11">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/search" element={<Search />} />
                <Route path="/log/new" element={<VisitForm />} />
                <Route path="/restaurant/:id" element={<RestaurantProfile />} />
                <Route path="/lists" element={<Lists />} />
                <Route path="/lists/:id" element={<ListDetail />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </div>
          </main>
        </div>
      </JournalProvider>
    </BrowserRouter>
  )
}

export default App
