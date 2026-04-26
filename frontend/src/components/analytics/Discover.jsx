import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HighchartsReact } from 'highcharts-react-official'
import Highcharts from 'highcharts'
import 'highcharts/highcharts-more'
import { AnalyticsShell } from './AnalyticsShell'
import { analytics } from '../../api'
import { useChartData } from './charts/useChartData'
import { useUIStore } from '../../store/uiStore'
import { useActionBus } from '../../hooks/useActionBus'
import { merge } from './charts/chartTheme'

const ENTITY_TYPES = [
  { key: 'artist', label: 'Artists' },
  { key: 'album',  label: 'Albums'  },
  { key: 'track',  label: 'Tracks'  },
]

const ALL_COLS = {
  artist: {
    Identity: [
      { key: 'artist',         label: 'Artist',       flex: true,  sortable: true, category: 'Identity' },
    ],
    Volume: [
      { key: 'total_plays',    label: 'All-time',     w: 'w-24',   sortable: true, align: 'right', category: 'Volume' },
      { key: 'unique_tracks',  label: 'Tracks',       w: 'w-16',   sortable: true, align: 'right', category: 'Volume' },
    ],
    Recency: [
      { key: 'days_since_last_heard', label: 'Last heard', w: 'w-24', sortable: true, align: 'right', fmt: v => v != null ? `${Math.round(v)}d ago` : '—', category: 'Recency' },
    ],
    Trend: [
      { key: 'plays_7d',       label: '7d',           w: 'w-16',   sortable: true, align: 'right', category: 'Trend' },
      { key: 'plays_30d',      label: '30d',          w: 'w-16',   sortable: true, align: 'right', category: 'Trend' },
      { key: 'plays_30d_delta', label: '30d Δ',       w: 'w-16',   sortable: true, align: 'right', delta: true, category: 'Trend' },
    ],
    Streak: [
      { key: 'longest_streak_days', label: 'Streak',  w: 'w-20',   sortable: true, align: 'right', fmt: v => v ? `${v}d` : '—', category: 'Streak' },
    ],
    Rank: [
      { key: 'rank_all_time',  label: 'Rank',         w: 'w-16',   sortable: true, align: 'right', category: 'Rank' },
    ],
  },
  album: {
    Identity: [
      { key: 'album',          label: 'Album',        flex: true,  sortable: true, category: 'Identity' },
      { key: 'artist',         label: 'Artist',       w: 'w-40',   sortable: true, category: 'Identity' },
    ],
    Volume: [
      { key: 'total_plays',    label: 'All-time',     w: 'w-24',   sortable: true, align: 'right', category: 'Volume' },
      { key: 'unique_tracks',  label: 'Tracks',       w: 'w-16',   sortable: true, align: 'right', category: 'Volume' },
    ],
    Recency: [
      { key: 'days_since_last_heard', label: 'Last heard', w: 'w-24', sortable: true, align: 'right', fmt: v => v != null ? `${Math.round(v)}d ago` : '—', category: 'Recency' },
    ],
    Trend: [
      { key: 'plays_7d',       label: '7d',           w: 'w-16',   sortable: true, align: 'right', category: 'Trend' },
      { key: 'plays_30d',      label: '30d',          w: 'w-16',   sortable: true, align: 'right', category: 'Trend' },
    ],
    Rank: [
      { key: 'rank_all_time',  label: 'Rank',         w: 'w-16',   sortable: true, align: 'right', category: 'Rank' },
    ],
  },
  track: {
    Identity: [
      { key: 'track',          label: 'Track',        flex: true,  sortable: true, category: 'Identity' },
      { key: 'artist',         label: 'Artist',       w: 'w-40',   sortable: true, category: 'Identity' },
    ],
    Volume: [
      { key: 'total_plays',    label: 'All-time',     w: 'w-24',   sortable: true, align: 'right', category: 'Volume' },
    ],
    Recency: [
      { key: 'days_since_last_heard', label: 'Last heard', w: 'w-24', sortable: true, align: 'right', fmt: v => v != null ? `${Math.round(v)}d ago` : '—', category: 'Recency' },
    ],
    Trend: [
      { key: 'plays_7d',       label: '7d',           w: 'w-16',   sortable: true, align: 'right', category: 'Trend' },
      { key: 'plays_30d',      label: '30d',          w: 'w-16',   sortable: true, align: 'right', category: 'Trend' },
    ],
    Rank: [
      { key: 'rank_all_time',  label: 'Rank',         w: 'w-16',   sortable: true, align: 'right', category: 'Rank' },
    ],
    Streak: [
      { key: 'longest_streak_days', label: 'Streak',  w: 'w-20',   sortable: true, align: 'right', fmt: v => v ? `${v}d` : '—', category: 'Streak' },
    ],
  },
}

