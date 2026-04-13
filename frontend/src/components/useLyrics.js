import { useEffect, useState } from 'react'

export function useLyrics() {
  const [tracks,  setTracks]  = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/taste/lyrics-snippets')
      .then(r => r.json())
      .then(data => {
        if (data.length) {
          setTracks(data)
          setLoading(false)
        } else {
          // Cache empty — fall back to raw top tracks (no snippets yet)
          return fetch('/api/taste/top-tracks?days=30&limit=40')
            .then(r => r.json())
            .then(data => { setTracks(data); setLoading(false) })
        }
      })
      .catch(() => setLoading(false))
  }, [])

  return { tracks, loading }
}
