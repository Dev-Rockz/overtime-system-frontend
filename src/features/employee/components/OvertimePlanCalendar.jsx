import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  CalendarCheck2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ListChecks,
  RefreshCw,
} from 'lucide-react'
import { overtimePlanApi } from '../../../api/overtimePlanApi.js'
import './overtimePlanCalendar.css'

const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function toDateValue(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function fromMonthValue(value) {
  const [year, month] = value.split('-').map(Number)
  return new Date(year, month - 1, 1)
}

function startOfWeek(date) {
  const start = new Date(date)
  start.setDate(start.getDate() - start.getDay())
  return start
}

function getCalendarGrid(monthValue) {
  const monthStart = fromMonthValue(monthValue)
  const gridStart = startOfWeek(monthStart)
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(date.getDate() + index)
    return date
  })

  return {
    days,
    dateFrom: toDateValue(days[0]),
    dateTo: toDateValue(days[days.length - 1]),
    monthIndex: monthStart.getMonth(),
    monthLabel: new Intl.DateTimeFormat('en', {
      month: 'long',
      year: 'numeric',
    }).format(monthStart),
  }
}

function getStatusTone(statuses = []) {
  if (statuses.includes('rejected')) return 'rejected'
  if (statuses.some((status) => ['supervisor_returned', 'returned_for_revision'].includes(status))) {
    return 'returned'
  }
  if (statuses.some((status) => ['approved', 'supervisor_accepted'].includes(status))) {
    return 'approved'
  }
  if (statuses.some((status) => [
    'submitted',
    'submitted_to_supervisor',
    'pending_approval',
  ].includes(status))) {
    return 'submitted'
  }
  if (statuses.includes('closed')) return 'closed'
  return 'draft'
}

const statusLabels = {
  approved: 'Approved',
  closed: 'Closed',
  draft: 'Draft',
  rejected: 'Rejected',
  returned: 'Returned',
  submitted: 'In review',
}

function formatHours(value) {
  return new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(Number(value) || 0)
}

