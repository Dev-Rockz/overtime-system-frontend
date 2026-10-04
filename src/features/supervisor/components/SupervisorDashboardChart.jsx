import { useEffect, useState } from 'react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'

const SERIES = [
  { id: 'planned', label: 'Submitted', color: '#0033cc' },
  { id: 'accepted', label: 'Accepted', color: '#b87918' },
  { id: 'actual', label: 'Actual', color: '#0f847b' },
]

function DashboardTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  return (
    <div className="supervisor-dashboard-chart__tooltip">
      <strong>{payload[0].payload.fullLabel}</strong>
      {payload.filter((item) => item.value !== null).map((item) => (
        <span key={item.dataKey}><i className={`is-${item.dataKey}`} />{SERIES.find((series) => series.id === item.dataKey)?.label}<b>{new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(item.value)}h</b></span>
      ))}
    </div>
  )
}

export function SupervisorDashboardChart({ data, mode, today, type, visibleSeries = ['planned', 'accepted', 'actual'] }) {
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false)
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const change = () => setReducedMotion(media.matches)
    media?.addEventListener?.('change', change)
    return () => media?.removeEventListener?.('change', change)
  }, [])
  const commonProps = { data, margin: { top: 20, right: 18, bottom: 6, left: 0 } }
  const series = SERIES.filter((item) => visibleSeries.includes(item.id))
  const axes = (
    <>
      <CartesianGrid stroke="#e9edf3" strokeDasharray="2 5" vertical={false} />
      <XAxis axisLine={false} dataKey="tick" fontSize={11} interval={mode === 'month' ? 2 : 0} minTickGap={8} tick={{ fill: '#6b7280' }} tickLine={false} tickMargin={12} />
      <YAxis axisLine={false} fontSize={10} tick={{ fill: '#8894a5' }} tickFormatter={(value) => `${value}h`} tickLine={false} width={44} />
      <Tooltip content={<DashboardTooltip />} cursor={type === 'bar' ? { fill: '#f2f5fa' } : { stroke: '#b5c2d6', strokeDasharray: '3 4' }} />
      {data.some((point) => point.date === today) && <ReferenceLine stroke="#b5c2d6" strokeDasharray="3 4" x={data.find((point) => point.date === today)?.tick} />}
    </>
  )
  const animation = { animationDuration: 850, isAnimationActive: !reducedMotion }
  let chart
  if (type === 'line') {
    chart = <LineChart {...commonProps} accessibilityLayer>{axes}{series.map((item, index) => <Line {...animation} key={item.id} animationBegin={index * 90} dataKey={item.id} name={item.label} dot={mode === 'week' ? { r: 3, strokeWidth: 2, fill: '#fff' } : false} activeDot={{ r: 5, strokeWidth: 3, stroke: '#fff' }} stroke={item.color} strokeWidth={2.5} type="monotone" />)}</LineChart>
  } else if (type === 'area') {
    chart = <AreaChart {...commonProps} accessibilityLayer>{axes}{series.map((item, index) => <Area {...animation} key={item.id} animationBegin={index * 90} dataKey={item.id} name={item.label} fill={item.color} fillOpacity={.08} stroke={item.color} strokeWidth={2.5} type="monotone" />)}</AreaChart>
  } else {
    chart = <BarChart {...commonProps} accessibilityLayer barGap={4} barCategoryGap="24%">{axes}{series.map((item, index) => <Bar {...animation} key={item.id} animationBegin={index * 90} dataKey={item.id} name={item.label} fill={item.color} maxBarSize={32} radius={[4, 4, 0, 0]} />)}</BarChart>
  }
  return <ResponsiveContainer height="100%" minWidth={0} width="100%">{chart}</ResponsiveContainer>
}
