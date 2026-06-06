import { useState } from 'react'
import { useUIStore } from '../../../store/uiStore'

function fmt(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export function EraBookmarks() {
  const store = useUIStore()
  const [newName, setNewName] = useState('')
  const [expanded, setExpanded] = useState(false)

  const bookmarks = store.timeMachineBookmarks || []
  const fromDate = store.timeMachineFrom
  const toDate = store.timeMachineTo

  const handleSaveBookmark = () => {
    if (newName.trim()) {
      store.addTimeMachineBookmark(newName.trim(), fromDate, toDate)
      setNewName('')
    }
  }

  const handleLoadBookmark = (id) => {
    store.loadTimeMachineBookmark(id)
  }

  const handleDeleteBookmark = (id) => {
    store.removeTimeMachineBookmark(id)
  }

  return (
    <div className="mt-4 border border-zinc-700 rounded-lg p-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-xs font-medium text-zinc-400 hover:text-zinc-200"
      >
        <span>📌 Era Bookmarks ({bookmarks.length})</span>
        <span>{expanded ? '▼' : '▶'}</span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {/* Save current era */}
          <div className="flex gap-1">
            <input
              type="text"
              placeholder="Name this era…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveBookmark()}
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-violet-500"
            />
            <button
              onClick={handleSaveBookmark}
              disabled={!newName.trim()}
              className="px-2 py-1 rounded bg-violet-600 text-white text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-violet-500"
            >
              Save
            </button>
          </div>

          {/* Saved bookmarks */}
          {bookmarks.length > 0 && (
            <div className="space-y-1">
              {bookmarks.map((bm) => (
                <div key={bm.id} className="flex items-center gap-2 p-1.5 bg-zinc-800 rounded">
                  <button
                    onClick={() => handleLoadBookmark(bm.id)}
                    className="flex-1 text-left text-xs text-zinc-300 hover:text-violet-400"
                  >
                    <div className="font-medium">{bm.name}</div>
                    <div className="text-zinc-500">{fmt(bm.from)} → {fmt(bm.to)}</div>
                  </button>
                  <button
                    onClick={() => handleDeleteBookmark(bm.id)}
                    className="text-zinc-500 hover:text-red-400 text-xs"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
