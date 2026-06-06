import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useChartData } from './useChartData'
import { analytics } from '../../../api'

const LIMITS = [25, 50, 100]

function GenreEditCell({ value, artist, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')

  const commit = async () => {
    setEditing(false)
    if (draft === (value ?? '')) return
    try {
      await analytics.setGenreOverride({ artist, genre: draft })
      onSave(artist, draft)
    } catch (e) { console.error('Genre save failed', e) }
  }

  if (editing) return (
    <input autoFocus value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') commit()
        if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false) }
      }}
      onClick={e => e.stopPropagation()}
      className="bg-zinc-700 border border-violet-500 rounded px-1.5 py-0.5 text-[10px] text-zinc-100 w-28 outline-none mt-0.5"
    />
  )

  return (
    <span
      onClick={e => { e.stopPropagation(); setDraft(value ?? ''); setEditing(true) }}
      className="cursor-text text-[10px] text-zinc-500 hover:text-zinc-300 group inline-flex items-center gap-0.5 border border-transparent hover:border-zinc-700 rounded px-1 py-0.5 transition-colors mt-0.5"
      title="Click to edit genre">
      {value || <span className="text-zinc-700">no genre</span>}
      <span className="opacity-0 group-hover:opacity-100 text-[9px] ml-0.5">✎</span>
    </span>
  )
}

function MoodTagChips({ tags, track, artist, availableMoods, onRemove, onAdd }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef()

  useEffect(() => {
    if (!pickerOpen) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) { setPickerOpen(false); setQuery('') } }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [pickerOpen])

  const filtered = availableMoods
    .filter(m => !tags.includes(m) && m.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 12)

  return (
    <div className="flex flex-wrap items-center gap-1 mt-1">
      {tags.map(t => (
        <span key={t}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-violet-900/40 border border-violet-700/50 rounded text-[10px] text-violet-300 leading-none">
          {t}
          <button
            onClick={e => { e.stopPropagation(); onRemove(track, artist, tags, t) }}
            className="text-violet-500 hover:text-red-400 transition-colors ml-0.5 leading-none">✕</button>
        </span>
      ))}
      <div className="relative" ref={ref}>
        <button
          onClick={e => { e.stopPropagation(); setPickerOpen(v => !v) }}
          className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-colors leading-none">
          + tag
        </button>
        {pickerOpen && (
          <div className="absolute left-0 top-6 z-30 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl p-2 w-40">
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search moods…"
              onClick={e => e.stopPropagation()}
              className="w-full mb-1.5 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-[10px] text-zinc-200 outline-none focus:border-violet-500"
            />
            <div className="max-h-40 overflow-y-auto">
              {filtered.length === 0
                ? <div className="text-[10px] text-zinc-600 py-1 text-center">No options</div>
                : filtered.map(m => (
                  <button key={m}
                    onClick={e => { e.stopPropagation(); onAdd(track, artist, tags, m); setPickerOpen(false); setQuery('') }}
                    className="w-full text-left px-2 py-1 text-[10px] text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded transition-colors">
                    {m}
                  </button>
                ))
              }
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function TagTracksTable({ tag, tagType, fromDate, toDate, onClose }) {
  const navigate = useNavigate()
  const [limit, setLimit] = useState(50)
  const [rowOverrides, setRowOverrides] = useState({})
  const [availableMoods, setAvailableMoods] = useState([])

  const rowKey = (r) => `${r.track}|||${r.artist}`

  const fetcher = tagType === 'genre'
    ? () => analytics.genreTagTracks(tag, { limit, from_date: fromDate, to_date: toDate })
    : () => analytics.moodTagTracks(tag, { limit, from_date: fromDate, to_date: toDate })

  const { data, loading } = useChartData(fetcher, [tag, tagType, limit, fromDate, toDate])

  useEffect(() => { setRowOverrides({}) }, [tag, tagType, limit])

  useEffect(() => {
    if (tagType !== 'mood') return
    analytics.availableMoods().then(setAvailableMoods).catch(() => {})
  }, [tagType])

  const rows = (data ?? []).map(r => ({ ...r, ...(rowOverrides[rowKey(r)] ?? {}) }))

  const handleSendToDiscover = () => {
    if (tagType === 'genre') navigate(`/discover?view=artists&genre=${encodeURIComponent(tag)}`)
    else navigate(`/discover?view=tracks&mood=${encodeURIComponent(tag)}`)
  }

  const handleGenreSave = (artist, genre) => {
    setRowOverrides(prev => {
      const next = { ...prev }
      ;(data ?? []).forEach(r => {
        if (r.artist === artist) next[rowKey(r)] = { ...(next[rowKey(r)] ?? {}), genre }
      })
      return next
    })
  }

  const handleMoodRemove = async (track, artist, currentTags, removeTag) => {
    const newTags = currentTags.filter(t => t !== removeTag)
    try {
      await analytics.setTrackMood({ track, artist, tags: newTags })
      const key = `${track}|||${artist}`
      setRowOverrides(prev => ({ ...prev, [key]: { ...(prev[key] ?? {}), mood_tags: newTags } }))
    } catch (e) { console.error('Mood remove failed', e) }
  }

  const handleMoodAdd = async (track, artist, currentTags, addTag) => {
    if (currentTags.includes(addTag)) return
    const newTags = [...currentTags, addTag]
    try {
      await analytics.setTrackMood({ track, artist, tags: newTags })
      const key = `${track}|||${artist}`
      setRowOverrides(prev => ({ ...prev, [key]: { ...(prev[key] ?? {}), mood_tags: newTags } }))
    } catch (e) { console.error('Mood add failed', e) }
  }

  return (
    <div className="mt-3 border-t border-zinc-800 pt-3">
      {/* Header */}
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
        <div className="flex items-center gap-2">
          <button
            onClick={handleSendToDiscover}
            className="px-2.5 py-1 text-[10px] font-medium bg-violet-700 hover:bg-violet-600 text-white rounded-lg transition-colors">
            Open in Discover →
          </button>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-400 text-xs leading-none">✕</button>
        </div>
      </div>

      {/* Track list */}
      {loading
        ? <div className="text-zinc-600 text-xs py-3 text-center animate-pulse">Loading…</div>
        : rows.length === 0
          ? <div className="text-zinc-700 text-xs py-3 text-center">No tracks found for this tag</div>
          : (
            <div className="max-h-72 overflow-y-auto space-y-0.5 pr-1">
              {rows.map((r, i) => (
                <div key={rowKey(r)}
                  className="flex items-start gap-2 px-2 py-2 rounded-lg hover:bg-zinc-800/60 group transition-colors">
                  <span className="text-[10px] text-zinc-600 w-5 shrink-0 tabular-nums pt-0.5">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-zinc-200 truncate">{r.track}</p>
                    <p className="text-[10px] text-zinc-500 truncate">{r.artist}</p>
                    {tagType === 'genre'
                      ? <GenreEditCell value={r.genre} artist={r.artist} onSave={handleGenreSave} />
                      : <MoodTagChips
                          tags={r.mood_tags ?? []}
                          track={r.track}
                          artist={r.artist}
                          availableMoods={availableMoods}
                          onRemove={handleMoodRemove}
                          onAdd={handleMoodAdd}
                        />
                    }
                  </div>
                  <span className="text-[10px] text-zinc-500 tabular-nums shrink-0 pt-0.5">
                    {r.plays?.toLocaleString()}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); navigate(`/explore/track/${encodeURIComponent(r.track)}`) }}
                    className="text-[10px] text-zinc-700 hover:text-violet-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity pt-0.5"
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
