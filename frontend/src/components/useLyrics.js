import { useEffect, useState } from 'react'

export function useLyrics() {
  const [tracks, setTracks] = useState([])

  useEffect(() => {
    fetch('/api/taste/lyrics-snippets')
      .then(r => r.json())
      .then(data => {
        if (data.length) {
          setTracks(data)
        } else {
          return fetch('/api/taste/top-tracks?days=900&limit=40')
            .then(r => r.json())
            .then(setTracks)
        }
      })
      .catch(() => {})
  }, [])

  return tracks
}