const DEFAULT_COLS = {
  artist: ['artist', 'total_plays', 'plays_7d', 'plays_30d', 'plays_30d_delta', 'rank_all_time', 'unique_tracks', 'days_since_last_heard', 'longest_streak_days'],
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

function DeltaCell({ value }) {
  if (value == null) return <span className="text-zinc-600">—</span>
  if (value > 0) return <span className="text-emerald-400">+{value}</span>
  if (value < 0) return <span className="text-red-400">{value}</span>
  return <span className="text-zinc-600">0</span>
}

function ColumnPicker({ entity, selectedColumns, onSelect }) {
  const [isOpen, setIsOpen] = useState(false)
  const categories = ALL_COLS[entity]

  const toggleColumn = (key) => {
    const newSelected = selectedColumns.includes(key)
      ? selectedColumns.filter(k => k !== key)
      : [...selectedColumns, key]
    onSelect(newSelected)
  }

  const toggleCategory = (cat) => {
    const colsInCat = categories[cat].map(c => c.key)
    const allInCat = colsInCat.every(k => selectedColumns.includes(k))
    const newSelected = allInCat
      ? selectedColumns.filter(k => !colsInCat.includes(k))
      : [...new Set([...selectedColumns, ...colsInCat])]
    onSelect(newSelected)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
      >
        ⚙️ Columns
      </button>
      {isOpen && (
        <div className="absolute right-0 top-8 z-20 bg-zinc-900 border border-zinc-700 rounded-lg p-3 min-w-max shadow-lg">
          {Object.entries(categories).map(([cat, cols]) => (
            <div key={cat} className="mb-3 pb-2 border-b border-zinc-700 last:border-0">
              <label className="flex items-center gap-2 mb-1 text-xs font-medium text-zinc-400 cursor-pointer hover:text-zinc-200">
                <input
                  type="checkbox"
                  checked={cols.every(c => selectedColumns.includes(c.key))}
                  onChange={() => toggleCategory(cat)}
                  className="w-3 h-3 rounded accent-violet-600"
                />
                {cat}
              </label>
              <div className="ml-4 space-y-1">
                {cols.map(col => (
                  <label key={col.key} className="flex items-center gap-2 text-xs text-zinc-500 cursor-pointer hover:text-zinc-300">
                    <input
                      type="checkbox"
                      checked={selectedColumns.includes(col.key)}
                      onChange={() => toggleColumn(col.key)}
                      className="w-3 h-3 rounded accent-violet-600"
                    />
                    {col.label}
                  </label>
                ))}
              </div>
            </div>
          ))}
          <button
            onClick={() => {
              onSelect(DEFAULT_COLS[entity])
              setIsOpen(false)
            }}
            className="w-full text-left px-2 py-1 text-xs text-zinc-500 hover:text-zinc-300 rounded hover:bg-zinc-800 transition-colors"
          >
            Reset to default
          </button>
        </div>
      )}
    </div>
  )
}

const FILTER_FIELDS = {
  artist: ['artist', 'total_plays', 'plays_7d', 'plays_30d', 'rank_all_time', 'unique_tracks', 'days_since_last_heard', 'longest_streak_days'],
  album: ['album', 'artist', 'total_plays', 'plays_7d', 'plays_30d', 'rank_all_time', 'unique_tracks', 'days_since_last_heard'],
  track: ['track', 'artist', 'total_plays', 'plays_7d', 'plays_30d', 'rank_all_time', 'days_since_last_heard', 'longest_streak_days'],
}

const FILTER_OPERATORS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'in_last_days']

