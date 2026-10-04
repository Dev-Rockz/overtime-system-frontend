import { createElement, useEffect, useState } from 'react'
import {
  AlertCircle, AreaChart, ArrowRight, BarChart3, CalendarDays, Check,
  ChevronLeft, ChevronRight, ClipboardList, Clock3, FilePlus2, LineChart,
  RefreshCw, RotateCcw, Signature, TrendingUp, UsersRound,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth.js'
import { useDashboardEntrance } from '../../auth/useDashboardEntrance.js'
import { SupervisorDashboardChart } from '../components/SupervisorDashboardChart.jsx'
import { SupervisorDashboardTeam } from '../components/SupervisorDashboardTeam.jsx'
import { SupervisorDashboardWorkflow } from '../components/SupervisorDashboardWorkflow.jsx'
import { useSupervisorDashboard } from '../useSupervisorDashboard.js'
import { moveDashboardAnchor } from '../utils/supervisorDashboardView.js'
import { parseDateValue, toDateValue } from '../utils/weekPeriod.js'
import './supervisorDashboard.css'

const CHART_TYPES = [
  { id: 'bar', icon: BarChart3, label: 'Bar chart' },
  { id: 'line', icon: LineChart, label: 'Line chart' },
  { id: 'area', icon: AreaChart, label: 'Area chart' },
]
const SERIES = [{ id: 'planned', label: 'Submitted' }, { id: 'accepted', label: 'Accepted' }, { id: 'actual', label: 'Actual' }]
const hours = (value) => new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(Number(value) || 0)

function formatRange(range, mode) {
  const formatter = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' })
  if (mode === 'month') return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(parseDateValue(range.dateFrom))
  return `${formatter.format(parseDateValue(range.dateFrom))} - ${formatter.format(parseDateValue(range.dateTo))}, ${range.dateTo.slice(0, 4)}`
}

function DashboardClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  return <div className="supervisor-dashboard__clock"><time dateTime={now.toISOString()}>{new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).format(now)}</time><span>Today is {new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(now)}</span></div>
}

function DashboardSkeleton() {
  return <div className="supervisor-dashboard-skeleton" role="status" aria-label="Loading supervisor dashboard"><div className="supervisor-dashboard-skeleton__heading" /><div className="supervisor-dashboard-skeleton__toolbar" /><div className="supervisor-dashboard-skeleton__metrics">{[0, 1, 2, 3].map((key) => <i key={key} />)}</div><div className="supervisor-dashboard-skeleton__queue" /><div className="supervisor-dashboard-skeleton__chart" /><div className="supervisor-dashboard-skeleton__lower"><i /><i /></div></div>
}

function Workload({ rows, ready }) {
  const [sort, setSort] = useState('planned')
  const sorted = [...rows].sort((a, b) => b[sort] - a[sort] || a.employeeName.localeCompare(b.employeeName)).slice(0, 5)
  const max = Math.max(1, ...sorted.flatMap((row) => [row.planned, row.actual]))
  return <section className="supervisor-dashboard__workload" aria-labelledby="dashboard-workload-title">
    <header className="supervisor-dashboard__section-heading"><div><UsersRound size={18} /><h2 id="dashboard-workload-title">Employee workload <small>Top 5 by hours</small></h2></div><select aria-label="Rank workload by" value={sort} onChange={(event) => setSort(event.target.value)}><option value="planned">Submitted hours</option><option value="actual" disabled={!ready}>Actual hours</option></select></header>
    <div className="supervisor-dashboard__workload-legend"><span><i className="is-planned" />Submitted</span><span><i className="is-actual" />Actual</span></div>
    {sorted.length ? <ol className="supervisor-dashboard__workload-list">{sorted.map((row, index) => <li key={row.employeeId}>
      <span className="supervisor-dashboard__rank">{String(index + 1).padStart(2, '0')}</span>
      <div><div className="supervisor-dashboard__workload-label"><Link to={`/supervisor/team/${encodeURIComponent(row.employeeId)}`}>{row.employeeName}</Link><span><b>{hours(row.planned)}h</b><small> / {ready ? `${hours(row.actual)}h` : 'Pending'}</small></span></div>
        <div className="supervisor-dashboard__workload-bars" aria-label={`${row.employeeName}: ${hours(row.planned)} submitted hours${ready ? `, ${hours(row.actual)} actual hours` : ', actual data unavailable'}`}><i style={{ width: `${row.planned / max * 100}%` }} /><i className="is-actual" style={{ width: `${ready ? row.actual / max * 100 : 0}%` }} /></div>
      </div>
    </li>)}</ol> : <div className="supervisor-dashboard__empty"><UsersRound size={24} /><span>No employee workload in this period.</span></div>}
  </section>
}

