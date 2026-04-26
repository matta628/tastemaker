import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnalyticsShell } from './AnalyticsShell'
import { analytics } from '../../api'
import { useChartData } from './charts/useChartData'

const ENTITY_TYPES = [
  { key: 'artist', label: 'Artists' },
  { key: 'album',  label: 'Albums'  },
  { key: 'track',  label: 'Tracks'  },
]

export function Explore() {
  const navigate = useNavigate()
  const [entity, setEntity] = useState('artist')
  const [search, setSearch] = useState('')

  const { data: raw, loading } = useChartData(
    () => {
      const p = { sort_by: 'total_plays', sort_dir: 'desc', limit: 10, search: search || undefined }
      if (entity === 'artist') return analytics.entitiesArtists(p)
      if (entity === 'album')  return analytics.entitiesAlbums(p)
      return analytics.entitiesTracks(p)
    },
    [entity, search]
  )

  const rows = raw?.rows ?? []
  const nameKey = entity === 'artist' ? 'artist' : entity === 'album' ? 'album' : 'track'

  return (
    <AnalyticsShell>
      <div className="flex flex-col items-center justify-start pt-16 px-6 h-full">
        <h1 className="text-2xl font-semibold text-zinc-100 mb-1">Deep Dive</h1>
        <p className="text-zinc-500 text-sm mb-8">Search for an artist, album, or track to explore</p>

        <div className="w-full max-w-lg">
          {/* Entity toggle */}
          <div className="flex gap-1 mb-4">
            {ENTITY_TYPES.map(t => (
              <button key={t.key} onClick={() => { setEntity(t.key); setSearch('') }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  entity === t.key ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${entity}s…`}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-100
              placeholder:text-zinc-600 focus:outline-none focus:border-violet-500 transition-colors"
          />

          {/* Results */}
          <div className="mt-2 space-y-0.5">
            {loading && <p className="text-xs text-zinc-600 px-1 py-2">Loading…</p>}
            {!loading && rows.map((row, i) => {
              const name = row[nameKey]
              const sub = entity === 'album' ? row.artist : entity === 'track' ? row.artist : null
              return (
                <button key={i}
                  onClick={() => navigate(`/explore/${entity}/${encodeURIComponent(name)}`)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg
                    hover:bg-zinc-800 text-left transition-colors group">
                  <div>
                    <span className="text-sm text-zinc-200 group-hover:text-white">{name}</span>
                    {sub && <span className="text-xs text-zinc-500 ml-2">{sub}</span>}
                  </div>
                  <span className="text-xs text-zinc-600">{row.total_plays?.toLocaleString()} plays</span>
                </button>
              )
            })}
            {!loading && rows.length === 0 && search && (
              <p className="text-xs text-zinc-600 px-1 py-2">No results</p>
            )}
          </div>
        </div>
      </div>
    </AnalyticsShell>
  )
}