function FilterBuilder({ entity, filters, onFiltersChange, onApply }) {
  const [isOpen, setIsOpen] = useState(false)
  const store = useUIStore()

  const addFilter = () => {
    store.addDiscoverFilter()
  }

  const removeFilter = (id) => {
    store.removeDiscoverFilter(id)
  }

  const updateFilter = (id, updates) => {
    store.updateDiscoverFilter(id, updates)
  }

  const applyFilters = () => {
    onApply()
    setIsOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          filters.length > 0
            ? 'bg-violet-600 text-white'
            : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
        }`}
      >
        🔍 Filters {filters.length > 0 && `(${filters.length})`}
      </button>
      {isOpen && (
        <div className="absolute right-0 top-8 z-20 bg-zinc-900 border border-zinc-700 rounded-lg p-3 min-w-max shadow-lg max-w-2xl">
          <div className="space-y-2 max-h-96 overflow-y-auto mb-3">
            {filters.length === 0 ? (
              <div className="text-xs text-zinc-600 py-2">No filters. Add one to get started.</div>
            ) : (
              filters.map((filter, idx) => (
                <div key={filter.id} className="flex items-end gap-2">
                  <select
                    value={filter.field}
                    onChange={(e) => updateFilter(filter.id, { field: e.target.value })}
                    className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-violet-500"
                  >
                    {FILTER_FIELDS[entity].map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                  <select
                    value={filter.operator}
                    onChange={(e) => updateFilter(filter.id, { operator: e.target.value })}
                    className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-violet-500"
                  >
                    {FILTER_OPERATORS.map(op => (
                      <option key={op} value={op}>{op}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={filter.value}
                    onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                    placeholder="value"
                    className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500 w-24"
                  />
                  <button
                    onClick={() => removeFilter(filter.id)}
                    className="px-2 py-1 text-xs text-zinc-500 hover:text-red-400 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2 border-t border-zinc-700 pt-2">
            <button
              onClick={addFilter}
              className="text-left px-2 py-1 text-xs text-zinc-500 hover:text-zinc-300 rounded hover:bg-zinc-800 transition-colors flex-1"
            >
              + Add filter
            </button>
            <button
              onClick={() => {
                store.setDiscoverFilters([])
                setIsOpen(false)
              }}
              className="text-left px-2 py-1 text-xs text-zinc-500 hover:text-zinc-300 rounded hover:bg-zinc-800 transition-colors"
            >
              Clear all
            </button>
            <button
              onClick={applyFilters}
              className="px-3 py-1 text-xs font-medium bg-violet-600 text-white rounded hover:bg-violet-700 transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function SetsPanel({ entity, sets, activeSetId, onCreateSet, onAddToSet, onRemoveFromSet, onApplyFilter, onClearFilter }) {
  const [isOpen, setIsOpen] = useState(false)
  const [newSetName, setNewSetName] = useState('')
  const activeSet = activeSetId ? sets.find(s => s.id === activeSetId) : null

  const handleCreateSet = () => {
    if (newSetName.trim()) {
      onCreateSet({ name: newSetName })
      setNewSetName('')
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          activeSetId ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
        }`}
      >
        🎯 Sets {activeSetId && activeSet && `(${activeSet.name})`}
      </button>
      {isOpen && (
        <div className="absolute right-0 top-8 z-20 bg-zinc-900 border border-zinc-700 rounded-lg p-3 min-w-max shadow-lg max-w-sm">
          <div className="mb-3 space-y-2 max-h-48 overflow-y-auto">
            {sets.length === 0 ? (
              <div className="text-xs text-zinc-600 py-2">No sets yet</div>
            ) : (
              sets.map(s => (
                <div key={s.id} className="flex items-center gap-2 p-2 bg-zinc-800 rounded">
                  <button
                    onClick={() => { onApplyFilter({ set_id: s.id }); setIsOpen(false) }}
                    className={`flex-1 text-left text-xs truncate transition-colors ${
                      activeSetId === s.id
                        ? 'text-emerald-400 font-medium'
                        : 'text-zinc-300 hover:text-zinc-100'
                    }`}
                  >
                    {s.name} ({s.members.length})
                  </button>
                  <button
                    onClick={() => onRemoveFromSet({ set_id: s.id, member: activeSet?.members[0] })}
                    className="text-xs text-zinc-500 hover:text-red-400 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="border-t border-zinc-700 pt-2 space-y-2">
            {activeSetId && (
              <button
                onClick={() => { onClearFilter({}); setIsOpen(false) }}
                className="w-full text-left px-2 py-1 text-xs text-zinc-500 hover:text-zinc-300 rounded hover:bg-zinc-800 transition-colors"
              >
                Clear filter
              </button>
            )}
            <input
              type="text"
              value={newSetName}
              onChange={(e) => setNewSetName(e.target.value)}
              placeholder="Set name"
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500"
            />
            <button
              onClick={handleCreateSet}
              disabled={!newSetName.trim()}
              className="w-full px-2 py-1 text-xs font-medium bg-violet-600 text-white rounded hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create set
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ReportsPanel({ entity, selectedCols, filters, sortBy, sortDir, reports, onSave, onLoad, onDelete }) {
  const [isOpen, setIsOpen] = useState(false)
  const [newReportName, setNewReportName] = useState('')

  const handleSave = () => {
    if (newReportName.trim()) {
      onSave({
        name: newReportName,
        entity,
        columns: selectedCols,
        filters: filters.map(f => ({ field: f.field, operator: f.operator, value: f.value })),
        sort_by: sortBy,
        sort_dir: sortDir,
      })
      setNewReportName('')
      setIsOpen(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          reports.length > 0
            ? 'bg-violet-600 text-white'
            : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
        }`}
      >
        📋 Reports {reports.length > 0 && `(${reports.length})`}
      </button>
      {isOpen && (
        <div className="absolute right-0 top-8 z-20 bg-zinc-900 border border-zinc-700 rounded-lg p-3 min-w-max shadow-lg max-w-sm">
          <div className="mb-3 space-y-2">
            {reports.filter(r => r.entity === entity).length === 0 ? (
              <div className="text-xs text-zinc-600 py-2">No reports for {entity}s</div>
            ) : (
              reports.filter(r => r.entity === entity).map(report => (
                <div key={report.id} className="flex items-center gap-2 p-2 bg-zinc-800 rounded">
                  <button
                    onClick={() => { onLoad(report.id); setIsOpen(false) }}
                    className="flex-1 text-left text-xs text-zinc-300 hover:text-zinc-100 truncate"
                  >
                    {report.name}
                  </button>
                  <button
                    onClick={() => onDelete(report.id)}
                    className="text-xs text-zinc-500 hover:text-red-400 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="border-t border-zinc-700 pt-2 space-y-2">
            <input
              type="text"
              value={newReportName}
              onChange={(e) => setNewReportName(e.target.value)}
              placeholder="Report name"
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500"
            />
            <button
              onClick={handleSave}
              disabled={!newReportName.trim()}
              className="w-full px-2 py-1 text-xs font-medium bg-violet-600 text-white rounded hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save as report
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function CardView({ rows, entity, cols, navigate, onRowClick }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-6 overflow-auto flex-1">
      {rows.map((row, i) => {
        const name = entity === 'artist' ? row.artist : entity === 'album' ? row.album : row.track
        const plays = row.total_plays
        return (
          <div key={i}
            onClick={() => onRowClick(row)}
            className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 cursor-pointer hover:bg-zinc-800 hover:border-violet-600 transition-all"
          >
            <div className="truncate font-medium text-sm text-zinc-200 mb-2">{name}</div>
            {entity !== 'artist' && <div className="text-xs text-zinc-500 mb-2">{row.artist}</div>}
            <div className="flex justify-between text-xs text-zinc-400">
              <span>{plays} plays</span>
              <span>#{row.rank_all_time}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SplitView({ rows, entity, cols, navigate, onRowClick }) {
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
              <tr key={i}
                onClick={() => setSelected(row)}
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

const TOP_N_OPTIONS = [25, 50, 100, 250]

export function Discover() {
  const navigate = useNavigate()
  const store = useUIStore()
  const actionBus = useActionBus()

  const entity  = store.discoverEntity
  const search  = store.discoverSearch
  const sortBy  = store.discoverSortBy
  const sortDir = store.discoverSortDir
  const topN    = store.discoverTopN
  const vizType = store.discoverVizType
  const axes    = store.discoverVizAxes
  const selectedCols = store.discoverColumns ?? DEFAULT_COLS[entity]
  const filters = store.discoverFilters
  const view = store.discoverView
  const reports = store.discoverReports
  const sets = store.discoverSets
  const activeSetId = store.discoverActiveSetId

  const setEntity  = (e) => {
    store.setDiscoverEntity(e)
    store.setDiscoverColumns(DEFAULT_COLS[e])
    store.setDiscoverSort('rank_all_time', 'asc')
  }
  const setSearch  = store.setDiscoverSearch
  const setSort    = store.setDiscoverSort
  const setTopN    = store.setDiscoverTopN
  const setVizType = store.setDiscoverVizType
  const setView = (v) => {
    store.setDiscoverView(v)
    if (actionBus?.execute) actionBus.execute([{ type: 'set_view', payload: { view: v } }])
  }
  const setColumns = (cols) => {
    store.setDiscoverColumns(cols)
    if (actionBus?.execute) actionBus.execute([{ type: 'set_columns', payload: { column_ids: cols } }])
  }

  const handleSaveReport = (report) => {
    if (actionBus?.execute) {
      actionBus.execute([{ type: 'save_report', payload: report }])
    }
  }

  const handleLoadReport = (reportId) => {
    if (actionBus?.execute) {
      actionBus.execute([{ type: 'load_report', payload: { report_id: reportId } }])
    }
  }

  const handleDeleteReport = (reportId) => {
    if (actionBus?.execute) {
      actionBus.execute([{ type: 'delete_report', payload: { report_id: reportId } }])
    }
  }

  const handleCreateSet = (payload) => {
    if (actionBus?.execute) {
      actionBus.execute([{ type: 'create_set', payload }])
    }
  }

  const handleAddToSet = (payload) => {
    if (actionBus?.execute) {
      actionBus.execute([{ type: 'add_to_set', payload }])
    }
  }

  const handleRemoveFromSet = (payload) => {
    if (actionBus?.execute) {
      actionBus.execute([{ type: 'remove_from_set', payload }])
    }
  }

  const handleApplySetFilter = (payload) => {
    if (actionBus?.execute) {
      actionBus.execute([{ type: 'apply_set_filter', payload }])
    }
  }

  const handleClearSetFilter = () => {
    if (actionBus?.execute) {
      actionBus.execute([{ type: 'clear_set_filter', payload: {} }])
    }
  }

  const buildFilterParams = () => {
    const p = {}
    filters.forEach((f, idx) => {
      p[`filter_field_${idx}`] = f.field
      p[`filter_operator_${idx}`] = f.operator
      p[`filter_value_${idx}`] = f.value
    })
    return p
  }

  const { data: raw, loading } = useChartData(
    () => {
      const p = {
        sort_by: sortBy,
        sort_dir: sortDir,
        limit: topN,
        search: search || undefined,
        ...buildFilterParams(),
        set_id: activeSetId || undefined,
      }
      if (entity === 'artist') return analytics.entitiesArtists(p)
      if (entity === 'album')  return analytics.entitiesAlbums(p)
      return analytics.entitiesTracks(p)
    },
    [entity, sortBy, sortDir, search, topN, filters, activeSetId]
  )

  const rows = raw?.rows ?? []
  const total = raw?.total ?? 0
  const allCols = Object.values(ALL_COLS[entity]).flat()
  const cols = allCols.filter(c => selectedCols.includes(c.key))

  const handleSort = useCallback((key) => {
    if (sortBy === key) setSort(key, sortDir === 'asc' ? 'desc' : 'asc')
    else setSort(key, 'desc')
  }, [sortBy, sortDir, setSort])

  const handleRowClick = useCallback((row) => {
    navigate(`/explore/${entity}/${encodeURIComponent(nameOf(entity, row))}`)
  }, [entity, navigate])

  return (
    <AnalyticsShell>
      <div className="h-full flex flex-col">

        {/* Controls */}
        <div className="shrink-0 flex items-center gap-3 px-6 py-3 border-b border-zinc-800 flex-wrap">
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
          <ColumnPicker entity={entity} selectedColumns={selectedCols} onSelect={setColumns} />
          <FilterBuilder entity={entity} filters={filters} onApply={() => {}} />
          <ReportsPanel
            entity={entity}
            selectedCols={selectedCols}
            filters={filters}
            sortBy={sortBy}
            sortDir={sortDir}
            reports={reports}
            onSave={handleSaveReport}
            onLoad={handleLoadReport}
            onDelete={handleDeleteReport}
          />
          <SetsPanel
            entity={entity}
            sets={sets}
            activeSetId={activeSetId}
            onCreateSet={handleCreateSet}
            onAddToSet={handleAddToSet}
            onRemoveFromSet={handleRemoveFromSet}
            onApplyFilter={handleApplySetFilter}
            onClearFilter={handleClearSetFilter}
          />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${entity}s…`}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200
              placeholder:text-zinc-600 focus:outline-none focus:border-violet-500 w-48"
          />
          {/* Top-N selector */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-zinc-600 pr-0.5">Top:</span>
            {TOP_N_OPTIONS.map(n => (
              <button key={n} onClick={() => setTopN(n)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  topN === n ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'
                }`}>
                {n}
              </button>
            ))}
          </div>
          {/* Viz toggle */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-zinc-600 pr-0.5">Viz:</span>
            {[
              { key: 'bar',     label: 'Bar' },
              { key: 'scatter', label: 'Scatter' },
              { key: 'bubble',  label: 'Bubble' },
              { key: 'pie',     label: 'Pie' },
            ].map(v => (
              <button key={v.key} onClick={() => setVizType(vizType === v.key ? null : v.key)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  vizType === v.key ? 'bg-violet-600 text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                }`}>
                {v.label}
              </button>
            ))}
          </div>
          {/* View toggle */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-zinc-600 pr-0.5">View:</span>
            {[
              { key: 'table', label: '📊 Table' },
              { key: 'cards', label: '🃏 Cards' },
              { key: 'split', label: '⬌ Split' },
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
          {loading && <span className="text-xs text-zinc-600 animate-pulse">Loading…</span>}
        </div>

        {/* Summary viz */}
        <SummaryViz rows={rows} entity={entity} vizType={vizType} axes={axes} />

        {/* View content */}
        {view === 'table' && (
          <div className="flex-1 overflow-auto">
            <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-zinc-900">
              <tr className="border-b border-zinc-800">
                {cols.map(col => (
                  <th key={col.key}
                    onClick={col.sortable ? () => handleSort(col.key) : undefined}
                    className={`px-4 py-2.5 text-left font-medium select-none whitespace-nowrap
                      ${col.align === 'right' ? 'text-right' : ''}
                      ${col.flex ? 'w-full' : col.w}
                      ${col.sortable ? 'cursor-pointer text-zinc-400 hover:text-zinc-200' : 'text-zinc-500'}
                      ${sortBy === col.key ? 'text-violet-400' : ''}`}>
                    {col.label}
                    {sortBy === col.key && (
                      <span className="ml-1 text-violet-400">{sortDir === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}
                  onClick={() => handleRowClick(row)}
                  className="border-b border-zinc-800/50 hover:bg-zinc-800/40 cursor-pointer transition-colors">
                  {cols.map(col => (
                    <td key={col.key}
                      className={`px-4 py-2 text-zinc-300 whitespace-nowrap
                        ${col.align === 'right' ? 'text-right tabular-nums' : ''}
                        ${col.flex ? '' : col.w}`}>
                      {col.delta
                        ? <DeltaCell value={row[col.key]} />
                        : col.fmt
                          ? col.fmt(row[col.key])
                          : (row[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={cols.length} className="px-4 py-8 text-center text-zinc-600">No results</td>
                </tr>
              )}
            </tbody>
          </table>
            </div>
        )}
        {view === 'cards' && (
          <CardView rows={rows} entity={entity} cols={cols} navigate={navigate} onRowClick={handleRowClick} />
        )}
        {view === 'split' && (
          <SplitView rows={rows} entity={entity} cols={cols} navigate={navigate} onRowClick={handleRowClick} />
        )}

      </div>
    </AnalyticsShell>
  )
}
