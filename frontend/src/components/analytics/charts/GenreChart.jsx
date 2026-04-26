import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { HighchartsReact } from 'highcharts-react-official'
import Highcharts from 'highcharts'
import { analytics } from '../../../api'
import { merge } from './chartTheme'
import { useChartData } from './useChartData'
import { useUIStore } from '../../../store/uiStore'
import { useActionBus } from '../../../hooks/useActionBus'
import { ChartCard } from './ChartCard'
import { TagTracksTable } from './TagTracksTable'

export function GenreChart({ fromDate, toDate }) {
  const navigate = useNavigate()
  const location = useLocation()
  const store = useUIStore()
  const actionBus = useActionBus()
  const [selectedTag, setSelectedTag] = useState(null)

  const { data, loading, error } = useChartData(
    () => analytics.genreBreakdown({ from_date: fromDate, to_date: toDate, limit: 12 }),
    [fromDate, toDate]
  )

  const handleGenreClick = (tagName) => {
    setSelectedTag(tagName)
    const pathname = location.pathname

    // If on Dashboard, set genre filter to cross-filter all charts
    if (pathname === '/dashboard') {
      store.setDashboardGenreFilter(tagName)
    } else {
      // Otherwise, navigate to Discover with ephemeral set
      const setId = Date.now()
      store.addDiscoverSet(`${tagName} artists`, [])
      store.setDiscoverActiveSetId(setId)
      navigate('/discover?view=artists&genre=' + encodeURIComponent(tagName))
    }
  }

  const options = merge({
    chart: { type: 'pie', height: 220 },
    plotOptions: {
      pie: {
        dataLabels: { enabled: true, format: '{point.name}', style: { color: '#a1a1aa', fontSize: '10px', fontWeight: '400', textOutline: 'none' } },
        innerSize: '55%',
        size: '85%',
        point: {
          events: {
            click: function () { handleGenreClick(this.name) },
          },
        },
        cursor: 'pointer',
      },
    },
    series: [{
      name: 'Plays',
      data: (data || []).slice(0, 10).map(d => ({ name: d.tag, y: d.plays })),
    }],
    tooltip: { pointFormat: '<b>{point.y}</b> plays ({point.percentage:.1f}%)' },
    legend: { enabled: false },
  })

  const covered = data?.length ? `${data.length} genres` : null

  return (
    <ChartCard title="Genre Breakdown" hint={covered} loading={loading} error={error}>
      <HighchartsReact highcharts={Highcharts} options={options} />
      {selectedTag && (
        <TagTracksTable
          tag={selectedTag}
          tagType="genre"
          fromDate={fromDate}
          toDate={toDate}
          onClose={() => setSelectedTag(null)}
        />
      )}
    </ChartCard>
  )
}
