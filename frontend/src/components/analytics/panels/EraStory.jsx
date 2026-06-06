import { useState, useEffect } from 'react'
import { analytics } from '../../../api'

export function EraStory({ fromDate, toDate, label }) {
  const [story, setStory] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!fromDate || !toDate) return

    const fetchStory = async () => {
      setLoading(true)
      try {
        // Fetch stats for this era
        const [topArtists, topGenres] = await Promise.all([
          analytics.topEntities({ entity_type: 'artist', from_date: fromDate, to_date: toDate, limit: 5 }),
          analytics.genreBreakdown({ from_date: fromDate, to_date: toDate, limit: 5 })
        ])

        // Build narrative
        const totalPlays = topArtists.reduce((sum, a) => sum + a.plays, 0)
        const uniqueArtists = topArtists.length
        const topGenre = topGenres?.[0]?.tag || 'unknown'
        const topArtist = topArtists?.[0]?.name || 'unknown'

        const narrative = `
          ${totalPlays.toLocaleString()} plays · ${uniqueArtists} artists
          Peak: ${topGenre} · Led by ${topArtist}
        `.trim()

        setStory(narrative)
      } catch (err) {
        console.error('Error fetching era story:', err)
        setStory('Era data unavailable')
      } finally {
        setLoading(false)
      }
    }

    fetchStory()
  }, [fromDate, toDate])

  if (!story && !loading) return null

  return (
    <div className="text-xs text-zinc-500 italic">
      {loading ? '⏳ Generating era summary…' : story}
    </div>
  )
}
