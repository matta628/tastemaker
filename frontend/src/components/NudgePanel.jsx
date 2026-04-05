import { useState, useMemo } from 'react'
import { Dots } from './Dots'

const STATUS_OPTIONS = [
  { value: 'want_to_learn', label: 'Want to Learn', color: 'bg-zinc-700 text-zinc-300' },
  { value: 'learning',      label: 'Learning',      color: 'bg-blue-900 text-blue-300' },
  { value: 'learned',       label: 'Learned',       color: 'bg-emerald-900 text-emerald-300' },
  { value: 'abandoned',     label: 'Abandoned',     color: 'bg-red-950 text-red-400' },
]

function missingScore(song) {
  // Lower = more fields missing = higher priority
  let missing = 0
  if (!song.notes?.trim()) missing++
  if (song.difficulty == null) missing++
  if (song.status == null) missing++
  return missing
}

function pickTop(songs, field, n = 5) {
  return songs
    .filter(s => {
      if (field === 'notes')      return !s.notes?.trim()
      if (field === 'difficulty') return s.difficulty == null
      if (field === 'status')     return s.status == null
    })
    .sort((a, b) => missingScore(b) - missingScore(a))
    .slice(0, n)
}

function SongRow({ song, field, onSave, onJump }) {
  const [saving, setSaving] = useState(false)

  const save = async (value) => {
    setSaving(true)
    await onSave(song.song_id, field, value)
    setSaving(false)
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors ${saving ? 'opacity-50' : ''}`}>
      {/* Song name — click to jump */}
      <button
        onClick={() => onJump(song.song_id)}
        className="flex-1 min-w-0 text-left"
        title="Jump to row in table"
      >
        <p className="text-xs font-medium text-zinc-300 truncate hover:text-violet-400 transition-colors">
          {song.title}
        </p>
        <p className="text-xs text-zinc-600 truncate">{song.artist}</p>
      </button>

      {/* Inline control */}
      <div className="shrink-0">
        {field === 'difficulty' && (
          <Dots value={song.difficulty ?? 0} size="sm" onChange={(d) => save(d)} />
        )}
        {field === 'status' && (
          <div className="flex gap-1">
            {STATUS_OPTIONS.map(o => (
              <button
                key={o.value}
                onClick={() => save(o.value)}
                className={`text-xs px-2 py-1 rounded-lg border border-zinc-700 transition-colors hover:border-zinc-500 ${o.color}`}
                title={o.label}
              >
                {o.label.split(' ')[0]}
              </button>
            ))}
          </div>
        )}
        {field === 'notes' && (
          <NoteInline song={song} onSave={(v) => save(v)} />
        )}
      </div>
    </div>
  )
}

function NoteInline({ song, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => { if (draft.trim()) onSave(draft); setEditing(false) }}
        onKeyDown={e => {
          if (e.key === 'Enter') { if (draft.trim()) onSave(draft); setEditing(false) }
          if (e.key === 'Escape') setEditing(false)
        }}
        placeholder="Type notes, Enter to save…"
        className="w-36 bg-zinc-800 border border-violet-500 rounded px-2 py-1 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
      />
    )
  }
  return (
    <button
      onClick={() => { setDraft(''); setEditing(true) }}
      className="text-xs text-zinc-600 hover:text-violet-400 border border-zinc-700 hover:border-violet-600 rounded-lg px-2 py-1 transition-colors"
    >
      + add
    </button>
  )
}

const COLUMNS = [
  { field: 'difficulty', label: 'Difficulty',  emoji: '●' },
  { field: 'status',     label: 'Status',      emoji: '⚡' },
  { field: 'notes',      label: 'Notes',       emoji: '📝' },
]

export function NudgePanel({ songs, onSave, onJump }) {
  const [dismissed, setDismissed] = useState(false)

  const counts = useMemo(() => ({
    difficulty: songs.filter(s => s.difficulty == null).length,
    status:     songs.filter(s => s.status == null).length,
    notes:      songs.filter(s => !s.notes?.trim()).length,
  }), [songs])

  const totalMissing = counts.difficulty + counts.status + counts.notes
  if (dismissed || totalMissing === 0) return null

  const picks = useMemo(() => ({
    difficulty: pickTop(songs, 'difficulty'),
    status:     pickTop(songs, 'status'),
    notes:      pickTop(songs, 'notes'),
  }), [songs])

  const anyVisible = COLUMNS.some(c => picks[c.field].length > 0)
  if (!anyVisible) return null

  return (
    <div className="mb-6 bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <span className="text-sm font-medium text-zinc-200">Fill in missing data</span>
        <button
          onClick={() => setDismissed(true)}
          className="text-xs text-zinc-600 hover:text-zinc-400 px-2 py-1 rounded-lg hover:bg-zinc-800 transition-colors"
        >
          ✕ dismiss
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-zinc-800">
        {COLUMNS.map(({ field, label, emoji }) => {
          const rows = picks[field]
          const total = counts[field]
          if (total === 0) return null
          return (
            <div key={field} className="p-3">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs font-medium text-zinc-400">{emoji} {label}</span>
                <span className="text-xs text-zinc-600">{total} missing</span>
              </div>
              <div className="flex flex-col gap-0.5">
                {rows.map(song => (
                  <SongRow
                    key={song.song_id}
                    song={song}
                    field={field}
                    onSave={onSave}
                    onJump={onJump}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
