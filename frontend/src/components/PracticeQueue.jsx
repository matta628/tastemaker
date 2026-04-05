import { useState, useEffect } from 'react'
import { Dots } from './Dots'
import { api } from '../api'

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr)
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 2)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

function SongCard({ song, onRefresh }) {
  const [log, setLog]       = useState(null)   // most recent entry
  const [logging, setLogging] = useState(false)

  useEffect(() => {
    api.getPracticeLog(song.song_id).then(entries => setLog(entries[0] ?? null))
  }, [song.song_id])

  const handlePractice = async () => {
    setLogging(true)
    const entry = await api.logPractice(song.song_id)
    setLog(entry)
    onRefresh()
    setLogging(false)
  }

  const handleUndo = async () => {
    if (!log) return
    await api.deletePractice(log.log_id)
    const entries = await api.getPracticeLog(song.song_id)
    setLog(entries[0] ?? null)
    onRefresh()
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-zinc-100">{song.title}</p>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-sm text-zinc-400">{song.artist}</span>
            {song.difficulty != null && <Dots value={song.difficulty} size="sm" />}
          </div>
          {song.notes && (
            <p className="text-xs text-zinc-500 mt-2 line-clamp-2">{song.notes}</p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <button
            onClick={handlePractice}
            disabled={logging}
            className="text-sm font-medium px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white transition-colors disabled:opacity-50"
          >
            {logging ? '…' : 'Practiced today'}
          </button>
          {log && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-zinc-500">
                last: {timeAgo(log.practiced_at)}
              </span>
              <button
                onClick={handleUndo}
                className="text-xs text-zinc-600 hover:text-red-400 transition-colors"
                title="Undo last practice log"
              >
                undo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function PracticeQueue({ songs, onRefresh }) {
  const learning = songs.filter(s => s.status === 'learning')

  if (learning.length === 0) {
    return (
      <div className="text-center py-16 text-zinc-500">
        <p className="text-4xl mb-3">🎸</p>
        <p>No songs marked as <strong className="text-zinc-400">Learning</strong>.</p>
        <p className="text-sm mt-1">Add a song and set its status to Learning.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 max-w-xl">
      <p className="text-sm text-zinc-500">
        Logging practice sessions gives the agent recency data — it can tell you
        haven't touched a song in 2 weeks, or that you've been on a fingerpicking streak.
      </p>
      <div className="flex flex-col gap-3">
        {learning.map(song => (
          <SongCard key={song.song_id} song={song} onRefresh={onRefresh} />
        ))}
      </div>
    </div>
  )
}
