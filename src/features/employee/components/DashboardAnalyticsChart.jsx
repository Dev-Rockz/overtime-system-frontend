import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

function formatHours(value) {
  return new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(Number(value) || 0)
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null

  const point = payload[0].payload
  return (
    <div className="dashboard-chart-tooltip">
      <strong>{point.fullLabel}</strong>
      <span><i className="is-planned" />Planned <b>{formatHours(point.planned)}h</b></span>
      <span><i className="is-actual" />Actual <b>{formatHours(point.actual)}h</b></span>
    </div>
  )
}

export default function DashboardAnalyticsChart({ chartData, chartType, periodMode, todayTick }) {
  const commonProps = {
    data: chartData,
    margin: { top: 18, right: 18, left: -14, bottom: 4 },
  }
  const commonAxis = (
    <>
      <CartesianGrid stroke="#e6ebf3" strokeDasharray="4 5" vertical={false} />
      <XAxis
        axisLine={false}
        dataKey="tick"
        fontSize={9}
        interval={periodMode === 'month' ? 2 : 0}
        minTickGap={12}
        tick={{ fill: '#748198' }}
        tickLine={false}
      />
      <YAxis
        allowDecimals={false}
        axisLine={false}
        fontSize={9}
        tick={{ fill: '#8995a8' }}
        tickFormatter={(value) => `${value}h`}
        tickLine={false}
        width={42}
      />
      <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f4f7fd' }} />
      {todayTick ? <ReferenceLine stroke="#8fa2c9" strokeDasharray="3 4" x={todayTick} /> : null}
    </>
  )

  if (chartType === 'line') {
    return (
      <ResponsiveContainer height="100%" minWidth={0} width="100%">
        <LineChart {...commonProps} accessibilityLayer>
          {commonAxis}
          <Line
            activeDot={{ r: 5, strokeWidth: 3 }}
            animationDuration={900}
            dataKey="planned"
            dot={{ fill: '#ffffff', r: 3, strokeWidth: 2 }}
            name="Planned"
            stroke="#0033cc"
            strokeWidth={3}
            type="monotone"
          />
          <Line
            activeDot={{ r: 5, strokeWidth: 3 }}
            animationBegin={120}
            animationDuration={900}
            dataKey="actual"
            dot={{ fill: '#ffffff', r: 3, strokeWidth: 2 }}
            name="Actual"
            stroke="#0f8a7b"
            strokeWidth={3}
            type="monotone"
          />
        </LineChart>
      </ResponsiveContainer>
    )
  }

  if (chartType === 'area') {
    return (
      <ResponsiveContainer height="100%" minWidth={0} width="100%">
        <AreaChart {...commonProps} accessibilityLayer>
          {commonAxis}
          <Area
            animationDuration={900}
            dataKey="planned"
            fill="#0033cc"
            fillOpacity={0.13}
            name="Planned"
            stroke="#0033cc"
            strokeWidth={2.5}
            type="monotone"
          />
          <Area
            animationBegin={120}
            animationDuration={900}
            dataKey="actual"
            fill="#0f8a7b"
            fillOpacity={0.16}
            name="Actual"
            stroke="#0f8a7b"
            strokeWidth={2.5}
            type="monotone"
          />
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer height="100%" minWidth={0} width="100%">
      <BarChart {...commonProps} accessibilityLayer barGap={5}>
        {commonAxis}
        <Bar
          animationDuration={850}
          dataKey="planned"
          fill="#0033cc"
          maxBarSize={30}
          name="Planned"
          radius={[4, 4, 1, 1]}
        />
        <Bar
          animationBegin={100}
          animationDuration={850}
          dataKey="actual"
          fill="#0f8a7b"
          maxBarSize={30}
          name="Actual"
          radius={[4, 4, 1, 1]}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
