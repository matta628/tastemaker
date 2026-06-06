import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { HighchartsReact } from 'highcharts-react-official'
import Highcharts from 'highcharts'
import 'highcharts/highcharts-more'
import { AnalyticsShell } from './AnalyticsShell'
import { analytics } from '../../api'
import { useUIStore } from '../../store/uiStore'
import { useActionBus } from '../../hooks/useActionBus'
import { merge } from './charts/chartTheme'

const ENTITY_TYPES = [
  { key: 'artist', label: 'Artists' },
  { key: 'album',  label: 'Albums'  },
  { key: 'track',  label: 'Tracks'  },
]

const PAGE_SIZE = 50

const ALL_COLS = {
  artist: {
    Identity: [
      { key: 'artist',         label: 'Artist',       flex: true,  sortable: true, category: 'Identity' },
      { key: 'genre',          label: 'Genre',        w: 'w-28',   sortable: false, editable: true, category: 'Identity' },
    ],
    Volume: [
      { key: 'total_plays',    label: 'All-time',     w: 'w-24',   sortable: true, align: 'right', category: 'Volume' },
      { key: 'unique_tracks',  label: 'Tracks',       w: 'w-16',   sortable: true, align: 'right', category: 'Volume' },
    ],
    Recency: [
      { key: 'days_since_last_heard', label: 'Last heard', w: 'w-24', sortable: true, align: 'right', fmt: v => v != null ? `${Math.round(v)}d ago` : '—', category: 'Recency' },
    ],
    Trend: [
      { key: 'plays_7d',        label: '7d',      w: 'w-16', sortable: true, align: 'right', category: 'Trend' },
      { key: 'plays_30d',       label: '30d',     w: 'w-16', sortable: true, align: 'right', category: 'Trend' },
      { key: 'plays_30d_delta', label: '30d Δ',   w: 'w-16', sortable: true, align: 'right', delta: true, category: 'Trend' },
      { key: 'plays_90d',       label: '90d',     w: 'w-16', sortable: true, align: 'right', category: 'Trend' },
      { key: 'plays_90d_delta', label: '90d Δ',   w: 'w-16', sortable: true, align: 'right', delta: true, category: 'Trend' },
      { key: 'plays_180d',      label: '6mo',     w: 'w-16', sortable: true, align: 'right', category: 'Trend' },
      { key: 'plays_180d_delta', label: '6mo Δ',  w: 'w-16', sortable: true, align: 'right', delta: true, category: 'Trend' },
      { key: 'plays_1y',        label: '1y',      w: 'w-16', sortable: true, align: 'right', category: 'Trend' },
      { key: 'plays_1y_delta',  label: '1y Δ',    w: 'w-16', sortable: true, align: 'right', delta: true, category: 'Trend' },
    ],
    Streak: [
      { key: 'longest_streak_days', label: 'Streak',  w: 'w-20',   sortable: true, align: 'right', fmt: v => v ? `${v}d` : '—', category: 'Streak' },
    ],
    Rank: [
      { key: 'rank_all_time',  label: 'Rank',     w: 'w-16', sortable: true, align: 'right', category: 'Rank' },
      { key: 'rank_90d_delta', label: '90d rank Δ', w: 'w-20', sortable: true, align: 'right', delta: true, category: 'Rank' },
    ],
  },
  album: {
    Identity: [
      { key: 'album',          label: 'Album',        flex: true,  sortable: true, category: 'Identity' },
      { key: 'artist',         label: 'Artist',       w: 'w-40',   sortable: true, category: 'Identity' },
      { key: 'genre',          label: 'Genre',        w: 'w-28',   sortable: false, editable: true, category: 'Identity' },
    ],
    Volume: [
      { key: 'total_plays',    label: 'All-time',     w: 'w-24',   sortable: true, align: 'right', category: 'Volume' },
      { key: 'unique_tracks',  label: 'Tracks',       w: 'w-16',   sortable: true, align: 'right', category: 'Volume' },
    ],
    Recency: [
      { key: 'days_since_last_heard', label: 'Last heard', w: 'w-24', sortable: true, align: 'right', fmt: v => v != null ? `${Math.round(v)}d ago` : '—', category: 'Recency' },
    ],
    Trend: [
      { key: 'plays_7d',         label: '7d',     w: 'w-16', sortable: true, align: 'right', category: 'Trend' },
      { key: 'plays_30d',        label: '30d',    w: 'w-16', sortable: true, align: 'right', category: 'Trend' },
      { key: 'plays_30d_delta',  label: '30d Δ',  w: 'w-16', sortable: true, align: 'right', delta: true, category: 'Trend' },
      { key: 'plays_90d',        label: '90d',    w: 'w-16', sortable: true, align: 'right', category: 'Trend' },
      { key: 'plays_90d_delta',  label: '90d Δ',  w: 'w-16', sortable: true, align: 'right', delta: true, category: 'Trend' },
      { key: 'plays_180d',       label: '6mo',    w: 'w-16', sortable: true, align: 'right', category: 'Trend' },
      { key: 'plays_180d_delta', label: '6mo Δ',  w: 'w-16', sortable: true, align: 'right', delta: true, category: 'Trend' },
      { key: 'plays_1y',         label: '1y',     w: 'w-16', sortable: true, align: 'right', category: 'Trend' },
      { key: 'plays_1y_delta',   label: '1y Δ',   w: 'w-16', sortable: true, align: 'right', delta: true, category: 'Trend' },
    ],
    Rank: [
      { key: 'rank_all_time',  label: 'Rank',     w: 'w-16', sortable: true, align: 'right', category: 'Rank' },
    ],
  },
  track: {
    Identity: [
      { key: 'track',          label: 'Track',        flex: true,  sortable: true, category: 'Identity' },
      { key: 'artist',         label: 'Artist',       w: 'w-40',   sortable: true, category: 'Identity' },
      { key: 'genre',          label: 'Genre',        w: 'w-28',   sortable: false, editable: true, category: 'Identity' },
    ],
    Volume: [
      { key: 'total_plays',    label: 'All-time',     w: 'w-24',   sortable: true, align: 'right', category: 'Volume' },
    ],
    Recency: [
      { key: 'days_since_last_heard', label: 'Last heard', w: 'w-24', sortable: true, align: 'right', fmt: v => v != null ? `${Math.round(v)}d ago` : '—', category: 'Recency' },
    ],
    Trend: [
      { key: 'plays_7d',         label: '7d',     w: 'w-16', sortable: true, align: 'right', category: 'Trend' },
      { key: 'plays_30d',        label: '30d',    w: 'w-16', sortable: true, align: 'right', category: 'Trend' },
      { key: 'plays_30d_delta',  label: '30d Δ',  w: 'w-16', sortable: true, align: 'right', delta: true, category: 'Trend' },
      { key: 'plays_90d',        label: '90d',    w: 'w-16', sortable: true, align: 'right', category: 'Trend' },
      { key: 'plays_90d_delta',  label: '90d Δ',  w: 'w-16', sortable: true, align: 'right', delta: true, category: 'Trend' },
      { key: 'plays_180d',       label: '6mo',    w: 'w-16', sortable: true, align: 'right', category: 'Trend' },
      { key: 'plays_180d_delta', label: '6mo Δ',  w: 'w-16', sortable: true, align: 'right', delta: true, category: 'Trend' },
      { key: 'plays_1y',         label: '1y',     w: 'w-16', sortable: true, align: 'right', category: 'Trend' },
      { key: 'plays_1y_delta',   label: '1y Δ',   w: 'w-16', sortable: true, align: 'right', delta: true, category: 'Trend' },
    ],
    Rank: [
      { key: 'rank_all_time',  label: 'Rank',     w: 'w-16', sortable: true, align: 'right', category: 'Rank' },
    ],
    Streak: [
      { key: 'longest_streak_days', label: 'Streak',  w: 'w-20',   sortable: true, align: 'right', fmt: v => v ? `${v}d` : '—', category: 'Streak' },
    ],
  },
}

