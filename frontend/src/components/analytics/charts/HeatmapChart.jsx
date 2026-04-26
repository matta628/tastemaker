import { HighchartsReact } from 'highcharts-react-official'
import Highcharts from 'highcharts'
import { analytics } from '../../../api'
import { merge, DAY_LABELS } from './chartTheme'
import { useChartData } from './useChartData'
import { ChartCard } from './ChartCard'

export function HeatmapChart({ fromDate, toDate }) {
  const { data, loading, error } = useChartData(
    () => analytics.heatmap({ from_date: fromDate, to_date: toDate }),
    [fromDate, toDate]
  )

  const maxPlays = data ? Math.max(...data.map(d => d.plays), 1) : 1

  const options = merge({
    chart: { type: 'heatmap', height: 220, marginTop: 8 },
    xAxis: {
      min: 0, max: 23,
      tickInterval: 3,
      labels: {
        formatter() { return this.value === 0 ? '12am' : this.value < 12 ? `${this.value}am` : this.value === 12 ? '12pm' : `${this.value - 12}pm` },
        style: { color: '#71717a', fontSize: '10px' },
      },
      gridLineColor: 'transparent',
      lineColor: 'transparent',
      tickColor: 'transparent',
    },
    yAxis: {
      min: 0, max: 6,
      categories: DAY_LABELS,
      labels: { style: { color: '#71717a', fontSize: '10px' } },
      reversed: false,
      gridLineColor: 'transparent',
    },
    colorAxis: {
      min: 0,
      stops: [
        [0,    '#27272a'],
        [0.01, '#3b1e7a'],
        [0.3,  '#6d28d9'],
        [1,    '#8b5cf6'],
      ],
      labels: { enabled: false },
    },
    legend: { enabled: false },
    plotOptions: {
      heatmap: { borderWidth: 2, borderColor: '#09090b', borderRadius: 3, nullColor: '#27272a' },
    },
    series: [{
      name: 'Plays',
      data: (data || []).map(d => [d.hour, d.day_of_week, d.plays]),
      dataLabels: { enabled: false },
    }],
    tooltip: {
      formatter() {
        const hour = this.point.x
        const label = hour === 0 ? '12am' : hour < 12 ? `${hour}am` : hour === 12 ? '12pm' : `${hour - 12}pm`
        return `<b>${DAY_LABELS[this.point.y]} ${label}</b><br/>${this.point.value} plays`
      },
    },
  })

  return (
    <ChartCard title="Listening by Hour & Day" loading={loading} error={error}>
      <HighchartsReact highcharts={Highcharts} options={options} />
    </ChartCard>
  )
}
