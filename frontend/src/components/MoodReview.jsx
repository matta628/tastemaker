import { useState, useEffect, useCallback } from 'react'

const BASE = '/api'

const MOOD_LABELS = [
  "melancholic", "euphoric", "anxious", "tender", "defiant",
  "nostalgic", "dark", "hopeful", "lonely", "romantic",
  "bitter", "raw", "peaceful", "restless",
]

const MOOD_COLORS = {
  melancholic: 'bg-blue-900/60 text-blue-300',
  euphoric:    'bg-yellow-900/60 text-yellow-300',
  anxious:     'bg-orange-900/60 text-orange-300',
  tender:      'bg-pink-900/60 text-pink-300',
  defiant:     'bg-red-900/60 text-red-300',
  nostalgic:   'bg-purple-900/60 text-purple-300',
  dark:        'bg-zinc-800 text-zinc-400',
  hopeful:     'bg-emerald-900/60 text-emerald-300',
  lonely:      'bg-indigo-900/60 text-indigo-300',
  romantic:    'bg-rose-900/60 text-rose-300',
  bitter:      'bg-amber-900/60 text-amber-300',
  raw:         'bg-stone-800 text-stone-300',
  peaceful:    'bg-teal-900/60 text-teal-300',
  restless:    'bg-violet-900/60 text-violet-300',
}

function ProgressBar({ pct }) {
  return (
    <div className="w-full bg-zinc-800 rounded-full h-1.5 mt-1.5">
      <div
        className="bg-violet-500 h-1.5 rounded-full transition-all duration-500"
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  )
}

function MoodPill({ label }) {
  const cls = MOOD_COLORS[label] ?? 'bg-zinc-800 text-zinc-400'
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>
      {label}
    </span>
  )
}

