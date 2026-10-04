import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FilePenLine,
  ListFilter,
  RefreshCw,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { supervisorApi } from '../../../api/supervisorApi.js'
import { useToast } from '../../../components/shared/toast/useToast.js'
import {
  addDays,
  formatWeek,
  getWeekPeriod,
  parseDateValue,
  toDateValue,
} from '../utils/weekPeriod.js'
import './supervisorDepartmentDraftsPage.css'

const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatHours(value) {
  return new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(Number(value) || 0)
}

function formatDate(value, options = {}) {
  return new Intl.DateTimeFormat('en', options).format(parseDateValue(value))
}

function getMonthRange(anchorDate) {
  const anchor = parseDateValue(anchorDate)
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
  return {
    dateFrom: toDateValue(first),
    dateTo: toDateValue(last),
    label: new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(first),
  }
}

function getMonthCalendarDays(anchorDate) {
  const monthStart = parseDateValue(getMonthRange(anchorDate).dateFrom)
  const gridStart = addDays(monthStart, -monthStart.getDay())
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index))
}

function getVisibleRange(viewMode, anchorDate) {
  if (viewMode === 'month') return getMonthRange(anchorDate)
  const week = getWeekPeriod(anchorDate)
  return {
    dateFrom: week.periodStartDate,
    dateTo: week.periodEndDate,
    label: formatWeek(week.periodStartDate, week.periodEndDate),
  }
}

function getCalendarDays(viewMode, anchorDate, range) {
  if (viewMode === 'month') return getMonthCalendarDays(anchorDate)
  return Array.from({ length: 7 }, (_, index) => addDays(range.dateFrom, index))
}

function displayStatus(status) {
  return String(status || 'draft').replaceAll('_', ' ')
}

function DeleteDraftDialog({ isPending, onClose, onConfirm, plan }) {
  return (
    <div className="department-draft-delete__backdrop" role="presentation">
      <section
        aria-labelledby="delete-department-draft-title"
        aria-modal="true"
        className="department-draft-delete"
        role="dialog"
      >
        <header>
          <span><Trash2 size={17} aria-hidden="true" /></span>
          <div>
            <small>Permanent action</small>
            <h2 id="delete-department-draft-title">Delete department draft?</h2>
          </div>
          <button aria-label="Close delete confirmation" onClick={onClose} type="button">
            <X size={17} aria-hidden="true" />
          </button>
        </header>
        <div className="department-draft-delete__body">
          <strong>{formatWeek(plan.periodStartDate, plan.periodEndDate)}</strong>
          <p>The department draft and its copied entries will be deleted. Employee source plans remain unchanged.</p>
        </div>
        <footer>
          <button className="department-draft-delete__cancel" disabled={isPending} onClick={onClose} type="button">Cancel</button>
          <button disabled={isPending} onClick={onConfirm} type="button">
            <Trash2 size={14} aria-hidden="true" />
            {isPending ? 'Deleting...' : 'Delete draft'}
          </button>
        </footer>
      </section>
    </div>
  )
}

