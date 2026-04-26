import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useChartData } from './useChartData'
import { analytics } from '../../../api'

const LIMITS = [25, 50, 100]

export function TagTracksTable({ tag, tagType, fromDate, toDate, onClose }) {
  const navigate = useNavigate()
  const [limit, setLimit] = useState(50)

  const fetcher = tagType === 'genre'
    ? () => analytics.genreTagTracks(tag, { limit, from_date: fromDate, to_date: toDate })
    : () => analytics.moodTagTracks(tag,  { limit, from_date: fromDate, to_date: toDate })

  const { data, loading } = useChartData(fetcher, [tag, tagType, limit, fromDate, toDate])
  const rows = data ?? []

  return (
    <div className="mt-3 border-t border-zinc-800 pt-3">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-300">
            Top tracks — <span className="text-violet-400">{tag}</span>
          </span>
          <div className="flex gap-1">
            {LIMITS.map(n => (
              <button key={n} onClick={() => setLimit(n)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                  limit === n ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-600 hover:text-zinc-400'
                }`}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <button onClick={onClose} className="text-zinc-600 hover:text-zinc-400 text-xs leading-none">✕</button>
      </div>

      {/* Track table */}
      {loading
        ? <div className="text-zinc-600 text-xs py-3 text-center">Loading…</div>
        : rows.length === 0
          ? <div className="text-zinc-700 text-xs py-3 text-center">No tracks found for this tag</div>
          : (
            <div className="max-h-64 overflow-y-auto space-y-0.5">
              {rows.map((r, i) => (
                <div key={`${r.artist}-${r.track}`}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-800/60 group transition-colors">
                  <span className="text-[10px] text-zinc-600 w-5 shrink-0 tabular-nums">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-zinc-200 truncate">{r.track}</p>
                    <p className="text-[10px] text-zinc-500 truncate">{r.artist}</p>
                  </div>
                  <span className="text-[10px] text-zinc-500 tabular-nums shrink-0">{r.plays.toLocaleString()}</span>
                  <button
                    onClick={() => navigate(`/explore/track/${encodeURIComponent(r.track)}`)}
                    className="text-[10px] text-zinc-700 hover:text-violet-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Deep dive">
                    →
                  </button>
                </div>
              ))}
            </div>
          )
      }
    </div>
  )
}
