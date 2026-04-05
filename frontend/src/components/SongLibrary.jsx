import { useState } from 'react'
import { Dots } from './Dots'
import { StatusPill, STATUS_OPTIONS } from './StatusPill'
import { InlineNotes } from './InlineNotes'
import { InlineDate } from './InlineDate'

const PART_LABEL = { chords: 'Chords', tabs: 'Tabs', solo: 'Solo' }
const PART_COLOR  = {
  chords: 'bg-sky-900 text-sky-300',
  tabs:   'bg-amber-900 text-amber-300',
  solo:   'bg-rose-900 text-rose-300',
}

// Status sort order: learned=0, learning=1, want_to_learn=2, abandoned=3, null=4
const STATUS_RANK = { learned: 0, learning: 1, want_to_learn: 2, abandoned: 3 }
const statusRank  = (s) => s != null ? (STATUS_RANK[s] ?? 2) : 4

// Representative values for group-level sorting
const groupVal = {
  song:       (g) => g.title.toLowerCase(),
  artist:     (g) => g.artist.toLowerCase(),
  part:       (g) => (g.entries[0]?.part ?? 'zzz').toLowerCase(),
  difficulty: (g) => {
    const vals = g.entries.map(e => e.difficulty).filter(v => v != null)
    return vals.length ? Math.max(...vals) : -1   // nulls sort last when asc
  },
  status:     (g) => Math.min(...g.entries.map(e => statusRank(e.status))),
  notes:      (g) => g.entries.every(e => !e.notes?.trim()) ? 1 : 0,
  date:       (g) => g.entries[0]?.date_started ?? '9999-99-99',
}

function SortIcon({ active, dir }) {
  if (!active) return <span className="ml-1 text-zinc-700">↕</span>
  return <span className="ml-1 text-violet-400">{dir === 'asc' ? '↑' : '↓'}</span>
}

