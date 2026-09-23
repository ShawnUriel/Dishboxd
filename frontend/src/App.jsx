import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Search from './pages/Search.jsx'
import VisitForm from './pages/VisitForm.jsx'

function App() {
  return (
    <BrowserRouter>
      <nav>
        <NavLink to="/">Home</NavLink> |{' '}
        <NavLink to="/search">Search</NavLink> |{' '}
        <NavLink to="/log/new">Visit Form</NavLink>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/search" element={<Search />} />
        <Route path="/log/new" element={<VisitForm />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
