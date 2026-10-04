import { useMemo, useState } from 'react'
import { useIsFetching, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  CircleDot,
  CircleX,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  FilePenLine,
  ListFilter,
  LockKeyhole,
  RefreshCw,
  RotateCcw,
  Send,
  SendHorizontal,
  UserCheck,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { overtimePlanApi } from '../../../api/overtimePlanApi.js'
import { OvertimePlanCalendar } from '../components/OvertimePlanCalendar.jsx'
import './employeePlans.css'

const PAGE_SIZE = 10
const today = new Date()
const currentYear = today.getFullYear()
const yearOptions = Array.from({ length: 101 }, (_, index) => 2100 - index)

const statusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'submitted_to_supervisor', label: 'Submitted to supervisor' },
  { value: 'supervisor_returned', label: 'Returned by supervisor' },
  { value: 'supervisor_accepted', label: 'Supervisor accepted' },
  { value: 'pending_approval', label: 'Pending approval' },
  { value: 'returned_for_revision', label: 'Returned for revision' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'closed', label: 'Closed' },
]

const statusLabels = Object.fromEntries(
  statusOptions.filter((option) => option.value).map((option) => [option.value, option.label]),
)

const statusIcons = {
  draft: FilePenLine,
  submitted: Send,
  submitted_to_supervisor: SendHorizontal,
  supervisor_returned: RotateCcw,
  supervisor_accepted: UserCheck,
  pending_approval: Clock3,
  returned_for_revision: RotateCcw,
  approved: BadgeCheck,
  rejected: CircleX,
  closed: LockKeyhole,
}

function formatDate(value) {
  if (!value) return 'Not provided'

  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function toDateValue(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toMonthValue(date) {
  return toDateValue(date).slice(0, 7)
}

function toWeekValue(date) {
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = target.getDay() || 7
  target.setDate(target.getDate() + 4 - day)
  const weekYear = target.getFullYear()
  const yearStart = new Date(weekYear, 0, 1)
  const weekNumber = Math.ceil((((target - yearStart) / 86400000) + 1) / 7)
  return `${weekYear}-W${String(weekNumber).padStart(2, '0')}`
}

function fromMonthValue(value) {
  const [year, month] = value.split('-').map(Number)
  return new Date(year, month - 1, 1)
}

function startOfWeek(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = start.getDay()
  const distanceFromMonday = day === 0 ? 6 : day - 1
  start.setDate(start.getDate() - distanceFromMonday)
  return start
}

function fromWeekValue(value) {
  const [yearText, weekText] = value.split('-W')
  const januaryFourth = new Date(Number(yearText), 0, 4)
  const firstMonday = startOfWeek(januaryFourth)
  firstMonday.setDate(firstMonday.getDate() + ((Number(weekText) - 1) * 7))
  return firstMonday
}

function getDateRange(periodType, anchorDate) {
  if (periodType === 'weekly') {
    const dateFrom = startOfWeek(anchorDate)
    const dateTo = new Date(dateFrom)
    dateTo.setDate(dateTo.getDate() + 6)
    return { dateFrom: toDateValue(dateFrom), dateTo: toDateValue(dateTo) }
  }

  if (periodType === 'monthly') {
    const dateFrom = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1)
    const dateTo = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0)
    return { dateFrom: toDateValue(dateFrom), dateTo: toDateValue(dateTo) }
  }

  return null
}

function moveDateToYear(date, year) {
  const day = date.getDate()
  const month = date.getMonth()
  const lastDay = new Date(year, month + 1, 0).getDate()
  return new Date(year, month, Math.min(day, lastDay))
}

