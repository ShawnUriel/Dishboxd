import { useEffect } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { GuestOnly, RequireAuth } from './components/organisms/AuthGate.jsx'
import Navbar from './components/organisms/Navbar.jsx'
import PageTransition from './components/organisms/PageTransition.jsx'
import Home from './pages/Home.jsx'
import Bookmarks from './pages/Bookmarks.jsx'
import EditReview from './pages/EditReview.jsx'
import NotificationSettings from './pages/NotificationSettings.jsx'
import ListDetail from './pages/ListDetail.jsx'
import Lists from './pages/Lists.jsx'
import Login from './pages/Login.jsx'
import NotFound from './pages/NotFound.jsx'
import RestaurantProfile from './pages/RestaurantProfile.jsx'
import Search from './pages/Search.jsx'
import SignUp from './pages/SignUp.jsx'
import VerifyEmail from './pages/VerifyEmail.jsx'
import VisitForm from './pages/VisitForm.jsx'
import Profile from './pages/Profile.jsx'
import Friends from './pages/Friends.jsx'
import ReviewPage from './pages/ReviewPage.jsx'

// Start each new page at the top instead of keeping the old scroll position
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

// Index-card tabs + ruled paper around every journal page
function JournalLayout() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-30 focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <div className="min-h-screen md:flex">
        <Navbar />
        <main id="main" className="bg-lined min-h-screen min-w-0 flex-1 pb-24 md:pb-0">
          <div className="mx-auto max-w-[82rem] px-4 pt-6 pb-12 sm:px-8 md:px-10 md:pt-9 lg:px-12">
            <PageTransition>
              <Outlet />
            </PageTransition>
          </div>
        </main>
      </div>
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route element={<PageTransition><Outlet /></PageTransition>}>
          <Route element={<GuestOnly />}>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
          </Route>
          <Route path="/verify-email" element={<VerifyEmail />} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route element={<JournalLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<Search />} />
            <Route path="/bookmarks" element={<Bookmarks />} />
            <Route path="/settings/notifications" element={<NotificationSettings />} />
            <Route path="/log/new" element={<VisitForm />} />
            <Route path="/restaurant/:id" element={<RestaurantProfile />} />
            <Route path="/lists" element={<Lists />} />
            <Route path="/lists/:id" element={<ListDetail />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/:id" element={<Profile />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/people" element={<Navigate to="/friends?tab=find" replace />} />
            <Route path="/review/:id" element={<ReviewPage />} />
            <Route path="/review/:id/edit" element={<EditReview />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
