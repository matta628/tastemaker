import { useState, useEffect } from 'react'
import { analytics } from '../../../api'

export function DriftAnalysis({ fromDate, toDate }) {
  const [drift, setDrift] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!fromDate || !toDate) return

    const fetchDrift = async () => {
      setLoading(true)
      try {
        // Fetch era genres
        const eraGenres = await analytics.genreBreakdown({ from_date: fromDate, to_date: toDate, limit: 10 })

        // Fetch current genres (last 30 days)
        const now = new Date().toISOString().slice(0, 10)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
        const currentGenres = await analytics.genreBreakdown({ from_date: thirtyDaysAgo, to_date: now, limit: 10 })

        // Compute changes
        const eraGenreMap = new Map(eraGenres.map(g => [g.tag, g.plays]))
        const currentGenreMap = new Map(currentGenres.map(g => [g.tag, g.plays]))

        const allGenres = new Set([...eraGenreMap.keys(), ...currentGenreMap.keys()])
        const changes = Array.from(allGenres)
          .map(genre => {
            const eraPlays = eraGenreMap.get(genre) || 0
            const currentPlays = currentGenreMap.get(genre) || 0
            const delta = currentPlays - eraPlays
            return { genre, eraPlays, currentPlays, delta, change: eraPlays > 0 ? Math.round((delta / eraPlays) * 100) : (currentPlays > 0 ? 100 : 0) }
          })
          .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
          .slice(0, 5)

        const rising = changes.filter(c => c.delta > 0)
        const falling = changes.filter(c => c.delta < 0)

        setDrift({ rising, falling })
      } catch (err) {
        console.error('Error fetching drift analysis:', err)
        setDrift({ rising: [], falling: [] })
      } finally {
        setLoading(false)
      }
    }

    fetchDrift()
  }, [fromDate, toDate])

  if (!drift && !loading) return null

  return (
    <div className="mt-4 space-y-2 text-xs">
      {loading && <div className="text-zinc-500">⏳ Analyzing taste drift…</div>}

      {drift && (
        <>
          {drift.rising.length > 0 && (
            <div>
              <div className="text-zinc-500 font-medium mb-1">📈 Rising</div>
              <div className="space-y-0.5 pl-2">
                {drift.rising.map((item) => (
                  <div key={item.genre} className="text-zinc-400">
                    {item.genre} <span className="text-emerald-400">+{item.change}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {drift.falling.length > 0 && (
            <div>
              <div className="text-zinc-500 font-medium mb-1">📉 Falling</div>
              <div className="space-y-0.5 pl-2">
                {drift.falling.map((item) => (
                  <div key={item.genre} className="text-zinc-400">
                    {item.genre} <span className="text-orange-400">{item.change}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