const DEFAULT_COLS = {
  artist: ['artist', 'genre', 'total_plays', 'plays_7d', 'plays_30d', 'plays_30d_delta', 'rank_all_time', 'unique_tracks', 'days_since_last_heard', 'longest_streak_days'],
  album:  ['album', 'artist', 'total_plays', 'plays_7d', 'plays_30d', 'rank_all_time', 'unique_tracks', 'days_since_last_heard'],
  track:  ['track', 'artist', 'total_plays', 'plays_7d', 'plays_30d', 'rank_all_time', 'days_since_last_heard', 'longest_streak_days'],
}

const AXIS_LABEL = {
  total_plays: 'Total plays',
  days_since_last_heard: 'Days since last heard',
  plays_30d: '30d plays',
  plays_7d: '7d plays',
  plays_1y: '1y plays',
  unique_tracks: 'Unique tracks',
  rank_all_time: 'All-time rank',
  longest_streak_days: 'Longest streak (days)',
}

const FILTER_FIELDS = {
  artist: ['artist', 'total_plays', 'plays_7d', 'plays_30d', 'rank_all_time', 'unique_tracks', 'days_since_last_heard', 'longest_streak_days'],
  album:  ['album', 'artist', 'total_plays', 'plays_7d', 'plays_30d', 'rank_all_time', 'unique_tracks', 'days_since_last_heard'],
  track:  ['track', 'artist', 'total_plays', 'plays_7d', 'plays_30d', 'rank_all_time', 'days_since_last_heard', 'longest_streak_days'],
}

const FILTER_OPERATORS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'in_last_days']

// ─── Shared ──────────────────────────────────────────────────────────────────

function GenreCell({ value, artist, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')

  const commit = async () => {
    setEditing(false)
    if (draft === (value ?? '')) return
    try {
      await analytics.setGenreOverride({ artist, genre: draft })
      onSave(draft)
    } catch (e) {
      console.error('Genre save failed', e)
    }
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false) }
        }}
        onClick={e => e.stopPropagation()}
        className="bg-zinc-700 border border-violet-500 rounded px-1.5 py-0.5 text-xs text-zinc-100 w-full outline-none"
      />
    )
  }

  return (
    <span
      onClick={e => { e.stopPropagation(); setDraft(value ?? ''); setEditing(true) }}
      className="cursor-text group inline-flex items-center gap-1 hover:text-zinc-100"
      title="Click to edit genre"
    >
      {value || <span className="text-zinc-600">—</span>}
      <span className="text-zinc-600 opacity-0 group-hover:opacity-100 text-[10px]">✎</span>
    </span>
  )
}

function DeltaCell({ value }) {
  if (value == null) return <span className="text-zinc-600">—</span>
  if (value > 0)  return <span className="text-emerald-400">+{value}</span>
  if (value < 0)  return <span className="text-red-400">{value}</span>
  return <span className="text-zinc-600">0</span>
}

function Modal({ title, onClose, wide = false, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className={`bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl flex flex-col ${
          wide ? 'w-full max-w-2xl' : 'w-full max-w-md'
        } mx-4 max-h-[80vh]`}
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
          <h2 className="text-sm font-semibold text-zinc-200">{title}</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 transition-colors text-lg leading-none">✕</button>
        </div>
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>
    </div>
  )
}

// ─── Column picker dropdown ───────────────────────────────────────────────────