export function SupervisorDepartmentDraftsPage() {
  const today = toDateValue(new Date())
  const [viewMode, setViewMode] = useState('week')
  const [anchorDate, setAnchorDate] = useState(today)
  const [selectedDate, setSelectedDate] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const queryClient = useQueryClient()
  const toast = useToast()
  const range = useMemo(
    () => getVisibleRange(viewMode, anchorDate),
    [anchorDate, viewMode],
  )
  const calendarDays = useMemo(
    () => getCalendarDays(viewMode, anchorDate, range),
    [anchorDate, range, viewMode],
  )
  const draftsQuery = useQuery({
    queryKey: ['supervisor', 'department-drafts', range.dateFrom, range.dateTo],
    queryFn: () => supervisorApi.listDepartmentDrafts({
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
    }),
  })
  const drafts = useMemo(() => draftsQuery.data || [], [draftsQuery.data])
  const deleteMutation = useMutation({
    mutationFn: (planId) => supervisorApi.deleteDepartmentDraft(planId),
    onSuccess: async () => {
      setDeleteTarget(null)
      toast.success('Department draft deleted.')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['supervisor', 'department-drafts'] }),
        queryClient.invalidateQueries({ queryKey: ['supervisor', 'department-preparation'] }),
      ])
    },
    onError: (error) => toast.error(error.message),
  })

  const daySummary = useMemo(() => {
    const summaries = new Map()
    drafts.forEach((plan) => {
      ;(plan.items || []).forEach((item) => {
        const current = summaries.get(item.plannedDate) || {
          employees: new Map(),
          hours: 0,
          itemCount: 0,
        }
        current.employees.set(item.employeeId, item.employeeName || item.employeeId)
        current.hours += Number(item.plannedHours || 0)
        current.itemCount += 1
        summaries.set(item.plannedDate, current)
      })
    })
    return summaries
  }, [drafts])

  const totalHours = drafts.reduce((total, plan) => total + Number(plan.plannedHours || 0), 0)
  const employeeIds = new Set(drafts.flatMap((plan) => (
    (plan.items || []).map((item) => item.employeeId)
  )))
  const visibleMonth = parseDateValue(anchorDate).getMonth()

  function shiftRange(direction) {
    if (viewMode === 'week') {
      setAnchorDate(toDateValue(addDays(anchorDate, direction * 7)))
      return
    }
    const next = parseDateValue(anchorDate)
    next.setMonth(next.getMonth() + direction, 1)
    setAnchorDate(toDateValue(next))
  }

  function selectCalendarDate(dateValue) {
    setSelectedDate(dateValue)
  }

  return (
    <main className="supervisor-main department-drafts-page">
      <header className="department-drafts__header">
        <div>
          <span>Department planning</span>
          <h1>Department drafts</h1>
          <p>Editable weekly department plans</p>
        </div>
        <button
          aria-label="Refresh department drafts"
          disabled={draftsQuery.isFetching}
          onClick={() => draftsQuery.refetch()}
          title="Refresh"
          type="button"
        >
          <RefreshCw className={draftsQuery.isFetching ? 'department-drafts__spin' : ''} size={16} aria-hidden="true" />
        </button>
      </header>

      <section className="department-drafts__controls" aria-label="Draft date filters">
        <div className="department-drafts__mode" role="group" aria-label="Calendar range">
          <button aria-pressed={viewMode === 'week'} onClick={() => setViewMode('week')} type="button">Week</button>
          <button aria-pressed={viewMode === 'month'} onClick={() => setViewMode('month')} type="button">Month</button>
        </div>
        <div className="department-drafts__range">
          <button aria-label={`Previous ${viewMode}`} onClick={() => shiftRange(-1)} type="button">
            <ChevronLeft size={17} aria-hidden="true" />
          </button>
          <label>
            <CalendarDays size={15} aria-hidden="true" />
            <input
              aria-label="Select draft date"
              onChange={(event) => event.target.value && setAnchorDate(
                viewMode === 'month' ? `${event.target.value}-01` : event.target.value,
              )}
              type={viewMode === 'month' ? 'month' : 'date'}
              value={viewMode === 'month' ? anchorDate.slice(0, 7) : anchorDate}
            />
          </label>
          <button aria-label={`Next ${viewMode}`} onClick={() => shiftRange(1)} type="button">
            <ChevronRight size={17} aria-hidden="true" />
          </button>
          <button className="department-drafts__today" onClick={() => setAnchorDate(today)} type="button">Today</button>
        </div>
        <div className="department-drafts__range-label">
          <span>{viewMode === 'week' ? 'Selected week' : 'Selected month'}</span>
          <strong>{range.label}</strong>
        </div>
      </section>

      <dl className="department-drafts__summary" aria-label="Department draft summary">
        <div><dt><FilePenLine size={15} aria-hidden="true" /> Draft plans</dt><dd>{drafts.length}</dd></div>
        <div><dt><UsersRound size={15} aria-hidden="true" /> Employees</dt><dd>{employeeIds.size}</dd></div>
        <div><dt><ListFilter size={15} aria-hidden="true" /> OT entries</dt><dd>{drafts.reduce((total, plan) => total + Number(plan.itemCount || 0), 0)}</dd></div>
        <div><dt><Clock3 size={15} aria-hidden="true" /> Planned hours</dt><dd>{formatHours(totalHours)}h</dd></div>
      </dl>

      {draftsQuery.isLoading ? (
        <div className="department-drafts__loading" role="status">
          <div className="department-drafts__calendar-skeleton" />
          <div className="department-drafts__list-skeleton" />
        </div>
      ) : null}

      {draftsQuery.isError ? (
        <div className="department-drafts__error" role="alert">
          <AlertCircle size={20} aria-hidden="true" />
          <div><strong>Unable to load department drafts</strong><span>{draftsQuery.error.message}</span></div>
          <button onClick={() => draftsQuery.refetch()} type="button">Retry</button>
        </div>
      ) : null}

      {draftsQuery.isSuccess ? (
        <>
          <section className={`department-drafts__calendar department-drafts__calendar--${viewMode}`} aria-labelledby="department-drafts-calendar-title">
            <header>
              <div>
                <span>Draft coverage</span>
                <h2 id="department-drafts-calendar-title">{range.label}</h2>
              </div>
              {selectedDate ? <small>Selected: {formatDate(selectedDate, { day: 'numeric', month: 'short', year: 'numeric' })}</small> : null}
            </header>
            <div className="department-drafts__calendar-scroll">
              <div className="department-drafts__calendar-grid">
                {(viewMode === 'month' ? dayLabels : calendarDays.map((date) => formatDate(toDateValue(date), { weekday: 'short' })))
                  .map((label, index) => <div className="department-drafts__weekday" key={`${label}-${index}`}>{label}</div>)}
                {calendarDays.map((date) => {
                  const dateValue = toDateValue(date)
                  const summary = daySummary.get(dateValue)
                  const employeeNames = summary ? [...summary.employees.values()] : []
                  const outsideMonth = viewMode === 'month' && date.getMonth() !== visibleMonth
                  return (
                    <button
                      aria-label={summary
                        ? `${dateValue}, ${employeeNames.length} employees, ${formatHours(summary.hours)} planned hours`
                        : dateValue}
                      className={[
                        'department-drafts__day',
                        outsideMonth ? 'department-drafts__day--outside' : '',
                        dateValue === today ? 'department-drafts__day--today' : '',
                        dateValue === selectedDate ? 'department-drafts__day--selected' : '',
                        summary ? 'department-drafts__day--filled' : '',
                      ].filter(Boolean).join(' ')}
                      key={dateValue}
                      onClick={() => selectCalendarDate(dateValue)}
                      type="button"
                    >
                      <span className="department-drafts__date">
                        {date.getDate()}
                        {dateValue === today ? <small>Today</small> : null}
                      </span>
                      {summary ? (
                        <span className="department-drafts__day-data">
                          <strong>{employeeNames.length} {employeeNames.length === 1 ? 'employee' : 'employees'}</strong>
                          <small>{formatHours(summary.hours)}h · {summary.itemCount} {summary.itemCount === 1 ? 'entry' : 'entries'}</small>
                          {viewMode === 'week' ? (
                            <span>{employeeNames.slice(0, 2).join(', ')}{employeeNames.length > 2 ? ` +${employeeNames.length - 2}` : ''}</span>
                          ) : null}
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </div>
          </section>

          {!drafts.length ? (
            <section className="department-drafts__empty">
              <FilePenLine size={25} aria-hidden="true" />
              <strong>No editable department drafts in this {viewMode}</strong>
              <Link to="/supervisor/department-plans">Prepare a department plan</Link>
            </section>
          ) : (
            <section className="department-drafts__list">
              <header><span>Draft list</span><strong>{drafts.length}</strong></header>
              {drafts.map((plan) => {
                const employeeCount = new Set((plan.items || []).map((item) => item.employeeId)).size
                return (
                  <article key={plan.planId}>
                    <span className="department-drafts__list-period">
                      <small>{displayStatus(plan.status)}</small>
                      <strong>{formatWeek(plan.periodStartDate, plan.periodEndDate)}</strong>
                      <span>{plan.departmentName || plan.departmentId}</span>
                    </span>
                    <span className="department-drafts__list-metrics">
                      <span>{employeeCount}<small>employees</small></span>
                      <span>{plan.itemCount}<small>entries</small></span>
                      <span>{formatHours(plan.plannedHours)}h<small>planned</small></span>
                    </span>
                    <span className="department-drafts__list-actions">
                      <button aria-label="Delete draft" onClick={() => setDeleteTarget(plan)} type="button">
                        <Trash2 size={13} aria-hidden="true" />
                        Delete
                      </button>
                      <Link to={`/supervisor/department-plans/${encodeURIComponent(plan.planId)}`}>
                        Open draft
                        <ChevronRight size={14} aria-hidden="true" />
                      </Link>
                    </span>
                  </article>
                )
              })}
            </section>
          )}
        </>
      ) : null}

      {deleteTarget ? (
        <DeleteDraftDialog
          isPending={deleteMutation.isPending}
          onClose={() => !deleteMutation.isPending && setDeleteTarget(null)}
          onConfirm={() => deleteMutation.mutate(deleteTarget.planId)}
          plan={deleteTarget}
        />
      ) : null}
    </main>
  )
}
