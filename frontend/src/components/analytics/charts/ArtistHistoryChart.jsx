import { HighchartsReact } from 'highcharts-react-official'
import Highcharts from 'highcharts'
import { analytics } from '../../../api'
import { merge } from './chartTheme'
import { useChartData } from './useChartData'
import { ChartCard } from './ChartCard'

const METRIC_LABEL = { plays: 'Plays', unique_tracks: 'Unique tracks' }

export function ArtistHistoryChart({ name, fromDate, toDate, granularity = 'week', chartType = 'area', annotationPoints = [], metric = 'plays', _fetcher }) {
  const { data, loading, error } = useChartData(
    _fetcher ?? (() => analytics.artistHistory(name, { from_date: fromDate, to_date: toDate, granularity, metric })),
    [name, fromDate, toDate, granularity, metric]
  )

  const type = chartType === 'line' ? 'line' : chartType === 'bar' ? 'column' : 'area'
  const label = METRIC_LABEL[metric] ?? metric

  const options = merge({
    chart: { type, height: 220 },
    xAxis: {
      type: 'datetime',
      labels: {
        formatter() {
          if (granularity === 'year') return Highcharts.dateFormat('%Y', this.value)
          if (granularity === 'day')  return Highcharts.dateFormat('%b %e', this.value)
          return Highcharts.dateFormat('%b %Y', this.value)
        }
      },
      plotLines: annotationPoints.map(a => ({
        value: Date.parse(a.date),
        color: '#6366f1',
        width: 1.5,
        dashStyle: 'ShortDash',
        label: {
          text: a.label,
          style: { color: '#a1a1aa', fontSize: '10px' },
          rotation: 0,
          y: 14,
        },
        zIndex: 5,
      })),
    },
    yAxis: { min: 0 },
    plotOptions: {
      area: {
        color: '#8b5cf6',
        fillColor: { linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
          stops: [[0, 'rgba(139,92,246,0.35)'], [1, 'rgba(139,92,246,0)']] },
        lineWidth: 2, marker: { enabled: false }, threshold: null,
      },
    },
    series: [{ name: label, data: (data || []).map(d => [Date.parse(d.date), d.value ?? d.plays ?? 0]) }],
    legend: { enabled: false },
    tooltip: { xDateFormat: '%b %e, %Y', pointFormat: `<b>{point.y}</b> ${label.toLowerCase()}` },
  })

  return (
    <ChartCard title="Play History" loading={loading} error={error}>
      <HighchartsReact highcharts={Highcharts} options={options} />
    </ChartCard>
  )
}
