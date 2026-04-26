import Highcharts from 'highcharts'
import 'highcharts/modules/heatmap'

export const COLORS = [
  '#8b5cf6', // violet-500   265° — brand primary
  '#f43f5e', // rose-500     350° — replaces indigo (no more violet/indigo cluster)
  '#f59e0b', // amber-400     43°
  '#10b981', // emerald-500  160°
  '#3b82f6', // blue-500     217°
  '#f97316', // orange-500    24°
  '#06b6d4', // cyan-500     189°
  '#ef4444', // red-500        0°
  '#a3e635', // lime-400      80°
  '#d946ef', // fuchsia-500  292°
  '#14b8a6', // teal-500     174°
  '#ec4899', // pink-500     330°
]

export const BASE = {
  chart: { backgroundColor: 'transparent', style: { fontFamily: 'inherit' }, animation: { duration: 300 } },
  title: { text: null },
  credits: { enabled: false },
  legend: {
    itemStyle: { color: '#a1a1aa', fontWeight: '400', fontSize: '11px' },
    itemHoverStyle: { color: '#f4f4f5' },
  },
  tooltip: {
    backgroundColor: '#18181b',
    borderColor: '#3f3f46',
    borderRadius: 8,
    style: { color: '#f4f4f5', fontSize: '12px' },
    shadow: false,
  },
  colors: COLORS,
  xAxis: {
    labels: { style: { color: '#71717a', fontSize: '11px' } },
    gridLineColor: '#27272a',
    lineColor: '#3f3f46',
    tickColor: '#3f3f46',
  },
  yAxis: {
    labels: { style: { color: '#71717a', fontSize: '11px' } },
    gridLineColor: '#27272a',
    title: { text: null },
  },
  plotOptions: {
    series: { animation: { duration: 300 } },
  },
}

export function merge(...opts) {
  return Highcharts.merge({}, BASE, ...opts)
}

// Maps a preset period key → { from_date, to_date } ISO strings
export function periodToDates(period) {
  const now = new Date()
  const to = now.toISOString()
  const from = (days) => {
    const d = new Date(now)
    d.setDate(d.getDate() - days)
    return d.toISOString()
  }
  switch (period) {
    case '7d':   return { from_date: from(7),   to_date: to }
    case '30d':  return { from_date: from(30),  to_date: to }
    case '90d':  return { from_date: from(90),  to_date: to }
    case '180d': return { from_date: from(180), to_date: to }
    case '1y':   return { from_date: from(365), to_date: to }
    case '2y':   return { from_date: from(730), to_date: to }
    default:     return {}
  }
}

// Maps a period to the appropriate plays_* column name for stats tables
export function periodToStatsCol(period) {
  return { '7d': 'plays_7d', '30d': 'plays_30d', '90d': 'plays_90d',
           '180d': 'plays_180d', '1y': 'plays_1y', '2y': 'plays_2y' }[period] ?? 'total_plays'
}

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
