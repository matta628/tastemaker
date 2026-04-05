import { useState, useMemo } from 'react'
import { Dots } from './Dots'
import { STATUS_OPTIONS } from './StatusPill'
import { Autocomplete } from './Autocomplete'

const PARTS = [
  { value: null,     label: 'General' },
  { value: 'chords', label: 'Chords'  },
  { value: 'tabs',   label: 'Tabs'    },
  { value: 'solo',   label: 'Solo'    },
]

const EMPTY = {
  title: '',
  artist: '',
  part: null,
  difficulty: 3,
  status: 'want_to_learn',
  notes: '',
}

export function SongForm({ initial, onSave, onCancel, songs = [] }) {
  const [form, setForm] = useState(initial ?? EMPTY)
  const [saving, setSaving] = useState(false)

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }))

  // Deduplicated suggestion lists
  const titleSuggestions = useMemo(
    () => [...new Set(songs.map((s) => s.title))],
    [songs]
  )
  const artistSuggestions = useMemo(
    () => [...new Set(songs.map((s) => s.artist))],
    [songs]
  )

  // When a title is picked, also fill artist if we know it
  const handleTitleSelect = (title) => {
    const match = songs.find((s) => s.title === title)
    setForm((f) => ({ ...f, title, artist: match ? match.artist : f.artist }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim() || !form.artist.trim()) return
    setSaving(true)
    try {
      await onSave(form)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <label className="text-sm text-zinc-400">Song title</label>
        <Autocomplete
          value={form.title}
          onChange={(v) => set('title', v)}
          onSelect={handleTitleSelect}
          suggestions={titleSuggestions}
          placeholder="e.g. Blackbird"
          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm text-zinc-400">Artist</label>
        <Autocomplete
          value={form.artist}
          onChange={(v) => set('artist', v)}
          onSelect={(v) => set('artist', v)}
          suggestions={artistSuggestions}
          placeholder="e.g. The Beatles"
          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm text-zinc-400">Part</label>
        <div className="flex gap-2">
          {PARTS.map(({ value, label }) => (
            <button
              key={label}
              type="button"
              onClick={() => set('part', value)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                form.part === value
                  ? 'bg-violet-600 border-violet-500 text-white'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-zinc-600">
          Add separate entries for each part — each gets its own notes, difficulty, and status.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm text-zinc-400">
          Difficulty — <Dots value={form.difficulty} />
        </label>
        <input
          type="range"
          min={1}
          max={5}
          value={form.difficulty}
          onChange={(e) => set('difficulty', Number(e.target.value))}
          className="accent-violet-500 w-full"
        />
        <div className="flex justify-between text-xs text-zinc-600">
          <span>Beginner</span><span>Intermediate</span><span>Hard</span>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm text-zinc-400">Status</label>
        <select
          value={form.status}
          onChange={(e) => set('status', e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm text-zinc-400">
          Notes <span className="text-zinc-600">(the agent reads this)</span>
        </label>
        <textarea
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          rows={4}
          placeholder={
            form.part === 'chords'  ? 'e.g. Know the full chord progression. F barre still a little rough.' :
            form.part === 'tabs'    ? 'e.g. Working through the intro riff. Bar 12 is tricky.' :
            form.part === 'solo'    ? 'e.g. Attempted the solo. Struggling with the bends in bar 8.' :
            'e.g. Learning for fingerpicking independence, inspired by Tommy Emmanuel.'
          }
          className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
        />
      </div>

      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-medium rounded-xl py-3 transition-colors"
        >
          {saving ? 'Saving…' : initial ? 'Save changes' : 'Add entry'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl py-3 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