function formatDateTime(value) {
  if (!value) return 'Not provided'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function formatHours(value) {
  return new Intl.NumberFormat('en', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(Number(value) || 0)
}

function formatLabel(value) {
  if (!value) return 'Not provided'
  return value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}

function getStatusLabel(status) {
  return statusLabels[status] || formatLabel(status)
}

function PlanStatus({ status }) {
  const StatusIcon = statusIcons[status] || CircleDot

  return (
    <span className={`plan-status plan-status--${status}`}>
      <StatusIcon size={13} strokeWidth={2.2} aria-hidden="true" />
      {getStatusLabel(status)}
    </span>
  )
}

function PlanPeriod({ plan }) {
  return (
    <div className="plan-period">
      <strong>{formatDate(plan.periodStartDate)}</strong>
      <span>to {formatDate(plan.periodEndDate)}</span>
    </div>
  )
}

function PlansSkeleton() {
  return (
    <div className="plans-table-shell plans-skeleton" aria-hidden="true">
      <div className="plans-skeleton__header" />
      {Array.from({ length: 6 }, (_, index) => (
        <div className="plans-skeleton__row" key={index}>
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  )
}

function DesktopPlanTable({ onOpenPlan, plans }) {
  return (
    <div className="plans-table-shell">
      <table className="plans-table">
        <thead>
          <tr>
            <th scope="col">Period</th>
            <th scope="col">Type</th>
            <th scope="col">Status</th>
            <th scope="col">Entries</th>
            <th scope="col">Hours</th>
            <th scope="col">Department</th>
            <th scope="col">Updated</th>
            <th className="plans-table__action-heading" scope="col">Open</th>
          </tr>
        </thead>
        <tbody>
          {plans.map((plan) => (
            <tr
              aria-label={`Open overtime plan from ${formatDate(plan.periodStartDate)} to ${formatDate(plan.periodEndDate)}`}
              className={`plan-record plan-record--${plan.status}`}
              key={plan.planId}
              onClick={() => onOpenPlan(plan.planId)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onOpenPlan(plan.planId)
                }
              }}
              role="link"
              tabIndex={0}
            >
              <td><PlanPeriod plan={plan} /></td>
              <td>
                <span className="plan-type">{formatLabel(plan.periodType)}</span>
                <small>{formatLabel(plan.planScope)} plan</small>
              </td>
              <td><PlanStatus status={plan.status} /></td>
              <td>{plan.itemCount}</td>
              <td><strong>{formatHours(plan.plannedHours)}</strong></td>
              <td>{plan.departmentName || 'Not assigned'}</td>
              <td>{formatDateTime(plan.updatedAt)}</td>
              <td className="plans-table__action"><ArrowRight size={17} aria-hidden="true" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MobilePlanList({ onOpenPlan, plans }) {
  return (
    <div className="plans-mobile-list">
      {plans.map((plan) => (
        <article
          aria-label={`Open overtime plan from ${formatDate(plan.periodStartDate)} to ${formatDate(plan.periodEndDate)}`}
          className={`plan-list-item plan-record--${plan.status}`}
          key={plan.planId}
          onClick={() => onOpenPlan(plan.planId)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onOpenPlan(plan.planId)
            }
          }}
          role="link"
          tabIndex={0}
        >
          <div className="plan-list-item__heading">
            <PlanPeriod plan={plan} />
            <PlanStatus status={plan.status} />
          </div>
          <dl>
            <div><dt>Type</dt><dd>{formatLabel(plan.periodType)}</dd></div>
            <div><dt>Entries</dt><dd>{plan.itemCount}</dd></div>
            <div><dt>Planned hours</dt><dd>{formatHours(plan.plannedHours)}</dd></div>
            <div><dt>Department</dt><dd>{plan.departmentName || 'Not assigned'}</dd></div>
            <div><dt>Scope</dt><dd>{formatLabel(plan.planScope)}</dd></div>
            <div><dt>Updated</dt><dd>{formatDateTime(plan.updatedAt)}</dd></div>
          </dl>
        </article>
      ))}
    </div>
  )
}

export function EmployeePlansPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const refreshingPlanQueries = useIsFetching({
    queryKey: ['employee', 'overtime-plans'],
  })
  const [status, setStatus] = useState('')
  const [periodType, setPeriodType] = useState('')
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [anchorDate, setAnchorDate] = useState(today)
  const [calendarMonth, setCalendarMonth] = useState(toMonthValue(today))
  const [offset, setOffset] = useState(0)
  const dateRange = useMemo(
    () => getDateRange(periodType, anchorDate),
    [anchorDate, periodType],
  )

  const plansQuery = useQuery({
    queryKey: [
      'employee',
      'overtime-plans',
      { status, periodType, selectedYear, dateRange, offset },
    ],
    queryFn: () => overtimePlanApi.listMyPlans({
      ...(dateRange || { year: selectedYear }),
      limit: PAGE_SIZE + 1,
      offset,
      periodType,
      status,
    }),
  })

  const plans = plansQuery.data?.slice(0, PAGE_SIZE) || []
  const hasNextPage = (plansQuery.data?.length || 0) > PAGE_SIZE
  const hasFilters = Boolean(status || periodType || selectedYear !== currentYear)
  const pageNumber = Math.floor(offset / PAGE_SIZE) + 1

  function updateStatus(event) {
    setStatus(event.target.value)
    setOffset(0)
  }

  function updatePeriodType(event) {
    const nextPeriodType = event.target.value
    const nextAnchorDate = moveDateToYear(today, selectedYear)
    setPeriodType(nextPeriodType)
    setAnchorDate(nextAnchorDate)
    setCalendarMonth(toMonthValue(nextAnchorDate))
    setOffset(0)
  }

  function updateYear(event) {
    const nextYear = Number(event.target.value)
    const nextAnchorDate = moveDateToYear(anchorDate, nextYear)
    setSelectedYear(nextYear)
    setAnchorDate(nextAnchorDate)
    setCalendarMonth(toMonthValue(nextAnchorDate))
    setOffset(0)
  }

  function updatePeriodDate(event) {
    if (!event.target.value) return

    const nextAnchorDate = periodType === 'weekly'
      ? fromWeekValue(event.target.value)
      : fromMonthValue(event.target.value)

    setAnchorDate(nextAnchorDate)
    setSelectedYear(nextAnchorDate.getFullYear())
    setCalendarMonth(toMonthValue(nextAnchorDate))
    setOffset(0)
  }

  function shiftDateRange(direction) {
    if (!periodType) return

    const nextDate = new Date(anchorDate)
    if (periodType === 'weekly') {
      nextDate.setDate(nextDate.getDate() + (direction * 7))
    } else {
      nextDate.setDate(1)
      nextDate.setMonth(nextDate.getMonth() + direction)
    }

    setAnchorDate(nextDate)
    setSelectedYear(nextDate.getFullYear())
    setCalendarMonth(toMonthValue(nextDate))
    setOffset(0)
  }

  function updateCalendarMonth(nextMonth) {
    if (!nextMonth) return

    setCalendarMonth(nextMonth)
    const nextMonthDate = fromMonthValue(nextMonth)

    if (periodType === 'monthly') {
      setAnchorDate(nextMonthDate)
      setSelectedYear(nextMonthDate.getFullYear())
      setOffset(0)
    } else if (!periodType) {
      setSelectedYear(nextMonthDate.getFullYear())
      setOffset(0)
    }
  }

  function clearFilters() {
    setStatus('')
    setPeriodType('')
    setSelectedYear(currentYear)
    setAnchorDate(today)
    setCalendarMonth(toMonthValue(today))
    setOffset(0)
  }

  function openPlan(planId) {
    navigate(`/employee/plans/${encodeURIComponent(planId)}`)
  }

  function refreshOvertimePlans() {
    queryClient.refetchQueries({
      queryKey: ['employee', 'overtime-plans'],
      type: 'active',
    })
  }

  return (
    <main className="employee-main plans-page">
      <h1 className="plans-visually-hidden">Overtime plan</h1>

      <div className="plans-toolbar" aria-label="Overtime plan filters">
        <label>
          <span><ListFilter size={14} aria-hidden="true" />Status</span>
          <select value={status} onChange={updateStatus}>
            {statusOptions.map((option) => (
              <option key={option.value || 'all'} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label>
          <span><CalendarRange size={14} aria-hidden="true" />Plan period</span>
          <select value={periodType} onChange={updatePeriodType}>
            <option value="">All periods</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>

        <label className="plans-year-filter">
          <span><CalendarDays size={14} aria-hidden="true" />Year</span>
          <select value={selectedYear} onChange={updateYear}>
            {yearOptions.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </label>

        {dateRange ? (
          <div className="plans-date-navigation" aria-label={`${formatLabel(periodType)} date range`}>
            <button
              aria-label={`Previous ${periodType === 'weekly' ? 'week' : 'month'}`}
              onClick={() => shiftDateRange(-1)}
              title={`Previous ${periodType === 'weekly' ? 'week' : 'month'}`}
              type="button"
            >
              <ChevronLeft size={17} aria-hidden="true" />
            </button>
            <div>
              <CalendarClock size={16} aria-hidden="true" />
              <span className="plans-period-picker">
                <input
                  aria-label={periodType === 'weekly' ? 'Selected week' : 'Selected month'}
                  max={periodType === 'weekly' ? '2100-W52' : '2100-12'}
                  min={periodType === 'weekly' ? '2000-W01' : '2000-01'}
                  onChange={updatePeriodDate}
                  type={periodType === 'weekly' ? 'week' : 'month'}
                  value={periodType === 'weekly' ? toWeekValue(anchorDate) : toMonthValue(anchorDate)}
                />
                <small>{formatDate(dateRange.dateFrom)} - {formatDate(dateRange.dateTo)}</small>
              </span>
            </div>
            <button
              aria-label={`Next ${periodType === 'weekly' ? 'week' : 'month'}`}
              onClick={() => shiftDateRange(1)}
              title={`Next ${periodType === 'weekly' ? 'week' : 'month'}`}
              type="button"
            >
              <ChevronRight size={17} aria-hidden="true" />
            </button>
          </div>
        ) : null}

        <div className="plans-toolbar__actions">
          {hasFilters ? (
            <button className="plans-clear-filters" onClick={clearFilters} type="button">
              Clear filters
            </button>
          ) : null}
          <button
            aria-label="Refresh overtime plans"
            className="plans-refresh-button"
            disabled={refreshingPlanQueries > 0}
            onClick={refreshOvertimePlans}
            title="Refresh"
            type="button"
          >
            <RefreshCw className={refreshingPlanQueries > 0 ? 'plans-refresh-spin' : ''} size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      <OvertimePlanCalendar
        monthValue={calendarMonth}
        onMonthChange={updateCalendarMonth}
        periodType={periodType}
        status={status}
      />

      {plansQuery.isLoading ? (
        <>
          <span className="plans-visually-hidden" role="status">Loading overtime plans...</span>
          <PlansSkeleton />
        </>
      ) : null}

      {plansQuery.isError ? (
        <div className="plans-state plans-state--error" role="alert">
          <AlertCircle size={26} aria-hidden="true" />
          <div>
            <strong>Unable to load overtime plans</strong>
            <span>{plansQuery.error.message}</span>
          </div>
          <button onClick={() => plansQuery.refetch()} type="button">
            <RefreshCw size={16} aria-hidden="true" />
            Retry
          </button>
        </div>
      ) : null}

      {plansQuery.isSuccess && plans.length === 0 ? (
        <div className="plans-state">
          <ClipboardList size={32} strokeWidth={1.5} aria-hidden="true" />
          <div>
            <strong>{hasFilters ? 'No matching overtime plans' : 'No overtime plans yet'}</strong>
            <span>{hasFilters ? 'Try changing or clearing the selected filters.' : 'Your overtime plans will appear here.'}</span>
          </div>
          {hasFilters ? (
            <button onClick={clearFilters} type="button">Clear filters</button>
          ) : null}
        </div>
      ) : null}

      {plansQuery.isSuccess && plans.length > 0 ? (
        <section className="plans-results" aria-label="Overtime plans">
          <div className="plans-results__header">
            <div>
              <ClipboardList size={18} aria-hidden="true" />
              <span><strong>Plan records</strong><small>Employee overtime plans</small></span>
            </div>
            <div className="plans-results__summary" aria-live="polite">
              <span>{plans.length} {plans.length === 1 ? 'plan' : 'plans'} on this page</span>
              {plansQuery.isFetching ? <small>Refreshing...</small> : null}
            </div>
          </div>

          <DesktopPlanTable onOpenPlan={openPlan} plans={plans} />
          <MobilePlanList onOpenPlan={openPlan} plans={plans} />

          <nav className="plans-pagination" aria-label="Overtime plan pages">
            <button
              aria-label="Previous page"
              disabled={offset === 0 || plansQuery.isFetching}
              onClick={() => setOffset((current) => Math.max(0, current - PAGE_SIZE))}
              title="Previous page"
              type="button"
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <span>Page {pageNumber}</span>
            <button
              aria-label="Next page"
              disabled={!hasNextPage || plansQuery.isFetching}
              onClick={() => setOffset((current) => current + PAGE_SIZE)}
              title="Next page"
              type="button"
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </nav>
        </section>
      ) : null}
    </main>
  )
}
