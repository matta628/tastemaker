import { HighchartsReact } from 'highcharts-react-official'
import Highcharts from 'highcharts'
import { analytics } from '../../../api'
import { merge, DAY_LABELS } from './chartTheme'
import { useChartData } from './useChartData'
import { ChartCard } from './ChartCard'

export function DayOfWeekChart({ fromDate, toDate }) {
  const { data, loading, error } = useChartData(
    () => analytics.dayOfWeek({ from_date: fromDate, to_date: toDate }),
    [fromDate, toDate]
  )

  const sorted = DAY_LABELS.map((label, i) => {
    const found = (data || []).find(d => d.day_of_week === i)
    return { label, plays: found?.plays ?? 0 }
  })

  const options = merge({
    chart: { type: 'column', height: 180 },
    xAxis: { categories: sorted.map(d => d.label) },
    yAxis: { min: 0 },
    plotOptions: {
      column: { color: '#8b5cf6', borderRadius: 4, borderWidth: 0 },
    },
    series: [{ name: 'Plays', data: sorted.map(d => d.plays) }],
    legend: { enabled: false },
    tooltip: { pointFormat: '<b>{point.y}</b> plays' },
  })

  return (
    <ChartCard title="Plays by Day" loading={loading} error={error}>
      <HighchartsReact highcharts={Highcharts} options={options} />
    </ChartCard>
  )
}
