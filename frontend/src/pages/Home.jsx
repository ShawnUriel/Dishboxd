import { useEffect, useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

function Home() {
  const [status, setStatus] = useState('Checking backend...')

  // Empty dependency array = run once when the page opens (no endless loop)
  useEffect(() => {
    fetch(`${API_URL}/api/test`)
      .then((res) => res.json())
      .then((data) => setStatus(data.message))
      .catch(() => setStatus('Backend not reachable'))
  }, [])

  return (
    <main>
      <h1>Dishboxd</h1>
      <p>Home - recent visits will show here.</p>
      <p>Backend status: {status}</p>
    </main>
  )
}

export default Home