export function SongLibrary({ songs, onEdit, onDelete, onUpdateDifficulty, onUpdateNotes, onUpdateDate }) {
  const [filterStatus, setFilterStatus] = useState('')
  const [sortField, setSortField] = useState(null)
  const [sortDir, setSortDir]     = useState('asc')

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  // Group by title + artist
  const groups = {}
  for (const song of songs) {
    if (filterStatus && song.status !== filterStatus) continue
    const key = `${song.title}|||${song.artist}`
    if (!groups[key]) groups[key] = { title: song.title, artist: song.artist, entries: [] }
    groups[key].entries.push(song)
  }

  let grouped = Object.values(groups)

  if (sortField && groupVal[sortField]) {
    grouped.sort((a, b) => {
      const av = groupVal[sortField](a)
      const bv = groupVal[sortField](b)
      let cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv
      return sortDir === 'asc' ? cmp : -cmp
    })
  } else {
    // Default: recently updated
    grouped.sort((a, b) =>
      Math.max(...b.entries.map(e => new Date(e.updated_at))) -
      Math.max(...a.entries.map(e => new Date(e.updated_at)))
    )
  }

  const totalEntries = songs.filter(s => !filterStatus || s.status === filterStatus).length

  const Th = ({ field, children, className = '' }) => (
    <th
      onClick={field ? () => handleSort(field) : undefined}
      className={`pb-2 pr-4 font-medium text-left ${
        field ? 'cursor-pointer select-none hover:text-zinc-300 transition-colors' : ''
      } ${sortField === field ? 'text-zinc-300' : 'text-zinc-500'} ${className}`}
    >
      {children}
      {field && <SortIcon active={sortField === field} dir={sortDir} />}
    </th>
  )

  if (grouped.length === 0) {
    return (
      <>
        <FilterBar filterStatus={filterStatus} setFilterStatus={setFilterStatus} grouped={grouped} totalEntries={totalEntries} />
        <p className="text-zinc-500 text-center py-12">No songs yet — add one!</p>
      </>
    )
  }

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {sortField && (
          <button
            onClick={() => { setSortField(null); setSortDir('asc') }}
            className="text-xs text-zinc-500 hover:text-zinc-300 px-3 py-2 border border-zinc-700 rounded-lg hover:border-zinc-500 transition-colors"
          >
            ✕ clear sort
          </button>
        )}
        <span className="ml-auto text-sm text-zinc-500 self-center">
          {grouped.length} song{grouped.length !== 1 ? 's' : ''} · {totalEntries} entries
        </span>
      </div>

      {/* ── Desktop: sortable table ─────────────────────────────────────────── */}
      <div className="hidden md:block">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-zinc-800 text-xs uppercase tracking-wider">
              <Th field="song">Song</Th>
              <Th field="artist">Artist</Th>
              <Th field="part">Part</Th>
              <Th field="difficulty">Difficulty</Th>
              <Th field="status">Status</Th>
              <Th field="notes">Notes</Th>
              <Th field="date">Date Added</Th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900">
            {grouped.map(group =>
              group.entries.map((entry, i) => (
                <tr key={entry.song_id} id={`song-${entry.song_id}`} className="hover:bg-zinc-900 transition-colors group">
                  <td className="py-2.5 pr-4 font-medium text-zinc-100 max-w-[200px]">
                    {i === 0
                      ? <span className="truncate block">{group.title}</span>
                      : <span className="text-zinc-700 select-none pl-3">╰</span>
                    }
                  </td>
                  <td className="py-2.5 pr-4 text-zinc-400 max-w-[160px]">
                    {i === 0 && <span className="truncate block">{group.artist}</span>}
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PART_COLOR[entry.part] ?? 'bg-zinc-800 text-zinc-400'}`}>
                      {PART_LABEL[entry.part] ?? 'General'}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4">
                    <Dots
                      value={entry.difficulty ?? 0}
                      size="sm"
                      onChange={onUpdateDifficulty ? (d) => onUpdateDifficulty(entry.song_id, d) : undefined}
                    />
                  </td>
                  <td className="py-2.5 pr-4">
                    {entry.status != null
                      ? <StatusPill status={entry.status} />
                      : <span className="text-xs text-zinc-700 italic">—</span>
                    }
                  </td>
                  <td className="py-2.5 pr-4 max-w-[260px]">
                    <InlineNotes
                      value={entry.notes}
                      onSave={(notes) => onUpdateNotes?.(entry.song_id, notes)}
                    />
                  </td>
                  <td className="py-2.5 pr-4">
                    <InlineDate
                      value={entry.date_started}
                      onSave={(d) => onUpdateDate?.(entry.song_id, d)}
                    />
                  </td>
                  <td className="py-2.5 text-right">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 justify-end">
                      <button onClick={() => onEdit(entry)}
                        className="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded hover:bg-zinc-800">
                        Edit
                      </button>
                      <button onClick={() => onDelete(entry.song_id)}
                        className="text-xs text-zinc-600 hover:text-red-400 px-2 py-1 rounded hover:bg-zinc-800">
                        ✕
                      </button>
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Mobile: grouped cards ───────────────────────────────────────────── */}
      <div className="md:hidden flex flex-col gap-3">
        {grouped.map(group => (
          <div key={`${group.title}|||${group.artist}`}
            className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-zinc-800">
              <p className="font-medium text-zinc-100">{group.title}</p>
              <p className="text-sm text-zinc-400">{group.artist}</p>
            </div>
            <div className="divide-y divide-zinc-800">
              {group.entries.map(entry => (
                <div key={entry.song_id} className="px-4 py-3 flex items-center gap-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${PART_COLOR[entry.part] ?? 'bg-zinc-700 text-zinc-400'}`}>
                    {PART_LABEL[entry.part] ?? 'General'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {entry.status != null && <StatusPill status={entry.status} />}
                      <Dots value={entry.difficulty ?? 0} size="sm" />
                    </div>
                    {entry.notes && (
                      <p className="text-xs text-zinc-500 mt-1 line-clamp-1">{entry.notes}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => onEdit(entry)}
                      className="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded-lg hover:bg-zinc-800 transition-colors">
                      Edit
                    </button>
                    <button onClick={() => onDelete(entry.song_id)}
                      className="text-xs text-zinc-600 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-zinc-800 transition-colors">
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