export function MoodReview() {
  const [tracks,     setTracks]     = useState([])
  const [loading,    setLoading]    = useState(true)
  const [unreviewed, setUnreviewed] = useState(false)
  const [tagFilter,  setTagFilter]  = useState('')
  const [editing,    setEditing]    = useState(null)   // row being edited
  const [editTags,   setEditTags]   = useState([])
  const [saving,     setSaving]     = useState(false)
  const [moodStatus, setMoodStatus] = useState(null)

  const fetchTracks = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (unreviewed) params.set('unreviewed', 'true')
      if (tagFilter)  params.set('tag', tagFilter)
      params.set('limit', '300')
      const r = await fetch(`${BASE}/mood?${params}`)
      const data = await r.json()
      setTracks(data)
    } catch {
      setTracks([])
    } finally {
      setLoading(false)
    }
  }, [unreviewed, tagFilter])

  useEffect(() => { fetchTracks() }, [fetchTracks])

  useEffect(() => {
    fetch(`${BASE}/pipelines/status`)
      .then(r => r.json())
      .then(d => setMoodStatus(d?.mood ?? null))
      .catch(() => {})
  }, [])

  const openEdit = (row) => {
    setEditing(row)
    setEditTags([...(row.tags || [])])
  }

  const toggleTag = (label) => {
    setEditTags(prev =>
      prev.includes(label) ? prev.filter(t => t !== label) : [...prev, label]
    )
  }

  const saveEdit = async () => {
    if (!editing) return
    setSaving(true)
    try {
      const params = new URLSearchParams({
        track:  editing.track,
        artist: editing.artist,
      })
      await fetch(`${BASE}/mood/update?${params}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tags: editTags }),
      })
      // Update row in-place, re-sort overridden to bottom
      setTracks(prev => {
        const updated = prev.map(r =>
          r.track === editing.track && r.artist === editing.artist
            ? { ...r, tags: editTags, overridden: true }
            : r
        )
        return [...updated].sort((a, b) => {
          if (a.overridden !== b.overridden) return a.overridden ? 1 : -1
          return a.confidence - b.confidence
        })
      })
      setEditing(null)
    } catch {
      // leave modal open on error
    } finally {
      setSaving(false)
    }
  }

  const unreviewedCount = tracks.filter(t => !t.overridden).length

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 flex flex-col gap-6">

      {/* Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-zinc-100 font-semibold text-lg">Mood Tags</h2>
        <p className="text-sm text-zinc-500">
          Zero-shot NLP mood labels computed from lyrics. Review and correct tags that seem off.
        </p>
        {moodStatus && (
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>{moodStatus.analyzed.toLocaleString()} / {moodStatus.total.toLocaleString()} tracks analyzed</span>
              <span className="text-zinc-600">{moodStatus.pct}%</span>
            </div>
            <ProgressBar pct={moodStatus.pct} />
          </div>
        )}
      </div>

      {/* Empty state — no mood data at all */}
      {!loading && tracks.length === 0 && moodStatus?.analyzed === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-6 text-center">
          <p className="text-zinc-400 text-sm font-medium mb-2">No mood data yet</p>
          <p className="text-zinc-600 text-sm">
            Run the analyzer on your laptop:
          </p>
          <pre className="mt-3 bg-zinc-950 rounded-lg px-4 py-3 text-xs text-zinc-300 text-left overflow-x-auto">
            {`# 1. Copy DB from Pi
scp pi@100.116.200.117:/path/to/tastemaker/tastemaker.db ./tastemaker.db

# 2. Run analysis
pip install transformers torch   # first time only
python -m backend.pipelines.analyze_mood

# 3. Export results
python -c "import duckdb; c=duckdb.connect('tastemaker.db'); c.execute(\\"COPY track_mood TO 'mood_export.parquet' (FORMAT PARQUET)\\"); c.close()"

# 4. Copy back to Pi
scp ./mood_export.parquet pi@100.116.200.117:~/`}
          </pre>
        </div>
      )}

      {/* Filters */}
      {(tracks.length > 0 || loading) && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={unreviewed}
              onChange={e => setUnreviewed(e.target.checked)}
              className="accent-violet-500"
            />
            Unreviewed only
            {unreviewedCount > 0 && (
              <span className="bg-zinc-800 text-zinc-400 text-xs px-1.5 py-0.5 rounded-full">
                {unreviewedCount}
              </span>
            )}
          </label>

          <select
            value={tagFilter}
            onChange={e => setTagFilter(e.target.value)}
            className="text-sm bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-lg px-3 py-1.5 focus:outline-none focus:border-violet-500"
          >
            <option value="">All moods</option>
            {MOOD_LABELS.map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>

          <span className="text-xs text-zinc-600 ml-auto">{tracks.length} tracks</span>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="bg-zinc-900 rounded-xl p-4 text-zinc-600 text-sm animate-pulse">Loading…</div>
      ) : tracks.length > 0 ? (
        <div className="bg-zinc-900 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wide">
                <th className="text-left px-4 py-3 font-medium">Track</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Artist</th>
                <th className="text-left px-4 py-3 font-medium">Tags</th>
                <th className="text-right px-4 py-3 font-medium hidden md:table-cell">Conf.</th>
                <th className="text-right px-4 py-3 font-medium hidden md:table-cell">Plays</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {tracks.map((row, idx) => (
                <tr
                  key={`${row.track}|${row.artist}`}
                  className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors ${
                    row.overridden ? 'opacity-50' : ''
                  }`}
                >
                  <td className="px-4 py-3 text-zinc-200 truncate max-w-[140px]" title={row.track}>
                    {row.track}
                  </td>
                  <td className="px-4 py-3 text-zinc-400 truncate max-w-[120px] hidden sm:table-cell" title={row.artist}>
                    {row.artist}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {row.tags.length > 0
                        ? row.tags.map(t => <MoodPill key={t} label={t} />)
                        : <span className="text-zinc-600 text-xs">–</span>
                      }
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-500 text-xs hidden md:table-cell tabular-nums">
                    {row.tags.length > 0 ? `${Math.round(row.confidence * 100)}%` : '–'}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-500 text-xs hidden md:table-cell tabular-nums">
                    {row.play_count.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openEdit(row)}
                      className="text-xs text-zinc-500 hover:text-zinc-200 transition-colors px-2 py-1 rounded-lg hover:bg-zinc-700"
                    >
                      {row.overridden ? '✓ Reviewed' : 'Edit'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !loading && moodStatus?.analyzed > 0 ? (
        <p className="text-zinc-500 text-sm text-center py-8">No tracks match the current filters.</p>
      ) : null}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm flex flex-col gap-4">
            <div>
              <p className="text-zinc-100 font-medium truncate">{editing.track}</p>
              <p className="text-zinc-500 text-sm">{editing.artist}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {MOOD_LABELS.map(label => (
                <label key={label} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={editTags.includes(label)}
                    onChange={() => toggleTag(label)}
                    className="accent-violet-500 shrink-0"
                  />
                  <MoodPill label={label} />
                </label>
              ))}
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setEditing(null)}
                className="flex-1 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex-1 text-sm bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white px-4 py-2 rounded-lg transition-colors"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
