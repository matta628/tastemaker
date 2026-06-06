import { useState } from 'react'
import { HighchartsReact } from 'highcharts-react-official'
import Highcharts from 'highcharts'
import { useNavigate } from 'react-router-dom'
import { analytics } from '../../../api'
import { merge, periodToStatsCol } from './chartTheme'
import { useChartData } from './useChartData'
import { ChartCard } from './ChartCard'

export function TopEntitiesChart({ fromDate, toDate, period = 'all', metric = 'plays', topN = 15, onMetricChange, onTopNChange, genreFilter }) {
  const [entity, setEntity] = useState('artist')
  const navigate = useNavigate()

  // Use date-range endpoint when dates are provided (Time Machine), stats table otherwise
  const useDateRange = !!(fromDate && toDate)
  const sortBy = periodToStatsCol(period)

  const { data: raw, loading, error } = useChartData(
    () => {
      if (useDateRange) {
        return analytics.topEntities({ entity_type: entity, from_date: fromDate, to_date: toDate, limit: topN, genre_filter: genreFilter })
      }
      const p = { sort_by: sortBy, sort_dir: 'desc', limit: topN }
      if (genreFilter) p.genre_filter = genreFilter
      if (entity === 'artist') return analytics.entitiesArtists(p)
      if (entity === 'album')  return analytics.entitiesAlbums(p)
      return analytics.entitiesTracks(p)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entity, sortBy, `${fromDate}|${toDate}`, topN, genreFilter]
  )

  const rows = useDateRange
    ? (Array.isArray(raw) ? raw : [])
    : (raw?.rows ?? [])

  const categories = rows.map(r => useDateRange ? r.name : (
    entity === 'artist' ? r.artist : entity === 'album' ? r.album : r.track
  ))
  const values = rows.map(r => useDateRange ? r.plays : (r[sortBy] ?? r.total_plays ?? 0))

  const options = merge({
    chart: { type: 'bar', height: 280 },
    xAxis: { categories, labels: { style: { color: '#a1a1aa', fontSize: '11px' } } },
    yAxis: { min: 0, title: { text: 'Plays' } },
    plotOptions: {
      bar: {
        color: '#8b5cf6',
        borderRadius: 4,
        dataLabels: { enabled: false },
        point: {
          events: {
            click() {
              navigate(`/explore/${entity}/${encodeURIComponent(categories[this.index])}`)
            },
          },
        },
        cursor: 'pointer',
      },
    },
    series: [{ name: 'Plays', data: values }],
    legend: { enabled: false },
    tooltip: { pointFormat: '<b>{point.y}</b> plays' },
  })

  const TABS = [
    { key: 'artist', label: 'Artists' },
    { key: 'album',  label: 'Albums'  },
    { key: 'track',  label: 'Tracks'  },
  ]

  return (
    <ChartCard title="Top" loading={loading} error={error}
      hint={
        <div className="flex gap-3 items-center">
          <div className="flex gap-1">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setEntity(t.key)}
                className={`px-2 py-0.5 rounded text-xs transition-colors ${
                  entity === t.key ? 'bg-violet-600 text-white' : 'text-zinc-500 hover:text-zinc-300'
                }`}>
                {t.label}
              </button>
            ))}
          </div>
          {onTopNChange && (
            <div className="flex gap-1 items-center">
              <span className="text-[10px] text-zinc-600">Top:</span>
              {[10, 15, 25].map(n => (
                <button key={n} onClick={() => onTopNChange(n)}
                  className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                    topN === n ? 'bg-violet-600 text-white' : 'text-zinc-500 hover:text-zinc-300'
                  }`}>
                  {n}
                </button>
              ))}
            </div>
          )}
        </div>
      }>
      <HighchartsReact highcharts={Highcharts} options={options} />
    </ChartCard>
  )
}