function ColumnPicker({ entity, selectedColumns, onSelect, forceClose, onOpen }) {
  const [isOpen, setIsOpen] = useState(false)
  const categories = ALL_COLS[entity]

  useEffect(() => { if (forceClose && isOpen) setIsOpen(false) }, [forceClose])

  const toggle = () => {
    if (!isOpen) onOpen?.()
    setIsOpen(v => !v)
  }

  const toggleColumn = (key) => {
    onSelect(selectedColumns.includes(key)
      ? selectedColumns.filter(k => k !== key)
      : [...selectedColumns, key])
  }

  const toggleCategory = (cat) => {
    const keys = categories[cat].map(c => c.key)
    const allIn = keys.every(k => selectedColumns.includes(k))
    onSelect(allIn ? selectedColumns.filter(k => !keys.includes(k)) : [...new Set([...selectedColumns, ...keys])])
  }

  return (
    <div className="relative">
      <button onClick={toggle}
        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors">
        ⚙️ Columns
      </button>
      {isOpen && (
        <div className="absolute left-0 top-8 z-20 bg-zinc-900 border border-zinc-700 rounded-lg p-3 min-w-max shadow-lg">
          {Object.entries(categories).map(([cat, cols]) => (
            <div key={cat} className="mb-3 pb-2 border-b border-zinc-700 last:border-0 last:mb-0 last:pb-0">
              <label className="flex items-center gap-2 mb-1 text-xs font-medium text-zinc-400 cursor-pointer hover:text-zinc-200">
                <input type="checkbox"
                  checked={cols.every(c => selectedColumns.includes(c.key))}
                  onChange={() => toggleCategory(cat)}
                  className="w-3 h-3 rounded accent-violet-600" />
                {cat}
              </label>
              <div className="ml-4 space-y-1">
                {cols.map(col => (
                  <label key={col.key} className="flex items-center gap-2 text-xs text-zinc-500 cursor-pointer hover:text-zinc-300">
                    <input type="checkbox"
                      checked={selectedColumns.includes(col.key)}
                      onChange={() => toggleColumn(col.key)}
                      className="w-3 h-3 rounded accent-violet-600" />
                    {col.label}
                  </label>
                ))}
              </div>
            </div>
          ))}
          <button onClick={() => { onSelect(DEFAULT_COLS[entity]); setIsOpen(false) }}
            className="w-full text-left px-2 py-1 text-xs text-zinc-500 hover:text-zinc-300 rounded hover:bg-zinc-800 transition-colors mt-1">
            Reset to default
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Filter builder dropdown ──────────────────────────────────────────────────

function FilterBuilder({ entity, filters, forceClose, onOpen }) {
  const [isOpen, setIsOpen] = useState(false)
  const store = useUIStore()

  useEffect(() => { if (forceClose && isOpen) setIsOpen(false) }, [forceClose])

  const toggle = () => {
    if (!isOpen) onOpen?.()
    setIsOpen(v => !v)
  }

  return (
    <div className="relative">
      <button onClick={toggle}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          filters.length > 0 ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
        }`}>
        🔍 Filters {filters.length > 0 && `(${filters.length})`}
      </button>
      {isOpen && (
        <div className="absolute left-0 top-8 z-20 bg-zinc-900 border border-zinc-700 rounded-lg p-3 min-w-max shadow-lg max-w-2xl">
          <div className="space-y-2 max-h-64 overflow-y-auto mb-3">
            {filters.length === 0
              ? <div className="text-xs text-zinc-600 py-2">No filters. Add one to get started.</div>
              : filters.map(filter => (
                <div key={filter.id} className="flex items-end gap-2">
                  <select value={filter.field}
                    onChange={e => store.updateDiscoverFilter(filter.id, { field: e.target.value })}
                    className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-violet-500">
                    {FILTER_FIELDS[entity].map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <select value={filter.operator}
                    onChange={e => store.updateDiscoverFilter(filter.id, { operator: e.target.value })}
                    className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-violet-500">
                    {FILTER_OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
                  </select>
                  <input type="text" value={filter.value}
                    onChange={e => store.updateDiscoverFilter(filter.id, { value: e.target.value })}
                    placeholder="value"
                    className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500 w-24" />
                  <button onClick={() => store.removeDiscoverFilter(filter.id)}
                    className="px-2 py-1 text-xs text-zinc-500 hover:text-red-400 transition-colors">✕</button>
                </div>
              ))
            }
          </div>
          <div className="flex gap-2 border-t border-zinc-700 pt-2">
            <button onClick={() => store.addDiscoverFilter()}
              className="flex-1 text-left px-2 py-1 text-xs text-zinc-500 hover:text-zinc-300 rounded hover:bg-zinc-800 transition-colors">
              + Add filter
            </button>
            <button onClick={() => { store.setDiscoverFilters([]); setIsOpen(false) }}
              className="px-2 py-1 text-xs text-zinc-500 hover:text-zinc-300 rounded hover:bg-zinc-800 transition-colors">
              Clear all
            </button>
            <button onClick={() => setIsOpen(false)}
              className="px-3 py-1 text-xs font-medium bg-violet-600 text-white rounded hover:bg-violet-700 transition-colors">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Reports modal ────────────────────────────────────────────────────────────

function ReportsModal({ entity, selectedCols, filters, sortBy, sortDir, reports, onSave, onLoad, onDelete, onClose }) {
  const [newName, setNewName] = useState('')
  const entityReports = reports.filter(r => r.entity === entity)

  const handleSave = () => {
    if (!newName.trim()) return
    onSave({
      name: newName.trim(),
      entity,
      columns: selectedCols,
      filters: filters.map(f => ({ field: f.field, operator: f.operator, value: f.value })),
      sort_by: sortBy,
      sort_dir: sortDir,
    })
    setNewName('')
  }

  return (
    <Modal title="Reports" onClose={onClose}>
      <div className="p-5 space-y-5">
        {/* Saved reports */}
        {entityReports.length === 0 ? (
          <p className="text-sm text-zinc-500">No saved reports for {entity}s yet.</p>
        ) : (
          <div className="space-y-2">
            {entityReports.map(r => (
              <div key={r.id} className="flex items-center gap-3 p-3 bg-zinc-800 rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-zinc-200 truncate">{r.name}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    {r.columns?.length ?? 0} cols · {r.filters?.length ?? 0} filters · sort {r.sort_by} {r.sort_dir}
                  </div>
                </div>
                <button onClick={() => { onLoad(r.id); onClose() }}
                  className="px-3 py-1 text-xs font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-500 transition-colors shrink-0">
                  Load
                </button>
                <button onClick={() => onDelete(r.id)}
                  className="text-zinc-500 hover:text-red-400 transition-colors shrink-0 text-sm leading-none px-1">
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Save current view */}
        <div className="border-t border-zinc-800 pt-4">
          <p className="text-xs text-zinc-500 mb-2">Save current view as a report</p>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="Report name…"
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500"
              autoFocus
            />
            <button onClick={handleSave} disabled={!newName.trim()}
              className="px-4 py-2 text-sm font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-500 transition-colors disabled:opacity-40">
              Save
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ─── Groups & Sets modal ──────────────────────────────────────────────────────

const SET_TABS = [
  { key: 'artist', label: 'Artist Groups', noun: 'artists' },
  { key: 'track',  label: 'Track Sets',    noun: 'tracks'  },
]

function SetsModal({ initialTab = 'artist', sets, activeSetId, onCreateSet, onAddToSet, onRemoveFromSet, onApplyFilter, onClearFilter, onDeleteSet, onClose }) {
  const [activeTab, setActiveTab] = useState(initialTab)
  const [editingId, setEditingId] = useState(null)
  const [newSetName, setNewSetName] = useState('')
  const [memberQuery, setMemberQuery] = useState('')
  const [memberResults, setMemberResults] = useState([])
  const [memberSearching, setMemberSearching] = useState(false)
  const searchTimerRef = useRef(null)

  const tabSets = sets.filter(s => (s.entity_type ?? 'artist') === activeTab)
  const editingSet = editingId ? sets.find(s => s.id === editingId) : null
  const tabInfo = SET_TABS.find(t => t.key === activeTab)

  const memberDisplayName = (entityId) => {
    if (activeTab === 'track') {
      const [track, artist] = entityId.split('|||')
      return artist ? `${track} — ${artist}` : entityId
    }
    return entityId
  }

  const entityIdOf = (row) =>
    activeTab === 'artist' ? row.artist : `${row.track}|||${row.artist}`

  const handleCreate = () => {
    if (!newSetName.trim()) return
    onCreateSet({ name: newSetName.trim(), entity_type: activeTab })
    setNewSetName('')
  }

  const onMemberQueryChange = (val) => {
    setMemberQuery(val)
    clearTimeout(searchTimerRef.current)
    if (!val.trim()) { setMemberResults([]); return }
    setMemberSearching(true)
    searchTimerRef.current = setTimeout(async () => {
      try {
        const fetcher = activeTab === 'artist' ? analytics.entitiesArtists : analytics.entitiesTracks
        const res = await fetcher({ search: val, limit: 8, sort_by: 'total_plays', sort_dir: 'desc', offset: 0 })
        setMemberResults(res.rows ?? [])
      } finally { setMemberSearching(false) }
    }, 300)
  }

  const resetEdit = () => { setEditingId(null); setMemberQuery(''); setMemberResults([]) }

  // ── Edit view ───────────────────────────────────────────────────────────────
  if (editingSet) {
    return (
      <Modal title={editingSet.name} onClose={onClose} wide>
        <div className="p-5">
          <button onClick={resetEdit}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors mb-4 flex items-center gap-1">
            ← Back
          </button>

          <div className="grid grid-cols-2 gap-5">
            {/* Members */}
            <div>
              <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
                Members ({editingSet.members.length})
              </h3>
              {editingSet.members.length === 0 ? (
                <p className="text-xs text-zinc-600 py-2">No members yet — search to add →</p>
              ) : (
                <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                  {editingSet.members.map(m => (
                    <div key={m} className="flex items-center justify-between py-1.5 px-2 bg-zinc-800 rounded text-xs group">
                      <span className="text-zinc-300 truncate">{memberDisplayName(m)}</span>
                      <button onClick={() => onRemoveFromSet({ set_id: editingSet.id, member: m })}
                        className="text-zinc-600 hover:text-red-400 transition-colors ml-2 shrink-0 opacity-0 group-hover:opacity-100">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Search to add */}
            <div>
              <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
                Add {tabInfo.noun}
              </h3>
              <input
                value={memberQuery}
                onChange={e => onMemberQueryChange(e.target.value)}
                placeholder={`Search ${tabInfo.noun}…`}
                className="w-full mb-2 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500"
                autoFocus
              />
              {memberSearching && <div className="text-xs text-zinc-600 py-1 animate-pulse">Searching…</div>}
              <div className="space-y-0.5 max-h-64 overflow-y-auto">
                {memberResults.map((row, i) => {
                  const eid = entityIdOf(row)
                  const alreadyIn = editingSet.members.includes(eid)
                  return (
                    <button key={i}
                      onClick={() => !alreadyIn && onAddToSet({ set_id: editingSet.id, member: eid })}
                      disabled={alreadyIn}
                      className={`w-full text-left flex items-center justify-between py-1.5 px-2 rounded text-xs transition-colors ${
                        alreadyIn ? 'text-zinc-600 cursor-default' : 'text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 cursor-pointer'
                      }`}>
                      <div className="flex flex-col min-w-0">
                        <span className="truncate">{activeTab === 'artist' ? row.artist : row.track}</span>
                        {activeTab === 'track' && <span className="text-zinc-600 text-[10px] truncate">{row.artist}</span>}
                      </div>
                      <span className={`shrink-0 ml-2 text-sm ${alreadyIn ? 'text-emerald-600' : 'text-zinc-500'}`}>
                        {alreadyIn ? '✓' : '+'}
                      </span>
                    </button>
                  )
                })}
                {!memberSearching && memberQuery && memberResults.length === 0 && (
                  <div className="text-xs text-zinc-600 py-2 text-center">No results</div>
                )}
                {!memberQuery && (
                  <div className="text-xs text-zinc-600 py-2 text-center">Type to search</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Modal>
    )
  }

  // ── List view ───────────────────────────────────────────────────────────────
  return (
    <Modal title="Groups & Sets" onClose={onClose} wide>
      <div className="p-5">
        {/* Tabs */}
        <div className="flex gap-1 mb-4 pb-3 border-b border-zinc-800">
          {SET_TABS.map(t => {
            const count = sets.filter(s => (s.entity_type ?? 'artist') === t.key).length
            return (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === t.key ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`}>
                {t.label}
                {count > 0 && (
                  <span className={`ml-1.5 text-[10px] ${activeTab === t.key ? 'text-violet-300' : 'text-zinc-600'}`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Set list */}
        {tabSets.length === 0 ? (
          <p className="text-sm text-zinc-500 py-2 mb-4">
            No {tabInfo.label.toLowerCase()} yet.
          </p>
        ) : (
          <div className="space-y-2 mb-4">
            {tabSets.map(s => (
              <div key={s.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                activeSetId === s.id ? 'bg-emerald-900/30 border-emerald-700/60' : 'bg-zinc-800 border-transparent'
              }`}>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-zinc-200">{s.name}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">{s.members.length} {tabInfo.noun}</div>
                </div>
                <button onClick={() => setEditingId(s.id)}
                  className="px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 rounded hover:bg-zinc-700 transition-colors shrink-0">
                  Edit
                </button>
                {activeSetId === s.id ? (
                  <button onClick={() => { onClearFilter(); onClose() }}
                    className="px-3 py-1 text-xs font-medium bg-emerald-700 text-white rounded-lg hover:bg-emerald-600 transition-colors shrink-0">
                    Active ✓
                  </button>
                ) : (
                  <button onClick={() => { onApplyFilter(s); onClose() }}
                    className="px-3 py-1 text-xs font-medium bg-zinc-700 text-zinc-200 rounded-lg hover:bg-zinc-600 transition-colors shrink-0">
                    Filter
                  </button>
                )}
                <button onClick={() => onDeleteSet(s.id)}
                  className="text-zinc-500 hover:text-red-400 transition-colors shrink-0 text-sm leading-none px-1">✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Create new */}
        <div className="border-t border-zinc-800 pt-4">
          <p className="text-xs text-zinc-500 mb-2">New {tabInfo.label.toLowerCase().replace('s', '').trimEnd()}…</p>
          <div className="flex gap-2">
            <input
              value={newSetName}
              onChange={e => setNewSetName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder={`${tabInfo.label} name…`}
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500"
              autoFocus
            />
            <button onClick={handleCreate} disabled={!newSetName.trim()}
              className="px-4 py-2 text-sm font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-500 transition-colors disabled:opacity-40">
              Create
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ─── Table / card / split views ───────────────────────────────────────────────

function CardView({ rows, entity, onRowClick, hasMore, onScrollEnd, pageLoading }) {
  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    if (scrollHeight - scrollTop - clientHeight < 300 && hasMore && !pageLoading) onScrollEnd()
  }

  return (
    <div
      className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-6 overflow-auto flex-1"
      onScroll={handleScroll}
    >
      {rows.map((row, i) => {
        const name = entity === 'artist' ? row.artist : entity === 'album' ? row.album : row.track
        return (
          <div key={i} onClick={() => onRowClick(row)}
            className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 cursor-pointer hover:bg-zinc-800 hover:border-violet-600 transition-all">
            <div className="truncate font-medium text-sm text-zinc-200 mb-2">{name}</div>
            {entity !== 'artist' && <div className="text-xs text-zinc-500 mb-2">{row.artist}</div>}
            {row.genre && <div className="text-xs text-zinc-500 mb-2">{row.genre}</div>}
            <div className="flex justify-between text-xs text-zinc-400">
              <span>{row.total_plays} plays</span>
              <span>#{row.rank_all_time}</span>
            </div>
          </div>
        )
      })}
      {pageLoading && rows.length > 0 && (
        <div className="col-span-full text-center text-xs text-zinc-600 py-2 animate-pulse">Loading…</div>
      )}
    </div>
  )
}

function SplitView({ rows, entity, cols, onRowClick }) {
  const [selected, setSelected] = useState(rows.length > 0 ? rows[0] : null)
  const selectedName = selected ? (entity === 'artist' ? selected.artist : entity === 'album' ? selected.album : selected.track) : null

  return (
    <div className="flex-1 flex gap-4 p-6 overflow-hidden">
      <div className="flex-1 border border-zinc-700 rounded-lg overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-10 bg-zinc-900">
            <tr className="border-b border-zinc-800">
              {cols.slice(0, 3).map(col => (
                <th key={col.key} className="px-4 py-2.5 text-left font-medium text-zinc-400 select-none whitespace-nowrap">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} onClick={() => setSelected(row)}
                className={`border-b border-zinc-800/50 cursor-pointer transition-colors ${
                  selected === row ? 'bg-zinc-700/60' : 'hover:bg-zinc-800/40'
                }`}>
                {cols.slice(0, 3).map(col => (
                  <td key={col.key} className="px-4 py-2 text-zinc-300 whitespace-nowrap">
                    {col.fmt ? col.fmt(row[col.key]) : (row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected && (
        <div className="flex-1 border border-zinc-700 rounded-lg bg-zinc-900/50 p-4 overflow-auto">
          <div className="text-sm font-medium text-zinc-200 mb-4">{selectedName}</div>
          <div className="space-y-2 text-xs">
            {cols.map(col => (
              <div key={col.key} className="flex justify-between">
                <span className="text-zinc-500">{col.label}:</span>
                <span className="text-zinc-200">{col.fmt ? col.fmt(selected[col.key]) : (selected[col.key] ?? '—')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Viz ──────────────────────────────────────────────────────────────────────

function nameOf(entity, row) {
  return entity === 'artist' ? row.artist : entity === 'album' ? row.album : row.track
}

function SummaryViz({ rows, entity, vizType, axes }) {
  if (!vizType || !rows.length) return null

  const { x, y, size } = axes
  const xLabel = AXIS_LABEL[x] ?? x
  const yLabel = AXIS_LABEL[y] ?? y

  let options

  if (vizType === 'scatter' || vizType === 'bubble') {
    const data = rows.slice(0, 200).map(row => ({
      name: nameOf(entity, row),
      x: row[x] ?? 0,
      y: row[y] ?? 0,
      z: vizType === 'bubble' && size ? (row[size] ?? 1) : undefined,
    }))
    options = merge({
      chart: { type: vizType === 'bubble' ? 'bubble' : 'scatter', height: 260, zoomType: 'xy' },
      xAxis: { title: { text: xLabel } },
      yAxis: { title: { text: yLabel } },
      tooltip: { formatter() { return `<b>${this.point.name}</b><br/>${xLabel}: ${this.x}<br/>${yLabel}: ${this.y}` } },
      plotOptions: { scatter: { marker: { radius: 4 } }, bubble: { minSize: 4, maxSize: 24 } },
      series: [{ name: entity, data, color: '#8b5cf6' }],
      legend: { enabled: false },
    })
  } else if (vizType === 'bar') {
    const top = rows.slice(0, 20)
    options = merge({
      chart: { type: 'bar', height: 260 },
      xAxis: { categories: top.map(r => nameOf(entity, r)), labels: { style: { fontSize: '10px' } } },
      yAxis: { title: { text: xLabel } },
      series: [{ name: xLabel, data: top.map(r => r[x] ?? 0), color: '#8b5cf6' }],
      legend: { enabled: false },
    })
  } else if (vizType === 'pie') {
    const top = rows.slice(0, 12)
    options = merge({
      chart: { type: 'pie', height: 260 },
      plotOptions: { pie: { dataLabels: { enabled: true, format: '{point.name}: {point.percentage:.0f}%', style: { fontSize: '10px' } } } },
      series: [{ name: xLabel, data: top.map(r => ({ name: nameOf(entity, r), y: r[x] ?? 0 })) }],
    })
  } else {
    return null
  }

  return (
    <div className="shrink-0 border-b border-zinc-800 px-6 py-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-zinc-500 uppercase tracking-wide">
          {vizType} — {xLabel}{y !== x ? ` vs ${yLabel}` : ''}
        </span>
      </div>
      <HighchartsReact highcharts={Highcharts} options={options} />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function Discover() {
  const navigate = useNavigate()
  const store = useUIStore()
  const actionBus = useActionBus()

  // Single open-panel tracker — enforces mutual exclusion across all panels
  const [openPanel, setOpenPanel] = useState(null)
  const openOne = (name) => setOpenPanel(name)
  const closeAll = () => setOpenPanel(null)

  const [searchParams, setSearchParams] = useSearchParams()
  const urlGenre = searchParams.get('genre')
  const urlMood  = searchParams.get('mood')

  const entity  = store.discoverEntity
  const search  = store.discoverSearch
  const sortBy  = store.discoverSortBy
  const sortDir = store.discoverSortDir
  const vizType = store.discoverVizType
  const axes    = store.discoverVizAxes
  const selectedCols = store.discoverColumns ?? DEFAULT_COLS[entity]
  const filters = store.discoverFilters
  const view    = store.discoverView
  const reports = store.discoverReports
  const sets    = store.discoverSets
  const activeSetId = store.discoverActiveSetId

  const setEntity = (e) => {
    store.setDiscoverEntity(e)
    store.setDiscoverColumns(DEFAULT_COLS[e])
    store.setDiscoverSort('rank_all_time', 'asc')
  }

  // Apply ?view= / ?genre= / ?mood= from URL on mount
  useEffect(() => {
    const viewParam = searchParams.get('view')
    const map = { artists: 'artist', albums: 'album', tracks: 'track' }
    if (viewParam && map[viewParam]) setEntity(map[viewParam])
    else if (urlMood) setEntity('track')
  }, []) // eslint-disable-line
  const setSort    = store.setDiscoverSort
  const setVizType = store.setDiscoverVizType

  // ── Pagination state ────────────────────────────────────────────────────────
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [pageLoading, setPageLoading] = useState(false)
  const loadingRef = useRef(false)
  const hasMore = rows.length < total

  const buildFetchParams = useCallback((offset) => {
    const p = { sort_by: sortBy, sort_dir: sortDir, limit: PAGE_SIZE, offset }
    if (search) p.search = search
    if (activeSetId) p.set_id = activeSetId
    if (urlGenre) p.genre_filter = urlGenre
    if (urlMood && entity === 'track') p.mood_filter = urlMood
    filters.forEach((f, i) => {
      if (f.field && f.operator && f.value !== '') {
        p[`filter_field_${i}`] = f.field
        p[`filter_operator_${i}`] = f.operator
        p[`filter_value_${i}`] = f.value
      }
    })
    return p
  }, [sortBy, sortDir, search, activeSetId, urlGenre, urlMood, entity, filters])

  const fetchEntities = useCallback((offset, append) => {
    if (loadingRef.current && append) return
    loadingRef.current = true
    setPageLoading(true)
    const fetcher = entity === 'artist' ? analytics.entitiesArtists
      : entity === 'album' ? analytics.entitiesAlbums
      : analytics.entitiesTracks
    fetcher(buildFetchParams(offset))
      .then(res => {
        setRows(prev => append ? [...prev, ...res.rows] : res.rows)
        setTotal(res.total)
      })
      .catch(console.error)
      .finally(() => { loadingRef.current = false; setPageLoading(false) })
  }, [entity, buildFetchParams])

  useEffect(() => {
    loadingRef.current = false
    setRows([])
    setTotal(0)
    fetchEntities(0, false)
  }, [entity, sortBy, sortDir, search, JSON.stringify(filters), activeSetId, urlGenre, urlMood]) // eslint-disable-line

  const loadMore = useCallback(() => {
    if (loadingRef.current || rows.length >= total) return
    fetchEntities(rows.length, true)
  }, [rows.length, total, fetchEntities])

  const handleTableScroll = useCallback((e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    if (scrollHeight - scrollTop - clientHeight < 300 && hasMore && !loadingRef.current) loadMore()
  }, [hasMore, loadMore])

  const handleGenreEdit = useCallback((artist, genre) => {
    setRows(prev => prev.map(r => r.artist === artist ? { ...r, genre } : r))
  }, [])

  const setView = (v) => {
    store.setDiscoverView(v)
    actionBus?.execute([{ type: 'set_view', payload: { view: v } }])
  }
  const setColumns = (cols) => {
    store.setDiscoverColumns(cols)
    actionBus?.execute([{ type: 'set_columns', payload: { column_ids: cols } }])
  }

  const handleSaveReport   = (r)  => actionBus?.execute([{ type: 'save_report',   payload: r }])
  const handleLoadReport   = (id) => actionBus?.execute([{ type: 'load_report',   payload: { report_id: id } }])
  const handleDeleteReport = (id) => actionBus?.execute([{ type: 'delete_report', payload: { report_id: id } }])
  const handleCreateSet    = (p)  => actionBus?.execute([{ type: 'create_set',    payload: p }])
  const handleAddToSet     = (p)  => actionBus?.execute([{ type: 'add_to_set',    payload: p }])
  const handleRemoveFromSet= (p)  => actionBus?.execute([{ type: 'remove_from_set', payload: p }])
  const handleApplyFilter  = (p)  => {
    if (p.entity_type && p.entity_type !== entity) setEntity(p.entity_type)
    actionBus?.execute([{ type: 'apply_set_filter', payload: { set_id: p.id } }])
  }
  const handleClearFilter  = ()   => actionBus?.execute([{ type: 'clear_set_filter', payload: {} }])
  const handleDeleteSet    = (id) => store.removeDiscoverSet(id)

  const allCols = Object.values(ALL_COLS[entity]).flat()
  const cols   = allCols.filter(c => selectedCols.includes(c.key))

  // ── Column resize ────────────────────────────────────────────────────────────
  const [resizing, setResizing] = useState(null) // { storeKey, startX, startWidth }
  const didDrag = useRef(false)

  const handleResizeMouseDown = useCallback((e, col) => {
    e.preventDefault()
    e.stopPropagation()
    didDrag.current = false
    const th = e.currentTarget.closest('th')
    setResizing({ storeKey: `${entity}_${col.key}`, startX: e.clientX, startWidth: th.offsetWidth })
  }, [entity])

  useEffect(() => {
    if (!resizing) return
    const onMove = (e) => {
      didDrag.current = true
      const newWidth = Math.max(40, resizing.startWidth + (e.clientX - resizing.startX))
      store.setDiscoverColumnWidth(resizing.storeKey, newWidth)
    }
    const onUp = () => setResizing(null)
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [resizing, store])

  const colStyle = useCallback((col) => {
    const saved = store.discoverColumnWidths[`${entity}_${col.key}`]
    return saved ? { width: saved, minWidth: saved, maxWidth: saved } : {}
  }, [entity, store.discoverColumnWidths])

  const handleSort = useCallback((key) => {
    if (didDrag.current) return
    if (sortBy === key) setSort(key, sortDir === 'asc' ? 'desc' : 'asc')
    else setSort(key, 'desc')
  }, [sortBy, sortDir, setSort])

  const handleRowClick = useCallback((row) => {
    navigate(`/explore/${entity}/${encodeURIComponent(nameOf(entity, row))}`)
  }, [entity, navigate])

  const activeSet = activeSetId ? sets.find(s => s.id === activeSetId) : null

  return (
    <AnalyticsShell>
      <div className="h-full flex flex-col">

        {/* Controls */}
        <div className="shrink-0 flex items-center gap-3 px-6 py-3 border-b border-zinc-800 flex-wrap">
          {/* Entity type */}
          <div className="flex gap-1">
            {ENTITY_TYPES.map(t => (
              <button key={t.key} onClick={() => setEntity(t.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  entity === t.key ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Dropdowns — mutually exclusive via openPanel */}
          <ColumnPicker
            entity={entity} selectedColumns={selectedCols} onSelect={setColumns}
            forceClose={openPanel !== 'columns'}
            onOpen={() => openOne('columns')}
          />
          <FilterBuilder
            entity={entity} filters={filters}
            forceClose={openPanel !== 'filters'}
            onOpen={() => openOne('filters')}
          />

          {/* Reports button → modal */}
          <button
            onClick={() => setOpenPanel(p => p === 'reports' ? null : 'reports')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              reports.filter(r => r.entity === entity).length > 0
                ? 'bg-violet-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
            }`}>
            📋 Reports {reports.filter(r => r.entity === entity).length > 0 && `(${reports.filter(r => r.entity === entity).length})`}
          </button>

          {/* Sets button → modal */}
          <button
            onClick={() => setOpenPanel(p => p === 'sets' ? null : 'sets')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeSetId ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
            }`}>
            🎯 Groups & Sets {activeSet && `(${activeSet.name})`}
          </button>

          {/* Active genre filter chip */}
          {urlGenre && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-violet-900/50 border border-violet-700/60 text-violet-300 rounded-lg text-xs font-medium">
              Genre: {urlGenre}
              <button
                onClick={() => { const p = new URLSearchParams(searchParams); p.delete('genre'); setSearchParams(p) }}
                className="text-violet-400 hover:text-white transition-colors leading-none">✕</button>
            </span>
          )}
          {/* Active mood filter chip */}
          {urlMood && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-900/50 border border-indigo-700/60 text-indigo-300 rounded-lg text-xs font-medium">
              Mood: {urlMood}
              <button
                onClick={() => { const p = new URLSearchParams(searchParams); p.delete('mood'); setSearchParams(p) }}
                className="text-indigo-400 hover:text-white transition-colors leading-none">✕</button>
            </span>
          )}

          {/* Search */}
          <input
            value={search}
            onChange={e => store.setDiscoverSearch(e.target.value)}
            placeholder={`Search ${entity}s…`}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500 w-48"
          />

          {/* Viz */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-zinc-600 pr-0.5">Viz:</span>
            {[
              { key: 'bar', label: 'Bar' },
              { key: 'scatter', label: 'Scatter' },
              { key: 'bubble', label: 'Bubble' },
              { key: 'pie', label: 'Pie' },
            ].map(v => (
              <button key={v.key} onClick={() => setVizType(vizType === v.key ? null : v.key)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  vizType === v.key ? 'bg-violet-600 text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                }`}>
                {v.label}
              </button>
            ))}
          </div>

          {/* View */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-zinc-600 pr-0.5">View:</span>
            {[
              { key: 'table', label: '📊 Table' },
              { key: 'cards', label: '🃏 Cards' },
              { key: 'split', label: '⬌ Split'  },
            ].map(v => (
              <button key={v.key} onClick={() => setView(v.key)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  view === v.key ? 'bg-violet-600 text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                }`}>
                {v.label}
              </button>
            ))}
          </div>

          <span className="text-xs text-zinc-600 ml-auto">
            {rows.length} / {total.toLocaleString()} {entity}s
          </span>
          {pageLoading && rows.length === 0 && <span className="text-xs text-zinc-600 animate-pulse">Loading…</span>}
        </div>

        {/* Viz panel */}
        <div className={`transition-all duration-500 ${
          store.highlightedChart === 'discover_viz' && vizType
            ? 'ring-2 ring-violet-400/70 ring-offset-1 ring-offset-zinc-950 shadow-[0_0_24px_rgba(139,92,246,0.3)] rounded-xl mx-4'
            : ''
        }`}>
          <SummaryViz rows={rows} entity={entity} vizType={vizType} axes={axes} />
        </div>

        {/* Table / Cards / Split */}
        {view === 'table' && (
          <div
            className={`flex-1 overflow-auto transition-all duration-500 ${
              store.highlightedChart === 'discover_table' ? 'ring-2 ring-inset ring-violet-400/40' : ''
            }`}
            onScroll={handleTableScroll}
          >
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-zinc-900">
                <tr className="border-b border-zinc-800">
                  {cols.map(col => (
                    <th key={col.key}
                      onClick={col.sortable ? () => handleSort(col.key) : undefined}
                      style={{ ...colStyle(col), position: 'relative' }}
                      className={`px-4 py-2.5 text-left font-medium select-none whitespace-nowrap overflow-hidden border-r border-zinc-800 last:border-r-0
                        ${col.align === 'right' ? 'text-right' : ''}
                        ${!colStyle(col).width ? (col.flex ? 'w-full' : col.w) : ''}
                        ${col.sortable ? 'cursor-pointer text-zinc-400 hover:text-zinc-200' : 'text-zinc-500'}
                        ${sortBy === col.key ? 'text-violet-400' : ''}`}>
                      {col.label}
                      {sortBy === col.key && (
                        <span className="ml-1 text-violet-400">{sortDir === 'asc' ? '↑' : '↓'}</span>
                      )}
                      {/* Resize handle — double-click resets to default */}
                      <div
                        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-violet-500/50 active:bg-violet-500/80 select-none z-10"
                        onMouseDown={(e) => handleResizeMouseDown(e, col)}
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => { e.stopPropagation(); store.setDiscoverColumnWidth(`${entity}_${col.key}`, null) }}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} onClick={() => handleRowClick(row)}
                    className="border-b border-zinc-800/50 hover:bg-zinc-800/40 cursor-pointer transition-colors">
                    {cols.map(col => (
                      <td key={col.key}
                        style={colStyle(col)}
                        className={`px-4 py-2 text-zinc-300 whitespace-nowrap overflow-hidden text-ellipsis border-r border-zinc-800 last:border-r-0
                          ${col.align === 'right' ? 'text-right tabular-nums' : ''}
                          ${!colStyle(col).width ? (col.flex ? '' : col.w) : ''}`}>
                        {col.editable
                          ? <GenreCell value={row[col.key]} artist={row.artist} onSave={g => handleGenreEdit(row.artist, g)} />
                          : col.delta
                            ? <DeltaCell value={row[col.key]} />
                            : col.fmt
                              ? col.fmt(row[col.key])
                              : (row[col.key] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
                {rows.length === 0 && !pageLoading && (
                  <tr>
                    <td colSpan={cols.length} className="px-4 py-8 text-center text-zinc-600">No results</td>
                  </tr>
                )}
                {pageLoading && rows.length > 0 && (
                  <tr>
                    <td colSpan={cols.length} className="px-4 py-3 text-center text-xs text-zinc-600 animate-pulse">Loading…</td>
                  </tr>
                )}
                {!hasMore && rows.length > 0 && !pageLoading && (
                  <tr>
                    <td colSpan={cols.length} className="px-4 py-3 text-center text-xs text-zinc-700">
                      All {total.toLocaleString()} {entity}s loaded
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {view === 'cards' && (
          <CardView rows={rows} entity={entity} cols={cols} onRowClick={handleRowClick}
            hasMore={hasMore} onScrollEnd={loadMore} pageLoading={pageLoading} />
        )}
        {view === 'split' && (
          <SplitView rows={rows} entity={entity} cols={cols} onRowClick={handleRowClick} />
        )}

        {/* Modals */}
        {openPanel === 'reports' && (
          <ReportsModal
            entity={entity} selectedCols={selectedCols} filters={filters}
            sortBy={sortBy} sortDir={sortDir} reports={reports}
            onSave={handleSaveReport} onLoad={handleLoadReport} onDelete={handleDeleteReport}
            onClose={closeAll}
          />
        )}
        {openPanel === 'sets' && (
          <SetsModal
            entity={entity} sets={sets} activeSetId={activeSetId} rows={rows}
            onCreateSet={handleCreateSet} onAddToSet={handleAddToSet}
            onRemoveFromSet={handleRemoveFromSet} onApplyFilter={handleApplyFilter}
            onClearFilter={handleClearFilter} onDeleteSet={handleDeleteSet}
            onClose={closeAll}
          />
        )}

      </div>
    </AnalyticsShell>
  )
}
