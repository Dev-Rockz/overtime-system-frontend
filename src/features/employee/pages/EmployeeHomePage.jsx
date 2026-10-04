import { createElement, lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Bell,
  BellRing,
  CalendarDays,
  CalendarPlus,
  CalendarX2,
  ChartArea,
  ChartBarBig,
  ChartLine,
  ChartNoAxesCombined,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheckBig,
  Clock3,
  FilePenLine,
  FileClock,
  Gauge,
  RefreshCw,
  RotateCcw,
  Workflow,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { actualOvertimeApi } from '../../../api/actualOvertimeApi.js'
import { notificationApi } from '../../../api/notificationApi.js'
import { overtimePlanApi } from '../../../api/overtimePlanApi.js'
import { useAuth } from '../../auth/useAuth.js'
import { useDashboardEntrance } from '../../auth/useDashboardEntrance.js'
import './employeeDashboard.css'

const NOTIFICATIONS_QUERY_KEY = ['employee', 'notifications']
const MONTHLY_OT_LIMIT = 32
const FINAL_PLAN_STATUSES = new Set(['approved', 'closed'])
const WORKFLOW_STEPS = ['Created', 'Submitted', 'Supervisor', 'Management', 'Final approval']
const WORKFLOW_STATUS_LABELS = {
  draft: 'Draft',
  submitted: 'Submitted',
  submitted_to_supervisor: 'Supervisor review',
  supervisor_returned: 'Returned by supervisor',
  supervisor_accepted: 'Supervisor accepted',
  pending_approval: 'Approval in progress',
  returned_for_revision: 'Returned for revision',
  rejected: 'Rejected',
}
const DashboardAnalyticsChart = lazy(() => import('../components/DashboardAnalyticsChart.jsx'))
const CHART_TYPES = [
  { value: 'bar', label: 'Bar chart', icon: ChartBarBig },
  { value: 'line', label: 'Line chart', icon: ChartLine },
  { value: 'area', label: 'Area chart', icon: ChartArea },
]
const CLOCK_FORMATTER = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  hour12: true,
  minute: '2-digit',
  second: '2-digit',
})
const TODAY_FORMATTER = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'long',
  weekday: 'long',
  year: 'numeric',
})

function getClockParts(date) {
  const parts = Object.fromEntries(
    CLOCK_FORMATTER.formatToParts(date).map((part) => [part.type, part.value]),
  )

  return parts
}

function startOfWeek(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = start.getDay()
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1))
  return start
}

function addDays(date, numberOfDays) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + numberOfDays)
  return nextDate
}

function toDateValue(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDate(value) {
  return new Date(`${value}T00:00:00`)
}

function formatDate(value, options = {}) {
  if (!value) return ''

  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    weekday: options.weekday ? 'short' : undefined,
    year: options.year ? 'numeric' : undefined,
  }).format(parseDate(value))
}

function formatRange(start, end, periodMode) {
  if (periodMode === 'month') {
    return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(parseDate(start))
  }

  const startDate = parseDate(start)
  const endDate = parseDate(end)
  const sameMonth = startDate.getMonth() === endDate.getMonth()

  if (sameMonth) {
    return `${new Intl.DateTimeFormat('en', { month: 'short' }).format(startDate)} ${startDate.getDate()}-${endDate.getDate()}, ${endDate.getFullYear()}`
  }

  return `${formatDate(start)} - ${formatDate(end, { year: true })}`
}

function getDateRange(periodMode, anchorDate) {
  const selectedDate = parseDate(anchorDate)

  if (periodMode === 'month') {
    return {
      dateFrom: toDateValue(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)),
      dateTo: toDateValue(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0)),
    }
  }

  const dateFrom = startOfWeek(selectedDate)
  return {
    dateFrom: toDateValue(dateFrom),
    dateTo: toDateValue(addDays(dateFrom, 6)),
  }
}

