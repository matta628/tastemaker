import { useState, useEffect } from 'react'
import { AnalyticsShell } from './AnalyticsShell'
import { ActivityChart }    from './charts/ActivityChart'
import { GenreChart }       from './charts/GenreChart'
import { TopEntitiesChart } from './charts/TopEntitiesChart'
import { HeatmapChart }     from './charts/HeatmapChart'
import { DayOfWeekChart }   from './charts/DayOfWeekChart'
import { StreakCalendar }   from './charts/StreakCalendar'
import { EraStory }         from './panels/EraStory'
import { EraBookmarks }     from './panels/EraBookmarks'
import { DriftAnalysis }    from './panels/DriftAnalysis'
import { analytics }        from '../../api'
import { useUIStore }       from '../../store/uiStore'

const PRESETS = [
  { key: '2019', label: '2019', from: '2019-01-01', to: '2020-01-01' },
  { key: '2020', label: '2020', from: '2020-01-01', to: '2021-01-01' },
  { key: '2021', label: '2021', from: '2021-01-01', to: '2022-01-01' },
  { key: '2022', label: '2022', from: '2022-01-01', to: '2023-01-01' },
  { key: '2023', label: '2023', from: '2023-01-01', to: '2024-01-01' },
  { key: '2024', label: '2024', from: '2024-01-01', to: '2025-01-01' },
  { key: '2025', label: '2025', from: '2025-01-01', to: '2026-01-01' },
]

const COMPARE_MODES = [
  { key: 'off',    label: 'Off' },
  { key: 'vs_now', label: 'vs Now' },
  { key: 'vs_era', label: 'vs Era' },
]

function EraCharts({ fromDate, toDate, label }) {
  return (
    <div className="space-y-4">
      {label && <p className="text-xs text-zinc-500 uppercase tracking-wide font-medium">{label}</p>}
      <ActivityChart    fromDate={fromDate} toDate={toDate} granularity="month" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <GenreChart     fromDate={fromDate} toDate={toDate} />
        <DayOfWeekChart fromDate={fromDate} toDate={toDate} />
      </div>
      <TopEntitiesChart fromDate={fromDate} toDate={toDate} period="all" />
      <HeatmapChart     fromDate={fromDate} toDate={toDate} />
      <StreakCalendar   fromDate={fromDate} toDate={toDate} />
    </div>
  )
}

function fmt(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export function TimeMachine() {
  const store = useUIStore()

  const preset      = store.timeMachinePreset
  const fromDate    = store.timeMachineFrom
  const toDate      = store.timeMachineTo
  const compareMode = store.timeMachineCompareMode
  const compareFrom = store.timeMachineCompareFrom
  const compareTo   = store.timeMachineCompareTo

  const setEra     = (p) => {
    const found = PRESETS.find(x => x.key === p.key)
    store.setTimeMachineEra(p.key, found?.from ?? '', found?.to ?? '')
  }
  const setCompare = store.setTimeMachineCompareMode
  const setCompareEra = (from, to) => store.setTimeMachineCompareEra(from, to)

  // Compute the "now" range for vs_now mode (last 365 days)
  const nowTo   = new Date().toISOString().slice(0, 10)
  const nowFrom = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10)

  const compareFromDate = compareMode === 'vs_now' ? nowFrom : compareFrom
  const compareToDate   = compareMode === 'vs_now' ? nowTo   : compareTo
  const showCompare     = compareMode !== 'off' && (compareMode === 'vs_now' || (compareFrom && compareTo))

  return (
    <AnalyticsShell>
      <div className="h-full overflow-y-auto">
        <div className="px-6 py-5 space-y-4 max-w-7xl mx-auto">

          {/* Era picker */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-600 uppercase tracking-wide mr-1">Era</span>
            {PRESETS.map(p => (
              <button key={p.key} onClick={() => setEra(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  preset === p.key
                    ? 'bg-violet-600 text-white'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`}>
                {p.label}
              </button>
            ))}
          </div>

          {/* Compare mode */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-zinc-600 uppercase tracking-wide">Compare</span>
            <div className="flex gap-1">
              {COMPARE_MODES.map(m => (
                <button key={m.key} onClick={() => setCompare(m.key)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    compareMode === m.key ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                  }`}>
                  {m.label}
                </button>
              ))}
            </div>
            {compareMode === 'vs_era' && (
              <div className="flex items-center gap-1">
                <input type="date" defaultValue={compareFrom}
                  onChange={e => setCompareEra(e.target.value, compareTo)}
                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-violet-500" />
                <span className="text-zinc-600 text-xs">→</span>
                <input type="date" defaultValue={compareTo}
                  onChange={e => setCompareEra(compareFrom, e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-violet-500" />
              </div>
            )}
          </div>

          {/* Era bookmarks */}
          <EraBookmarks />

          {/* Era label */}
          <div className="text-xs text-zinc-600">
            {fmt(fromDate)} → {fmt(toDate)}
            {showCompare && <span className="ml-3 text-zinc-700">vs {fmt(compareFromDate)} → {fmt(compareToDate)}</span>}
          </div>

          {/* Era story */}
          <EraStory fromDate={fromDate} toDate={toDate} label={preset} />

          {/* Drift analysis */}
          <DriftAnalysis fromDate={fromDate} toDate={toDate} />

          {/* Charts — single or side-by-side */}
          {showCompare ? (
            <div className="grid grid-cols-2 gap-6">
              <EraCharts fromDate={fromDate}      toDate={toDate}      label={`Era: ${preset}`} />
              <EraCharts fromDate={compareFromDate} toDate={compareToDate} label={compareMode === 'vs_now' ? 'Now (last 365d)' : 'Compare era'} />
            </div>
          ) : (
            <EraCharts fromDate={fromDate} toDate={toDate} />
          )}

        </div>
      </div>
    </AnalyticsShell>
  )
}
