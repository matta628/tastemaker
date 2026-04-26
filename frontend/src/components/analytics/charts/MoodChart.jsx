import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HighchartsReact } from 'highcharts-react-official'
import Highcharts from 'highcharts'
import { analytics } from '../../../api'
import { merge, COLORS } from './chartTheme'
import { useChartData } from './useChartData'
import { useUIStore } from '../../../store/uiStore'
import { ChartCard } from './ChartCard'
import { TagTracksTable } from './TagTracksTable'

export function MoodChart({ fromDate, toDate }) {
  const navigate = useNavigate()
  const store = useUIStore()
  const [selectedTag, setSelectedTag] = useState(null)

  const { data, loading, error } = useChartData(
    () => analytics.moodBreakdown({ from_date: fromDate, to_date: toDate }),
    [fromDate, toDate]
  )

  const handleMoodClick = (moodName) => {
    setSelectedTag(moodName)
    // Create ephemeral set with this mood
    const setId = Date.now()
    store.addDiscoverSet(`${moodName} songs`, [])
    store.setDiscoverActiveSetId(setId)
    // Navigate to Discover
    navigate('/discover?view=tracks&mood=' + encodeURIComponent(moodName))
  }

  const options = merge({
    chart: { type: 'pie', height: 220 },
    colors: COLORS.slice(2),
    plotOptions: {
      pie: {
        dataLabels: { enabled: true, format: '{point.name}', style: { color: '#a1a1aa', fontSize: '10px', fontWeight: '400', textOutline: 'none' } },
        innerSize: '55%',
        size: '85%',
        point: {
          events: {
            click: function () { handleMoodClick(this.name) },
          },
        },
        cursor: 'pointer',
      },
    },
    series: [{
      name: 'Plays',
      data: (data || []).slice(0, 10).map(d => ({ name: d.mood, y: d.plays })),
    }],
    tooltip: { pointFormat: '<b>{point.y}</b> plays ({point.percentage:.1f}%)' },
    legend: { enabled: false },
  })

  return (
    <ChartCard title="Mood / Energy" loading={loading} error={!data?.length && !loading ? 'no data' : error}>
      {!loading && !data?.length
        ? <div className="h-[180px] flex items-center justify-center text-zinc-700 text-xs">Mood analysis not yet run</div>
        : <HighchartsReact highcharts={Highcharts} options={options} />
      }
      {selectedTag && (
        <TagTracksTable
          tag={selectedTag}
          tagType="mood"
          fromDate={fromDate}
          toDate={toDate}
          onClose={() => setSelectedTag(null)}
        />
      )}
    </ChartCard>
  )
}