function getDatesInRange(dateFrom, dateTo) {
  const dates = []

  for (let date = parseDate(dateFrom); date <= parseDate(dateTo); date = addDays(date, 1)) {
    dates.push(toDateValue(date))
  }

  return dates
}

function formatHours(value) {
  return new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(Number(value) || 0)
}

function formatNotificationTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(date)
}

function getWorkflowState(plan) {
  const status = plan?.status || 'draft'
  const approverRole = plan?.currentApproverRole || ''

  if (status === 'submitted') {
    return { completedThrough: 1, currentStep: 2, tone: 'progress' }
  }

  if (status === 'submitted_to_supervisor') {
    return { completedThrough: 2, currentStep: 3, tone: 'progress' }
  }

  if (status === 'supervisor_returned') {
    return { completedThrough: 2, currentStep: 3, tone: 'returned' }
  }

  if (status === 'supervisor_accepted') {
    return { completedThrough: 3, currentStep: 4, tone: 'progress' }
  }

  if (status === 'pending_approval') {
    const isFinalApproval = ['admin', 'hr', 'hr_admin'].includes(approverRole)
    return {
      completedThrough: isFinalApproval ? 4 : 3,
      currentStep: isFinalApproval ? 5 : 4,
      tone: 'progress',
    }
  }

  if (status === 'returned_for_revision') {
    return { completedThrough: 3, currentStep: 4, tone: 'returned' }
  }

  if (status === 'rejected') {
    return { completedThrough: 4, currentStep: 5, tone: 'rejected' }
  }

  return { completedThrough: 0, currentStep: 1, tone: 'progress' }
}

function DashboardSkeleton() {
  return (
    <div className="dashboard-skeleton" aria-label="Loading dashboard">
      <section className="dashboard-skeleton__bulletin"><header /><span /><span /></section>
      <div className="dashboard-skeleton__summary">
        <section><header /><span /><span /></section>
        <section><header /><span /><span /><span /></section>
      </div>
      <section className="dashboard-skeleton__workflow">
        <header />
        <div>{Array.from({ length: 5 }, (_, index) => <i key={index} />)}</div>
      </section>
      <div className="dashboard-skeleton__grid">
        <section className="dashboard-skeleton__chart"><header /><div /></section>
      </div>
      <div className="dashboard-skeleton__grid dashboard-skeleton__grid--lower">
        <section><header /><span /><span /><span /></section>
        <section><header /><span /><span /><span /></section>
      </div>
    </div>
  )
}

function EmptyPanel({ icon, message }) {
  return (
    <div className="dashboard-empty">
      {createElement(icon, { size: 23, 'aria-hidden': true })}
      <span>{message}</span>
    </div>
  )
}

