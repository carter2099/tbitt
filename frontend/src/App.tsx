import { useState } from 'react'

function App() {
  const [message, setMessage] = useState<string>('')

  const fetchMessage = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/health`)
      const data = await response.json()
      setMessage(data.message)
    } catch (error) {
      console.error('Error fetching message:', error)
    }
  }

  return (
    <div>
      <h1>TBITT App</h1>
      <button onClick={fetchMessage}>Check Backend Connection</button>
      {message && <p>{message}</p>}
    </div>
  )
}

export default App 