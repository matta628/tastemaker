import { HighchartsReact } from 'highcharts-react-official'
import Highcharts from 'highcharts'
import { analytics } from '../../../api'
import { merge } from './chartTheme'
import { useChartData } from './useChartData'
import { ChartCard } from './ChartCard'

export function NewArtistsChart({ fromDate, toDate }) {
  const gran = fromDate ? 'month' : 'month'
  const { data, loading, error } = useChartData(
    () => analytics.newArtists({ from_date: fromDate, to_date: toDate, granularity: gran }),
    [fromDate, toDate]
  )

  const options = merge({
    chart: { type: 'column', height: 180 },
    xAxis: {
      type: 'datetime',
      labels: { formatter() { return Highcharts.dateFormat('%b %Y', this.value) } },
    },
    yAxis: { min: 0 },
    plotOptions: {
      column: { color: '#6366f1', borderRadius: 3, borderWidth: 0 },
    },
    series: [{
      name: 'New Artists',
      data: (data || []).map(d => [Date.parse(d.date), d.new_artists]),
    }],
    legend: { enabled: false },
    tooltip: { xDateFormat: '%B %Y', pointFormat: '<b>{point.y}</b> new artists' },
  })

  return (
    <ChartCard title="New Artists Discovered" loading={loading} error={error}>
      <HighchartsReact highcharts={Highcharts} options={options} />
    </ChartCard>
  )
}
