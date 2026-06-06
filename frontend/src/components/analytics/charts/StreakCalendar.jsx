import { HighchartsReact } from 'highcharts-react-official'
import Highcharts from 'highcharts'
import { analytics } from '../../../api'
import { merge, MONTH_LABELS } from './chartTheme'
import { useChartData } from './useChartData'
import { ChartCard } from './ChartCard'

function buildCalendarData(streakData, weeks = 53) {
  const now = new Date()
  const start = new Date(now)
  start.setDate(start.getDate() - weeks * 7)
  start.setDate(start.getDate() - start.getDay()) // align to Sunday

  const playMap = {}
  streakData.forEach(({ date, plays }) => { playMap[date] = plays })

  const points = []
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const date = new Date(start)
      date.setDate(date.getDate() + w * 7 + d)
      if (date > now) continue
      const iso = date.toISOString().split('T')[0]
      points.push({ x: w, y: d, value: playMap[iso] ?? 0, date: iso })
    }
  }
  return { points, start }
}

function monthTickPositions(start, weeks) {
  const positions = []
  for (let w = 0; w < weeks; w++) {
    const d = new Date(start)
    d.setDate(d.getDate() + w * 7)
    if (d.getDate() <= 7) positions.push({ w, month: d.getMonth() })
  }
  return positions
}

export function StreakCalendar({ fromDate, toDate }) {
  const { data, loading, error } = useChartData(
    () => analytics.listeningStreak({ from_date: fromDate, to_date: toDate }),
    [fromDate, toDate]
  )

  const WEEKS = 53
  const { points, start } = buildCalendarData(data || [], WEEKS)
  const ticks = monthTickPositions(start, WEEKS)

  const options = merge({
    chart: { type: 'heatmap', height: 140, marginTop: 24, marginBottom: 4 },
    xAxis: {
      min: 0, max: WEEKS - 1,
      tickPositions: ticks.map(t => t.w),
      labels: {
        formatter() { const t = ticks.find(t => t.w === this.value); return t ? MONTH_LABELS[t.month] : '' },
        style: { color: '#71717a', fontSize: '10px' },
      },
      gridLineColor: 'transparent', lineColor: 'transparent', tickColor: 'transparent',
    },
    yAxis: {
      min: 0, max: 6,
      categories: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
      labels: { style: { color: '#52525b', fontSize: '9px' } },
      reversed: false,
      gridLineColor: 'transparent',
    },
    colorAxis: {
      min: 0,
      stops: [
        [0,    '#1c1c1e'],
        [0.01, '#2e1065'],
        [0.3,  '#5b21b6'],
        [1,    '#8b5cf6'],
      ],
      labels: { enabled: false },
    },
    legend: { enabled: false },
    plotOptions: {
      heatmap: { borderWidth: 2, borderColor: '#09090b', borderRadius: 2 },
    },
    series: [{
      name: 'Plays',
      data: points.map(p => ({ x: p.x, y: p.y, value: p.value, date: p.date })),
    }],
    tooltip: {
      formatter() { return `<b>${this.point.date}</b><br/>${this.point.value} plays` },
    },
  })

  return (
    <ChartCard title="Listening Streak" loading={loading} error={error}>
      <HighchartsReact highcharts={Highcharts} options={options} />
    </ChartCard>
  )
}