export function OvertimePlanCalendar({ monthValue, onMonthChange, periodType, status }) {
  const calendarGrid = useMemo(() => getCalendarGrid(monthValue), [monthValue])
  const todayValue = toDateValue(new Date())
  const calendarQuery = useQuery({
    queryKey: [
      'employee',
      'overtime-plans',
      'calendar',
      { monthValue, periodType, status },
    ],
    queryFn: () => overtimePlanApi.getCalendar({
      dateFrom: calendarGrid.dateFrom,
      dateTo: calendarGrid.dateTo,
      periodType,
      status,
    }),
  })

  const summaries = calendarQuery.data || []
  const visibleSummaries = summaries.filter((summary) => summary.date.startsWith(monthValue))
  const summaryByDate = new Map(summaries.map((summary) => [summary.date, summary]))
  const totals = visibleSummaries.reduce((result, summary) => ({
    entries: result.entries + summary.itemCount,
    hours: result.hours + summary.plannedHours,
  }), { entries: 0, hours: 0 })

  function shiftMonth(direction) {
    const nextMonth = fromMonthValue(monthValue)
    nextMonth.setMonth(nextMonth.getMonth() + direction)
    onMonthChange(toDateValue(nextMonth).slice(0, 7))
  }

  return (
    <section className="ot-calendar" aria-labelledby="ot-calendar-title">
      <header className="ot-calendar__header">
        <div className="ot-calendar__title">
          <span><CalendarDays size={20} aria-hidden="true" /></span>
          <div>
            <small>Plan schedule</small>
            <h2 id="ot-calendar-title">{calendarGrid.monthLabel}</h2>
            <p>Overtime calendar</p>
          </div>
        </div>

        <div className="ot-calendar__month-controls">
          <button
            aria-label="Previous calendar month"
            onClick={() => shiftMonth(-1)}
            title="Previous month"
            type="button"
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <input
            aria-label="Calendar month"
            max="2100-12"
            min="2000-01"
            onChange={(event) => {
              if (event.target.value) onMonthChange(event.target.value)
            }}
            type="month"
            value={monthValue}
          />
          <button
            aria-label="Next calendar month"
            onClick={() => shiftMonth(1)}
            title="Next month"
            type="button"
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="ot-calendar__summary">
        <div>
          <CalendarCheck2 size={18} aria-hidden="true" />
          <span><small>Scheduled days</small><strong>{visibleSummaries.length}</strong></span>
        </div>
        <div>
          <ListChecks size={18} aria-hidden="true" />
          <span><small>OT entries</small><strong>{totals.entries}</strong></span>
        </div>
        <div>
          <Clock3 size={18} aria-hidden="true" />
          <span><small>Planned hours</small><strong>{formatHours(totals.hours)}</strong></span>
        </div>
        {calendarQuery.isFetching && !calendarQuery.isLoading ? (
          <small className="ot-calendar__refreshing">Refreshing...</small>
        ) : null}
      </div>

      <div className="ot-calendar__scroll">
        <div className="ot-calendar__grid">
          {weekDays.map((day) => <div className="ot-calendar__weekday" key={day}>{day}</div>)}

          {calendarQuery.isLoading
            ? Array.from({ length: 42 }, (_, index) => (
                <div className="ot-calendar__day ot-calendar__day--skeleton" key={index} />
              ))
            : calendarGrid.days.map((date) => {
                const dateValue = toDateValue(date)
                const summary = summaryByDate.get(dateValue)
                const statusTone = summary ? getStatusTone(summary.statuses) : ''
                const statusLabel = statusLabels[statusTone] || ''
                const outsideMonth = date.getMonth() !== calendarGrid.monthIndex
                const isToday = dateValue === todayValue
                const planLabel = summary?.planCount === 1 ? 'plan' : 'plans'

                return (
                  <div
                    aria-label={summary
                      ? `${dateValue}: ${statusLabel}, ${summary.planCount} ${planLabel}, ${formatHours(summary.plannedHours)} planned hours`
                      : dateValue}
                    className={[
                      'ot-calendar__day',
                      outsideMonth ? 'ot-calendar__day--outside' : '',
                      isToday ? 'ot-calendar__day--today' : '',
                      summary ? `ot-calendar__day--${statusTone}` : '',
                    ].filter(Boolean).join(' ')}
                    key={dateValue}
                  >
                    <div className="ot-calendar__date-row">
                      <span className="ot-calendar__date">{date.getDate()}</span>
                      {isToday ? <span className="ot-calendar__today-label">Today</span> : null}
                    </div>
                    {summary ? (
                      <div className="ot-calendar__day-content">
                        <span className="ot-calendar__status"><i />{statusLabel}</span>
                        <div>
                          <strong>{summary.planCount} {planLabel}</strong>
                          <small>{formatHours(summary.plannedHours)}h</small>
                        </div>
                        <span>{summary.itemCount} {summary.itemCount === 1 ? 'entry' : 'entries'}</span>
                      </div>
                    ) : null}
                  </div>
                )
              })}
        </div>
      </div>

      {calendarQuery.isError ? (
        <div className="ot-calendar__error" role="alert">
          <span>{calendarQuery.error.message}</span>
          <button onClick={() => calendarQuery.refetch()} type="button">
            <RefreshCw size={15} aria-hidden="true" />
            Retry
          </button>
        </div>
      ) : null}

      <div className="ot-calendar__legend" aria-label="Calendar status colors">
        <span className="ot-calendar__legend-item ot-calendar__legend-item--draft">Draft</span>
        <span className="ot-calendar__legend-item ot-calendar__legend-item--submitted">Submitted</span>
        <span className="ot-calendar__legend-item ot-calendar__legend-item--approved">Accepted / approved</span>
        <span className="ot-calendar__legend-item ot-calendar__legend-item--returned">Returned</span>
        <span className="ot-calendar__legend-item ot-calendar__legend-item--rejected">Rejected</span>
        <span className="ot-calendar__legend-item ot-calendar__legend-item--closed">Closed</span>
      </div>
    </section>
  )
}
