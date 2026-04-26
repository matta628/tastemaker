import { HighchartsReact } from 'highcharts-react-official'
import Highcharts from 'highcharts'
import { analytics } from '../../../api'
import { merge } from './chartTheme'
import { useChartData } from './useChartData'
import { ChartCard } from './ChartCard'

export function ActivityChart({ fromDate, toDate, granularity = 'day' }) {
  const { data, loading, error } = useChartData(
    () => analytics.activity({ from_date: fromDate, to_date: toDate, granularity }),
    [fromDate, toDate, granularity]
  )

  const options = merge({
    chart: { type: 'area', height: 200 },
    xAxis: {
      type: 'datetime',
      labels: {
        formatter() { return Highcharts.dateFormat(granularity === 'day' ? '%b %e' : '%b %Y', this.value) },
      },
    },
    yAxis: { min: 0 },
    plotOptions: {
      area: {
        color: '#8b5cf6',
        fillColor: { linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
          stops: [[0, 'rgba(139,92,246,0.35)'], [1, 'rgba(139,92,246,0)']] },
        lineWidth: 2,
        marker: { enabled: false },
        threshold: null,
      },
    },
    series: [{
      name: 'Plays',
      data: (data || []).map(d => [Date.parse(d.date), d.plays]),
    }],
    legend: { enabled: false },
    tooltip: { xDateFormat: granularity === 'day' ? '%b %e, %Y' : '%B %Y' },
  })

  return (
    <ChartCard title="Listening Activity" loading={loading} error={error}>
      <HighchartsReact highcharts={Highcharts} options={options} />
    </ChartCard>
  )
}