export function EmployeeHomePage() {
  const [periodMode, setPeriodMode] = useState('week')
  const [chartType, setChartType] = useState('bar')
  const [anchorDate, setAnchorDate] = useState(() => toDateValue(new Date()))
  const [currentDateTime, setCurrentDateTime] = useState(() => new Date())
  const [workflowPage, setWorkflowPage] = useState(0)
  const { user } = useAuth()
  const clockParts = getClockParts(currentDateTime)

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentDateTime(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const selectedRange = useMemo(
    () => getDateRange(periodMode, anchorDate),
    [anchorDate, periodMode],
  )
  const monthlyRange = useMemo(() => getDateRange('month', anchorDate), [anchorDate])
  const currentWeekRange = useMemo(
    () => getDateRange('week', toDateValue(new Date())),
    [],
  )

  const planItemsQuery = useQuery({
    queryKey: ['employee', 'dashboard', 'plan-items', selectedRange.dateFrom, selectedRange.dateTo],
    queryFn: () => overtimePlanApi.listMyPlanItems({
      dateFrom: selectedRange.dateFrom,
      dateTo: selectedRange.dateTo,
      limit: 100,
    }),
  })
  const plansQuery = useQuery({
    queryKey: ['employee', 'dashboard', 'workflow-plans'],
    queryFn: () => overtimePlanApi.listMyPlans({ limit: 50 }),
  })
  const actualPeriodsQuery = useQuery({
    queryKey: ['employee', 'dashboard', 'actual-periods', selectedRange.dateFrom, selectedRange.dateTo],
    queryFn: () => actualOvertimeApi.listMyPeriods({
      dateFrom: selectedRange.dateFrom,
      dateTo: selectedRange.dateTo,
    }),
  })
  const monthlyPeriodsQuery = useQuery({
    enabled: periodMode === 'week',
    queryKey: ['employee', 'dashboard', 'monthly-limit-periods', monthlyRange.dateFrom, monthlyRange.dateTo],
    queryFn: () => actualOvertimeApi.listMyPeriods({
      dateFrom: monthlyRange.dateFrom,
      dateTo: monthlyRange.dateTo,
    }),
  })
  const notificationsQuery = useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: () => notificationApi.list({ limit: 20, offset: 0 }),
  })
  const visibleActualPeriods = useMemo(() => (
    (actualPeriodsQuery.data || []).filter((period) => (
      period.periodEndDate >= selectedRange.dateFrom
        && period.periodStartDate <= selectedRange.dateTo
    ))
  ), [actualPeriodsQuery.data, selectedRange.dateFrom, selectedRange.dateTo])
  const actualPeriodQueries = useQueries({
    queries: visibleActualPeriods.map((period) => ({
      queryKey: ['employee', 'actual-overtime', 'period', period.actualPeriodId],
      queryFn: () => actualOvertimeApi.getPeriod(period.actualPeriodId),
    })),
  })
  const selectedActualPeriodIds = new Set(
    visibleActualPeriods.map((period) => period.actualPeriodId),
  )
  const additionalMonthlyPeriods = periodMode === 'week'
    ? (monthlyPeriodsQuery.data || []).filter((period) => (
        period.periodEndDate >= monthlyRange.dateFrom
          && period.periodStartDate <= monthlyRange.dateTo
          && !selectedActualPeriodIds.has(period.actualPeriodId)
      ))
    : []
  const additionalMonthlyPeriodQueries = useQueries({
    queries: additionalMonthlyPeriods.map((period) => ({
      queryKey: ['employee', 'actual-overtime', 'period', period.actualPeriodId],
      queryFn: () => actualOvertimeApi.getPeriod(period.actualPeriodId),
    })),
  })
  const planItems = planItemsQuery.data || []
  const actualEntries = actualPeriodQueries.flatMap((query) => (
    (query.data?.entries || []).map((entry) => ({
      ...entry,
      periodStatus: entry.periodStatus || query.data?.status || '',
    }))
  ))
  const additionalMonthlyEntries = additionalMonthlyPeriodQueries.flatMap(
    (query) => query.data?.entries || [],
  )
  const notifications = notificationsQuery.data?.notifications || []
  const todayValue = toDateValue(new Date())
  const workflowPlans = useMemo(() => (
    (plansQuery.data || [])
      .filter((plan) => !FINAL_PLAN_STATUSES.has(plan.status))
      .sort((left, right) => (
        String(right.updatedAt || right.createdAt || '').localeCompare(
          String(left.updatedAt || left.createdAt || ''),
        )
      ))
  ), [plansQuery.data])
  const visibleWorkflowPage = Math.min(workflowPage, Math.max(0, workflowPlans.length - 1))
  const workflowPlan = workflowPlans[visibleWorkflowPage] || null
  const workflowState = getWorkflowState(workflowPlan)
  const currentWeekPlans = (plansQuery.data || []).filter((plan) => (
    plan.periodEndDate >= currentWeekRange.dateFrom
      && plan.periodStartDate <= currentWeekRange.dateTo
  ))
  const returnedPlans = (plansQuery.data || []).filter((plan) => (
    ['supervisor_returned', 'returned_for_revision'].includes(plan.status)
  ))
  const draftPlans = (plansQuery.data || []).filter((plan) => plan.status === 'draft')
  const currentWeekDrafts = currentWeekPlans.filter((plan) => plan.status === 'draft')
  const hasCurrentWeekSubmission = currentWeekPlans.some((plan) => plan.status !== 'draft')
  const actionItems = [
    returnedPlans.length ? {
      category: 'Revision',
      id: 'returned',
      icon: RotateCcw,
      tone: 'warning',
      title: `${returnedPlans.length} returned ${returnedPlans.length === 1 ? 'plan needs' : 'plans need'} revision`,
      detail: 'Update the requested changes before resubmitting.',
      to: `/employee/plans/${encodeURIComponent(returnedPlans[0].planId)}/edit`,
    } : null,
    draftPlans.length ? {
      category: 'Draft',
      id: 'drafts',
      icon: FilePenLine,
      tone: 'draft',
      title: `${draftPlans.length} draft ${draftPlans.length === 1 ? 'plan is' : 'plans are'} not submitted`,
      detail: 'Complete and submit the plan for review.',
      to: `/employee/plans/${encodeURIComponent(draftPlans[0].planId)}/edit`,
    } : null,
    !hasCurrentWeekSubmission && currentWeekDrafts.length === 0 ? {
      category: 'Weekly plan',
      id: 'missing-plan',
      icon: CalendarX2,
      tone: 'missing',
      title: 'No OT plan submitted for the current week',
      detail: formatRange(currentWeekRange.dateFrom, currentWeekRange.dateTo, 'week'),
      to: '/employee/plans/new',
    } : null,
  ].filter(Boolean)
  const chartData = getDatesInRange(selectedRange.dateFrom, selectedRange.dateTo).map((date) => {
    const dayPlanItems = planItems.filter((item) => item.plannedDate === date)
    const dayActualEntries = actualEntries.filter((entry) => entry.actualDate === date)
    const itemPlannedHours = dayPlanItems.reduce(
      (sum, item) => sum + (Number(item.plannedHours) || 0),
      0,
    )
    const actualPlannedHours = dayActualEntries.reduce(
      (sum, entry) => sum + (Number(entry.plannedHours) || 0),
      0,
    )

    return {
      actual: dayActualEntries.reduce((sum, entry) => sum + (Number(entry.actualHours) || 0), 0),
      date,
      fullLabel: formatDate(date, { weekday: true, year: true }),
      planned: dayActualEntries.length ? actualPlannedHours : itemPlannedHours,
      tick: periodMode === 'month'
        ? String(parseDate(date).getDate())
        : new Intl.DateTimeFormat('en', { weekday: 'short' }).format(parseDate(date)),
      variance: dayActualEntries.reduce((sum, entry) => (
        sum + (entry.isPending ? 0 : (Number(entry.varianceHours) || 0))
      ), 0),
    }
  })
  const plannedHours = chartData.reduce((sum, day) => sum + day.planned, 0)
  const actualHours = chartData.reduce((sum, day) => sum + day.actual, 0)
  const varianceHours = chartData.reduce((sum, day) => sum + day.variance, 0)
  const monthlyActualEntries = (periodMode === 'month'
    ? actualEntries
    : [...actualEntries, ...additionalMonthlyEntries]
  ).filter((entry) => (
    entry.actualDate >= monthlyRange.dateFrom && entry.actualDate <= monthlyRange.dateTo
  ))
  const monthlyActualHours = monthlyActualEntries.reduce(
    (sum, entry) => sum + (Number(entry.actualHours) || 0),
    0,
  )
  const monthlyLimitRatio = monthlyActualHours / MONTHLY_OT_LIMIT
  const monthlyLimitTone = monthlyLimitRatio >= 1
    ? 'red'
    : monthlyLimitRatio >= 0.75
      ? 'orange'
      : 'green'
  const monthlyLimitLabel = monthlyLimitTone === 'red'
    ? 'Limit reached'
    : monthlyLimitTone === 'orange'
      ? 'Approaching limit'
      : 'Within limit'
  const monthlyHoursDifference = Math.abs(MONTHLY_OT_LIMIT - monthlyActualHours)
  const todayTick = chartData.find((point) => point.date === todayValue)?.tick || ''
  const rangeLabel = formatRange(selectedRange.dateFrom, selectedRange.dateTo, periodMode)
  const isLoading = planItemsQuery.isLoading
    || plansQuery.isLoading
    || actualPeriodsQuery.isLoading
    || monthlyPeriodsQuery.isLoading
    || notificationsQuery.isLoading
    || actualPeriodQueries.some((query) => query.isLoading)
    || additionalMonthlyPeriodQueries.some((query) => query.isLoading)
  const entranceClass = useDashboardEntrance(!isLoading)
  const hasError = planItemsQuery.isError
    || plansQuery.isError
    || actualPeriodsQuery.isError
    || monthlyPeriodsQuery.isError
    || notificationsQuery.isError
    || actualPeriodQueries.some((query) => query.isError)
    || additionalMonthlyPeriodQueries.some((query) => query.isError)
  const isRefreshing = planItemsQuery.isFetching
    || plansQuery.isFetching
    || actualPeriodsQuery.isFetching
    || monthlyPeriodsQuery.isFetching
    || notificationsQuery.isFetching
    || actualPeriodQueries.some((query) => query.isFetching)
    || additionalMonthlyPeriodQueries.some((query) => query.isFetching)

  function refreshDashboard() {
    planItemsQuery.refetch()
    plansQuery.refetch()
    actualPeriodsQuery.refetch()
    if (periodMode === 'week') monthlyPeriodsQuery.refetch()
    notificationsQuery.refetch()
    actualPeriodQueries.forEach((query) => query.refetch())
    additionalMonthlyPeriodQueries.forEach((query) => query.refetch())
  }

  function moveSelectedPeriod(direction) {
    const selectedDate = parseDate(anchorDate)

    if (periodMode === 'month') {
      setAnchorDate(toDateValue(new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth() + direction,
        1,
      )))
      return
    }

    setAnchorDate(toDateValue(addDays(selectedDate, direction * 7)))
  }

  return (
    <main className={`employee-main employee-dashboard${entranceClass}`}>
      <header className="dashboard-heading">
        <div className="dashboard-heading__welcome">
          <p>{rangeLabel}</p>
          <h1>Welcome, {user.firstName || user.name}.</h1>
        </div>
        <div className="dashboard-heading__actions">
          <Link className="dashboard-action dashboard-action--primary" to="/employee/plans/new">
            <CalendarPlus size={16} aria-hidden="true" />
            Create plan
          </Link>
          <Link className="dashboard-action" to="/employee/actual-overtime">
            <FileClock size={16} aria-hidden="true" />
            Actual OT
          </Link>
          <button
            aria-label="Refresh dashboard"
            className="dashboard-refresh"
            disabled={isRefreshing}
            onClick={refreshDashboard}
            title="Refresh dashboard"
            type="button"
          >
            <RefreshCw className={isRefreshing ? 'dashboard-spin' : ''} size={17} aria-hidden="true" />
          </button>
        </div>
      </header>

      <section className="dashboard-live-clock" aria-label="Current date and time">
        <div className="dashboard-live-clock__main">
          <div className="dashboard-live-clock__label"><i />Local time</div>
          <time
            aria-label="Current time"
            dateTime={currentDateTime.toISOString()}
            role="timer"
          >
            <span>{clockParts.hour}:{clockParts.minute}</span>
            <span className="dashboard-live-clock__seconds">:{clockParts.second}</span>
            <em>{clockParts.dayPeriod}</em>
          </time>
        </div>
        <p><span>Today is</span><strong>{TODAY_FORMATTER.format(currentDateTime)}</strong></p>
      </section>

      {hasError ? (
        <div className="dashboard-alert" role="alert">
          <AlertCircle size={17} aria-hidden="true" />
          <span>Some dashboard data could not be loaded.</span>
          <button onClick={refreshDashboard} type="button">Retry</button>
        </div>
      ) : null}

      {isLoading ? <DashboardSkeleton /> : (
        <>
          <section className="dashboard-action-board" aria-label="Action required bulletin">
            <header className="dashboard-action-board__rail">
              <span className="dashboard-action-board__bell"><BellRing size={18} aria-hidden="true" /></span>
              <div>
                <small>Priority board</small>
                <h2>Action required</h2>
              </div>
              <span className={actionItems.length ? 'has-actions' : 'is-clear'}>
                {actionItems.length ? `${actionItems.length} ${actionItems.length === 1 ? 'action' : 'actions'}` : 'Up to date'}
              </span>
            </header>

            <div className="dashboard-action-board__content">
              {actionItems.length ? (
                <ol>
                  {actionItems.map((item, index) => (
                    <li className={`is-${item.tone}`} key={item.id}>
                      <span className="dashboard-action-board__index">{String(index + 1).padStart(2, '0')}</span>
                      <span className="dashboard-action-board__category">
                        {createElement(item.icon, { size: 14, 'aria-hidden': true })}
                        {item.category}
                      </span>
                      <div className="dashboard-action-board__copy">
                        <strong>{item.title}</strong>
                        <span>{item.detail}</span>
                      </div>
                      <Link aria-label={`${item.title}. Open`} to={item.to} title="Open action">
                        <ArrowRight size={16} />
                      </Link>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="dashboard-action-board__clear">
                  <CircleCheckBig size={22} aria-hidden="true" />
                  <div><strong>All caught up</strong><span>No action is required right now.</span></div>
                </div>
              )}
            </div>
          </section>

          {workflowPlan ? (
            <section
              className={`dashboard-workflow-strip dashboard-workflow-strip--${workflowState.tone}`}
              key={workflowPlan.planId}
              aria-label="Overtime plan workflow"
            >
              <header>
                <div className="dashboard-workflow-strip__title">
                  <span><Workflow size={18} aria-hidden="true" /></span>
                  <div>
                    <small>OT plan workflow</small>
                    <strong>{formatRange(workflowPlan.periodStartDate, workflowPlan.periodEndDate, workflowPlan.periodType === 'monthly' ? 'month' : 'week')}</strong>
                  </div>
                </div>
                <div className="dashboard-workflow-strip__meta">
                  <span className={`dashboard-workflow-strip__status is-${workflowState.tone}`}>
                    {WORKFLOW_STATUS_LABELS[workflowPlan.status] || workflowPlan.status?.replaceAll('_', ' ')}
                  </span>
                  <strong>{formatHours(workflowPlan.plannedHours)}h</strong>
                  <Link to={`/employee/plans/${encodeURIComponent(workflowPlan.planId)}`}>View plan <ArrowRight size={14} /></Link>
                </div>
                {workflowPlans.length > 1 ? (
                  <div className="dashboard-workflow-strip__pager">
                    <button
                      aria-label="Previous workflow"
                      disabled={visibleWorkflowPage === 0}
                      onClick={() => setWorkflowPage((page) => Math.max(0, page - 1))}
                      type="button"
                    >
                      <ChevronLeft size={15} />
                    </button>
                    <span>{visibleWorkflowPage + 1} / {workflowPlans.length}</span>
                    <button
                      aria-label="Next workflow"
                      disabled={visibleWorkflowPage === workflowPlans.length - 1}
                      onClick={() => setWorkflowPage((page) => Math.min(workflowPlans.length - 1, page + 1))}
                      type="button"
                    >
                      <ChevronRight size={15} />
                    </button>
                  </div>
                ) : null}
              </header>

              <ol className="dashboard-workflow-strip__steps">
                {WORKFLOW_STEPS.map((label, index) => {
                  const stepNumber = index + 1
                  const isComplete = stepNumber <= workflowState.completedThrough
                  const isCurrent = stepNumber === workflowState.currentStep
                  const stepClassName = [
                    isComplete ? 'is-complete' : '',
                    isCurrent ? 'is-current' : '',
                  ].filter(Boolean).join(' ')

                  return (
                    <li
                      className={stepClassName}
                      key={label}
                      style={{ '--workflow-delay': `${index * 130}ms` }}
                    >
                      <i>{isComplete ? <Check size={13} /> : stepNumber}</i>
                      <span>{label}</span>
                    </li>
                  )
                })}
              </ol>
            </section>
          ) : null}

          <div className="dashboard-summary-row">
            <section className={`dashboard-limit dashboard-limit--${monthlyLimitTone}`} aria-label="Monthly overtime limit">
              <header>
                <span className="dashboard-limit__icon"><Gauge size={18} aria-hidden="true" /></span>
                <div>
                  <small>Monthly OT limit</small>
                  <strong>{formatRange(monthlyRange.dateFrom, monthlyRange.dateTo, 'month')}</strong>
                </div>
                <b>{formatHours(monthlyActualHours)}h <em>/ {MONTHLY_OT_LIMIT}h</em></b>
              </header>
              <div
                aria-label={`${formatHours(monthlyActualHours)} of ${MONTHLY_OT_LIMIT} monthly overtime hours used`}
                className="dashboard-limit__track"
                role="progressbar"
                aria-valuemax={MONTHLY_OT_LIMIT}
                aria-valuemin="0"
                aria-valuenow={Math.min(monthlyActualHours, MONTHLY_OT_LIMIT)}
              >
                <span style={{ '--limit-progress': `${Math.min(monthlyLimitRatio * 100, 100)}%` }} />
              </div>
              <footer>
                <span><i />{monthlyLimitLabel}</span>
                <strong>
                  {formatHours(monthlyHoursDifference)}h {monthlyActualHours > MONTHLY_OT_LIMIT ? 'over' : 'remaining'}
                </strong>
              </footer>
            </section>

            <section className="dashboard-period-details" aria-label={`${periodMode === 'week' ? 'Current week' : 'Current month'} details`}>
              <header>
                <div><small>Selected period</small><strong>{rangeLabel}</strong></div>
              </header>
              <ul>
                <li><span className="is-planned"><CalendarDays size={14} />Planned</span><strong>{formatHours(plannedHours)}h</strong></li>
                <li><span className="is-actual"><Clock3 size={14} />Actual</span><strong>{formatHours(actualHours)}h</strong></li>
                <li><span className="is-variance"><Activity size={14} />Variance</span><strong>{varianceHours > 0 ? '+' : ''}{formatHours(varianceHours)}h</strong></li>
              </ul>
            </section>
          </div>

          <section className="dashboard-panel dashboard-chart-panel">
            <header className="dashboard-chart-header">
              <div className="dashboard-chart-brand">
                <span className="dashboard-chart-brand__icon"><ChartNoAxesCombined size={21} /></span>
                <div>
                  <span className="dashboard-panel__eyebrow">Overtime analytics</span>
                  <h2>Planned vs actual</h2>
                  <p>{rangeLabel}</p>
                </div>
              </div>

              <div className="dashboard-chart-controls">
                <div className="dashboard-segment" aria-label="Analytics period">
                  {['week', 'month'].map((value) => (
                    <button
                      aria-pressed={periodMode === value}
                      className={periodMode === value ? 'is-active' : ''}
                      key={value}
                      onClick={() => setPeriodMode(value)}
                      type="button"
                    >
                      {value === 'week' ? 'Week' : 'Month'}
                    </button>
                  ))}
                </div>
                <div className="dashboard-range-navigation">
                  <button
                    aria-label={`Previous ${periodMode}`}
                    onClick={() => moveSelectedPeriod(-1)}
                    title={`Previous ${periodMode}`}
                    type="button"
                  >
                    <ChevronLeft size={16} aria-hidden="true" />
                  </button>
                  <input
                    aria-label="Select dashboard date"
                    onChange={(event) => {
                      if (event.target.value) setAnchorDate(event.target.value)
                    }}
                    type="date"
                    value={anchorDate}
                  />
                  <button
                    aria-label={`Next ${periodMode}`}
                    onClick={() => moveSelectedPeriod(1)}
                    title={`Next ${periodMode}`}
                    type="button"
                  >
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                </div>
                <div className="dashboard-chart-types" aria-label="Chart type">
                  {CHART_TYPES.map(({ value, label, icon }) => (
                    <button
                      aria-label={label}
                      aria-pressed={chartType === value}
                      className={chartType === value ? 'is-active' : ''}
                      key={value}
                      onClick={() => setChartType(value)}
                      title={label}
                      type="button"
                    >
                      {createElement(icon, { size: 16, 'aria-hidden': true })}
                    </button>
                  ))}
                </div>
              </div>
            </header>

            <div className="dashboard-chart-legend" aria-label="Chart legend">
              <span><i className="is-planned" />Planned</span>
              <span><i className="is-actual" />Actual</span>
            </div>
            <div className="dashboard-chart-canvas" key={`${selectedRange.dateFrom}-${chartType}`}>
              <Suspense fallback={<div className="dashboard-chart-loading" aria-label="Loading chart" />}>
                <DashboardAnalyticsChart
                  chartData={chartData}
                  chartType={chartType}
                  periodMode={periodMode}
                  todayTick={todayTick}
                />
              </Suspense>
            </div>
          </section>

          <div className="dashboard-secondary-grid">
            <section className="dashboard-panel dashboard-schedule">
              <header className="dashboard-panel__header">
                <div>
                  <span className="dashboard-panel__eyebrow">Schedule</span>
                  <h2>{periodMode === 'week' ? "This week's overtime" : "This month's overtime"}</h2>
                </div>
                <Link aria-label="View all overtime plans" to="/employee/plans">View all <ArrowRight size={14} /></Link>
              </header>

              {planItems.length ? (
                <div className="dashboard-schedule__list">
                  {planItems.slice(0, 5).map((item) => (
                    <Link key={item.planItemId} to={`/employee/plans/${encodeURIComponent(item.planId)}`}>
                      <time dateTime={item.plannedDate}>
                        <span>{new Intl.DateTimeFormat('en', { weekday: 'short' }).format(parseDate(item.plannedDate))}</span>
                        <strong>{parseDate(item.plannedDate).getDate()}</strong>
                      </time>
                      <div>
                        <strong>{item.reason || 'Planned overtime'}</strong>
                        <span>{formatDate(item.plannedDate)} | {formatHours(item.plannedHours)} hours</span>
                      </div>
                      <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyPanel icon={CalendarDays} message={`No overtime is planned for this ${periodMode}.`} />
              )}
            </section>

            <section className="dashboard-panel dashboard-activity">
              <header className="dashboard-panel__header">
                <div>
                  <span className="dashboard-panel__eyebrow">Updates</span>
                  <h2>Recent activity</h2>
                </div>
                <Link aria-label="View all notifications" to="/employee/notifications">View all <ArrowRight size={14} /></Link>
              </header>

              {notifications.length ? (
                <div className="dashboard-activity__list">
                  {notifications.slice(0, 4).map((notification) => (
                    <div className={notification.readAt ? '' : 'is-unread'} key={notification.notificationId}>
                      <span className="dashboard-activity__icon">
                        {notification.type?.includes('return') ? <RotateCcw size={16} /> : <Bell size={16} />}
                      </span>
                      <div>
                        <strong>{notification.title}</strong>
                        <span>{notification.message}</span>
                        <time>{formatNotificationTime(notification.createdAt)}</time>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyPanel icon={Bell} message="No recent activity." />
              )}
            </section>
          </div>
        </>
      )}
    </main>
  )
}