export function SupervisorHomePage() {
  const [mode, setMode] = useState('week')
  const [anchorDate, setAnchorDate] = useState(() => toDateValue(new Date()))
  const [chartType, setChartType] = useState('bar')
  const [visibleSeries, setVisibleSeries] = useState(['planned', 'accepted', 'actual'])
  const [teamFilter, setTeamFilter] = useState('all')
  const { user } = useAuth()
  const dashboard = useSupervisorDashboard(mode, anchorDate)
  const entranceClass = useDashboardEntrance(!dashboard.preparationQuery.isPending)
  const { preparation, range, actual, actualReady, actualLoading, actualError, actualPeriods, chartData } = dashboard
  const today = toDateValue(new Date())
  const returnedDepartmentPlans = preparation.activeDepartmentPlans.filter((plan) => plan.status === 'returned_for_revision')
  const readiness = preparation.totalWeeks ? Math.round(preparation.coveredWeeks / preparation.totalWeeks * 100) : 0
  const peak = chartData.reduce((best, point) => point.planned > (best?.planned || 0) ? point : best, null)
  const acceptedHours = chartData.reduce((sum, point) => sum + point.accepted, 0)
  const actions = [
    { id: 'review', label: 'Awaiting review', count: preparation.awaitingReview.length, unit: 'plans', icon: ClipboardList },
    { id: 'returned', label: 'Employee revisions', count: preparation.returnedPlans.length, unit: 'plans', icon: RotateCcw },
    { id: 'gaps', label: 'Coverage gaps', count: preparation.coverageGaps, unit: 'employees', icon: UsersRound },
    { id: 'unsigned', label: 'Missing signature', count: preparation.unsignedPlans.length, unit: 'plans', icon: Signature },
  ].filter((action) => action.count)

  function showTeam(filter) {
    setTeamFilter(filter)
    document.getElementById('dashboard-team')?.scrollIntoView?.({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' })
  }

  if (dashboard.preparationQuery.isPending) return <main className={`supervisor-main supervisor-dashboard${entranceClass}`}><DashboardSkeleton /></main>
  if (dashboard.preparationQuery.isError) return <main className={`supervisor-main supervisor-dashboard${entranceClass}`}><h1>Department overview</h1><div className="supervisor-dashboard__inline-error" role="alert"><AlertCircle size={22} /><div><strong>Unable to load the dashboard</strong><p>{dashboard.preparationQuery.error.message}</p></div><button type="button" onClick={dashboard.refresh}>Retry</button></div></main>

  return (
    <main className={`supervisor-main supervisor-dashboard${entranceClass}`}>
      <header className="supervisor-dashboard__header">
        <div className="supervisor-dashboard__welcome"><span>Department overview</span><h1>Hi, {user?.firstName || user?.name || 'Supervisor'}.</h1><nav aria-label="Dashboard shortcuts"><Link to="/supervisor/assign-overtime"><FilePlus2 size={15} />Assign overtime</Link><Link to="/supervisor/department-drafts"><ClipboardList size={15} />Department drafts <ArrowRight size={13} /></Link></nav></div>
        <DashboardClock />
      </header>

      <section className="supervisor-dashboard__period" aria-label="Dashboard period controls">
        <div className="supervisor-dashboard__mode" role="group" aria-label="Dashboard period type">{['week', 'month'].map((option) => <button key={option} aria-pressed={mode === option} onClick={() => setMode(option)} type="button">{option === 'week' ? 'Week' : 'Month'}</button>)}</div>
        <div className="supervisor-dashboard__date-controls">
          <button className="supervisor-dashboard__icon-button" aria-label={`Previous ${mode}`} title={`Previous ${mode}`} onClick={() => setAnchorDate(moveDashboardAnchor(mode, anchorDate, -1))} type="button"><ChevronLeft size={16} /></button>
          <label className="supervisor-dashboard__date"><CalendarDays size={16} /><span>{formatRange(range, mode)}</span><input aria-label={`Select dashboard ${mode}`} type={mode === 'month' ? 'month' : 'date'} value={mode === 'month' ? anchorDate.slice(0, 7) : anchorDate} onChange={(event) => { if (event.target.value) setAnchorDate(mode === 'month' ? `${event.target.value}-01` : event.target.value) }} /></label>
          <button className="supervisor-dashboard__icon-button" aria-label={`Next ${mode}`} title={`Next ${mode}`} onClick={() => setAnchorDate(moveDashboardAnchor(mode, anchorDate, 1))} type="button"><ChevronRight size={16} /></button>
        </div>
        <button className="supervisor-dashboard__today" type="button" onClick={() => setAnchorDate(toDateValue(new Date()))}>Today</button>
        <span className="supervisor-dashboard__updated">Updated {new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit' }).format(new Date(dashboard.updatedAt))}</span>
        <button className="supervisor-dashboard__icon-button" aria-label="Refresh dashboard" title="Refresh dashboard" disabled={dashboard.isRefreshing} onClick={dashboard.refresh} type="button"><RefreshCw size={16} className={dashboard.isRefreshing ? 'supervisor-dashboard__spin' : ''} /></button>
      </section>

      <section className="supervisor-dashboard__metrics" aria-label="Selected period summary">
        <article className="is-blue"><span><CalendarDays size={16} />Submitted overtime</span><strong>{hours(preparation.includedPlannedHours)}<small>hrs</small></strong><p>{hours(acceptedHours)}h supervisor accepted</p></article>
        <article className="is-teal"><span><Clock3 size={16} />Actual overtime</span><strong>{actualReady ? hours(actual.actualHours) : '--'}<small>hrs</small></strong><p>{actualError ? 'Data unavailable' : actualLoading ? 'Loading records...' : `${actual.pendingCount} entries pending`}</p></article>
        <article className="is-amber"><span><ClipboardList size={16} />Awaiting review</span><strong>{preparation.awaitingReview.length}<small>plans</small></strong><button type="button" onClick={() => showTeam('review')}>View review queue <ArrowRight size={13} /></button></article>
        <article className="is-rose"><span><Signature size={16} />Submission coverage</span><strong>{readiness}<small>%</small></strong><p>{preparation.coveredWeeks} / {preparation.totalWeeks} employee-weeks signed</p><div className="supervisor-dashboard__coverage-meter" aria-hidden="true"><i style={{ width: `${readiness}%` }} /></div></article>
      </section>

      <section className="supervisor-dashboard__bulletin" aria-labelledby="dashboard-actions-title">
        <header className="supervisor-dashboard__section-heading"><div><AlertCircle size={18} /><h2 id="dashboard-actions-title">Action required <small>{formatRange(range, mode)}</small></h2></div><Link to="/supervisor/department-plans">Review workspace <ArrowRight size={15} /></Link></header>
        <div className="supervisor-dashboard__actions">
          {actions.map((action) => <button type="button" className={`supervisor-dashboard__action is-${action.id}`} key={action.id} onClick={() => showTeam(action.id)}><span className="supervisor-dashboard__action-icon">{createElement(action.icon, { size: 18, 'aria-hidden': true })}</span><span><strong>{action.label}</strong><small>{action.count} {action.unit}</small></span><ArrowRight size={15} /></button>)}
          {returnedDepartmentPlans.length > 0 && <Link className="supervisor-dashboard__action is-returned" to={`/supervisor/department-plans/${encodeURIComponent(returnedDepartmentPlans[0].planId)}`}><span className="supervisor-dashboard__action-icon"><RotateCcw size={18} /></span><span><strong>Department revisions</strong><small>{returnedDepartmentPlans.length} plans</small></span><ArrowRight size={15} /></Link>}
          {!actions.length && !returnedDepartmentPlans.length && <div className="supervisor-dashboard__clear"><Check size={18} />No outstanding submission actions for this period.</div>}
        </div>
      </section>

      <section className="supervisor-dashboard__analytics" aria-labelledby="dashboard-chart-title">
        <header className="supervisor-dashboard__section-heading"><div><BarChart3 size={18} /><h2 id="dashboard-chart-title">Overtime activity <small>{mode === 'week' ? 'Daily hours / week' : 'Daily hours / month'}</small></h2></div><div className="supervisor-dashboard__chart-types" role="group" aria-label="Chart type">{CHART_TYPES.map((option) => <button aria-label={option.label} aria-pressed={chartType === option.id} title={option.label} key={option.id} onClick={() => setChartType(option.id)} type="button">{createElement(option.icon, { size: 17, 'aria-hidden': true })}</button>)}</div></header>
        <div className="supervisor-dashboard__chart-toolbar"><span className="supervisor-dashboard__peak"><TrendingUp size={15} />Peak submitted <strong>{peak ? `${peak.fullLabel} / ${hours(peak.planned)}h` : 'No scheduled hours'}</strong></span><div className="supervisor-dashboard__legend">{SERIES.map((series) => <label key={series.id}><input type="checkbox" aria-label={`Show ${series.label.toLowerCase()} hours`} checked={visibleSeries.includes(series.id)} disabled={visibleSeries.length === 1 && visibleSeries.includes(series.id)} onChange={() => setVisibleSeries((current) => current.includes(series.id) ? current.filter((id) => id !== series.id) : [...current, series.id])} /><i className={`is-${series.id}`} />{series.label}</label>)}</div></div>
        {actualError && <div className="supervisor-dashboard__inline-error" role="alert"><AlertCircle size={16} /><span>Actual overtime is unavailable. Submitted and accepted hours are still shown.</span><button type="button" onClick={dashboard.refresh}>Retry</button></div>}
        {actualLoading && <div className="supervisor-dashboard__section-loading" role="status">Loading actual overtime...</div>}
        <div className="supervisor-dashboard__chart"><SupervisorDashboardChart data={chartData} mode={mode} today={today} type={chartType} visibleSeries={visibleSeries} /></div>
      </section>

      <div className="supervisor-dashboard__lower">
        <Workload rows={dashboard.workload} ready={actualReady} />
        <SupervisorDashboardWorkflow plan={dashboard.activePlan} count={preparation.activeDepartmentPlans.length} index={dashboard.selectedIndex} selectPlan={dashboard.selectPlan} query={dashboard.approvalQuery} listQuery={dashboard.workflowsQuery} />
      </div>

      <section className="supervisor-dashboard__actual" aria-labelledby="dashboard-actual-title">
        <header className="supervisor-dashboard__section-heading"><div><Clock3 size={18} /><h2 id="dashboard-actual-title">Actual OT ledger <small>{formatRange(range, mode)}</small></h2></div><Link to="/supervisor/actual-overtime">Open actual overtime <ArrowRight size={15} /></Link></header>
        <dl><div><dt>Planned in actual records</dt><dd>{actualReady ? `${hours(actual.plannedHours)}h` : '--'}</dd></div><div><dt>Recorded actual</dt><dd>{actualReady ? `${hours(actual.actualHours)}h` : '--'}</dd></div><div><dt>Variance excluding pending</dt><dd className={actualReady && actual.varianceHours > 0 ? 'is-over' : ''}>{actualReady ? `${actual.varianceHours > 0 ? '+' : ''}${hours(actual.varianceHours)}h` : '--'}</dd></div><div><dt>Open / finalized periods</dt><dd>{actualReady ? `${actualPeriods.filter((period) => period.status === 'open').length} / ${actualPeriods.filter((period) => period.status === 'finalized').length}` : '--'}</dd></div></dl>
      </section>
      <SupervisorDashboardTeam key={`${mode}-${range.dateFrom}`} employees={preparation.employees} filter={teamFilter} onFilterChange={setTeamFilter} />
    </main>
  )
}
