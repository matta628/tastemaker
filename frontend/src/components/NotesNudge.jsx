import { useState, useMemo } from 'react'

function pickRandom(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n)
}

const PART_LABEL = { chords: 'Chords', tabs: 'Tabs', solo: 'Solo' }

export function NotesNudge({ songs, onEdit }) {
  const [dismissed, setDismissed] = useState(false)
  const [seed, setSeed] = useState(0)

  const lacking = useMemo(() => {
    const empty = songs.filter((s) => !s.notes || s.notes.trim() === '')
    return pickRandom(empty, 5)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songs, seed])

  if (dismissed || lacking.length === 0) return null

  const total = songs.filter((s) => !s.notes || s.notes.trim() === '').length

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden mb-4">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div>
          <span className="text-sm font-medium text-zinc-200">📝 Add notes to these songs</span>
          <span className="text-xs text-zinc-500 ml-2">{total} missing · the agent reads these</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setSeed((s) => s + 1)}
            className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1 rounded-lg hover:bg-zinc-800 transition-colors"
            title="Show different songs"
          >
            ↻ shuffle
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="text-xs text-zinc-600 hover:text-zinc-400 px-2 py-1 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
      <ul className="divide-y divide-zinc-800">
        {lacking.map((song) => (
          <li key={song.song_id} className="flex items-center gap-3 px-4 py-2.5">
            <div className="flex-1 min-w-0">
              <span className="text-sm text-zinc-200 truncate">{song.title}</span>
              <span className="text-xs text-zinc-500 ml-2">{song.artist}</span>
              {song.part && (
                <span className="text-xs text-zinc-600 ml-2">· {PART_LABEL[song.part] ?? song.part}</span>
              )}
            </div>
            <button
              onClick={() => onEdit(song)}
              className="text-xs text-violet-400 hover:text-violet-300 px-3 py-1 rounded-lg border border-violet-800 hover:border-violet-600 transition-colors shrink-0"
            >
              Add notes
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
