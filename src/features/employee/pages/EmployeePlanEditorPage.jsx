import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  Copy,
  Eraser,
  ListChecks,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { overtimePlanApi } from '../../../api/overtimePlanApi.js'
import { useToast } from '../../../components/shared/toast/useToast.js'
import './employeePlanEditor.css'

const EDITABLE_STATUSES = ['draft', 'supervisor_returned', 'returned_for_revision']
const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

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
  const date = typeof value === 'string' ? parseDate(value) : value
  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: options.short ? 'short' : 'long',
    weekday: options.weekday ? 'short' : undefined,
    year: 'numeric',
  }).format(date)
}

function startOfMondayWeek(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = start.getDay() || 7
  start.setDate(start.getDate() - day + 1)
  return start
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

function fromWeekValue(value) {
  const [yearText, weekText] = value.split('-W')
  const januaryFourth = new Date(Number(yearText), 0, 4)
  const firstMonday = startOfMondayWeek(januaryFourth)
  firstMonday.setDate(firstMonday.getDate() + ((Number(weekText) - 1) * 7))
  return firstMonday
}

function getPeriod(periodType, periodValue) {
  const start = periodType === 'weekly'
    ? fromWeekValue(periodValue)
    : new Date(Number(periodValue.slice(0, 4)), Number(periodValue.slice(5, 7)) - 1, 1)
  const end = new Date(start)

  if (periodType === 'weekly') {
    end.setDate(end.getDate() + 6)
  } else {
    end.setMonth(end.getMonth() + 1, 0)
  }

  const dates = []
  const current = new Date(start)

  while (current <= end) {
    dates.push(toDateValue(current))
    current.setDate(current.getDate() + 1)
  }

  return {
    dates,
    endDate: toDateValue(end),
    label: periodType === 'weekly'
      ? `${formatDate(start, { short: true })} - ${formatDate(end, { short: true })}`
      : new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(start),
    startDate: toDateValue(start),
  }
}

function createEntryMap(dates, items = []) {
  const itemByDate = new Map(items.map((item) => [item.plannedDate, item]))

  return Object.fromEntries(dates.map((date) => {
    const item = itemByDate.get(date)
    return [date, {
      enabled: Boolean(item),
      hours: item ? String(item.plannedHours) : '',
      itemId: item?.planItemId || null,
      reason: item?.reason || '',
    }]
  }))
}

function PlanEditorSkeleton() {
  return (
    <div className="plan-editor-skeleton" aria-hidden="true">
      <span />
      <section>{Array.from({ length: 7 }, (_, index) => <i key={index} />)}</section>
    </div>
  )
}

function WeeklyTemplate({ activeDate, dates, entries, onActivate, onChange, onRemove }) {
  const activeEntry = activeDate ? entries[activeDate] : null

  return (
    <div className="weekly-entry-template">
      <div className="weekly-calendar-scroll">
        <div className="weekly-calendar-strip" aria-label="Weekly overtime dates">
          {dates.map((date) => {
            const entry = entries[date]
            const parsedDate = parseDate(date)
            const isWeekend = [0, 6].includes(parsedDate.getDay())

            return (
              <button
                aria-label={`${entry.enabled ? 'Edit' : 'Include'} ${formatDate(date, { weekday: true, short: true })}`}
                aria-pressed={entry.enabled}
                className={[
                  'weekly-calendar-day',
                  isWeekend ? 'weekly-calendar-day--weekend' : '',
                  entry.enabled ? 'weekly-calendar-day--selected' : '',
                  activeDate === date ? 'weekly-calendar-day--active' : '',
                ].filter(Boolean).join(' ')}
                key={date}
                onClick={() => onActivate(date)}
                type="button"
              >
                <span className="weekly-calendar-day__name">
                  {new Intl.DateTimeFormat('en', { weekday: 'short' }).format(parsedDate)}
                </span>
                <strong>{parsedDate.getDate()}</strong>
                <small>{new Intl.DateTimeFormat('en', { month: 'short' }).format(parsedDate)}</small>
                <span className="weekly-calendar-day__status">
                  {entry.enabled ? <CheckCircle2 size={13} aria-hidden="true" /> : <Circle size={12} aria-hidden="true" />}
                  {entry.enabled ? (entry.hours ? `${entry.hours}h planned` : 'Set hours') : 'Available'}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="weekly-entry-editor">
        {activeDate && activeEntry ? (
          <>
            <div className="weekly-entry-editor__heading">
              <div>
                <CalendarDays size={17} aria-hidden="true" />
                <span><small>Selected date</small><strong>{formatDate(activeDate, { weekday: true, short: true })}</strong></span>
              </div>
              <button aria-label={`Remove ${formatDate(activeDate, { short: true })}`} onClick={() => onRemove(activeDate)} title="Remove date" type="button">
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </div>
            <div className="weekly-entry-editor__fields">
              <label>
                <span>Planned hours</span>
                <input
                  min="0.25"
                  onChange={(event) => onChange(activeDate, 'hours', event.target.value)}
                  placeholder="0.00"
                  step="0.25"
                  type="number"
                  value={activeEntry.hours}
                />
              </label>
              <label>
                <span>Reason</span>
                <textarea
                  maxLength="500"
                  onChange={(event) => onChange(activeDate, 'reason', event.target.value)}
                  placeholder="Reason for planned overtime"
                  rows="3"
                  value={activeEntry.reason}
                />
              </label>
            </div>
          </>
        ) : (
          <div className="weekly-entry-editor__empty">
            <CalendarPlus size={22} strokeWidth={1.6} aria-hidden="true" />
            <strong>Select a day from the week</strong>
            <span>The day will be included in your plan and ready for its hours and reason.</span>
          </div>
        )}
      </div>
    </div>
  )
}

function MonthlyTemplate({ activeDate, dates, entries, onActivate, onChange, onRemove }) {
  const firstDate = parseDate(dates[0])
  const leadingDays = firstDate.getDay()
  const selectedDates = dates.filter((date) => entries[date].enabled)
  const activeEntry = activeDate ? entries[activeDate] : null

  return (
    <div className="monthly-entry-template">
      <div className="monthly-entry-calendar">
        {WEEK_DAYS.map((day) => <span className="monthly-entry-calendar__weekday" key={day}>{day}</span>)}
        {Array.from({ length: leadingDays }, (_, index) => (
          <span className="monthly-entry-calendar__blank" key={`blank-${index}`} />
        ))}
        {dates.map((date) => {
          const entry = entries[date]
          return (
            <button
              aria-label={`${entry.enabled ? 'Edit' : 'Include'} ${formatDate(date, { weekday: true, short: true })}`}
              aria-pressed={entry.enabled}
              className={[
                'monthly-entry-calendar__day',
                entry.enabled ? 'monthly-entry-calendar__day--selected' : '',
                activeDate === date ? 'monthly-entry-calendar__day--active' : '',
              ].filter(Boolean).join(' ')}
              key={date}
              onClick={() => onActivate(date)}
              type="button"
            >
              <span>{parseDate(date).getDate()}</span>
              {entry.enabled ? (
                <>
                  <CheckCircle2 size={14} aria-hidden="true" />
                  <small>{entry.hours ? `${entry.hours}h` : 'Set hours'}</small>
                </>
              ) : <Circle size={13} aria-hidden="true" />}
            </button>
          )
        })}
      </div>

      <div className="monthly-entry-editor">
        {activeEntry?.enabled ? (
          <>
            <div className="monthly-entry-editor__heading">
              <div>
                <CalendarDays size={18} aria-hidden="true" />
                <span><small>Selected date</small><strong>{formatDate(activeDate, { weekday: true })}</strong></span>
              </div>
              <button
                aria-label={`Remove ${formatDate(activeDate, { short: true })}`}
                onClick={() => onRemove(activeDate)}
                title="Remove date"
                type="button"
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="monthly-entry-editor__fields">
              <label>
                <span>Planned hours</span>
                <input
                  min="0.25"
                  onChange={(event) => onChange(activeDate, 'hours', event.target.value)}
                  placeholder="0.00"
                  step="0.25"
                  type="number"
                  value={activeEntry.hours}
                />
              </label>
              <label>
                <span>Reason</span>
                <textarea
                  maxLength="500"
                  onChange={(event) => onChange(activeDate, 'reason', event.target.value)}
                  placeholder="Reason for planned overtime"
                  rows="3"
                  value={activeEntry.reason}
                />
              </label>
            </div>
          </>
        ) : (
          <div className="monthly-entry-editor__empty">
            <CalendarPlus size={24} strokeWidth={1.6} aria-hidden="true" />
            <strong>Select a calendar date</strong>
            <span>The date will be included and ready for hours and a reason.</span>
          </div>
        )}
      </div>

      {selectedDates.length ? (
        <div className="monthly-selected-dates">
          <div className="monthly-selected-dates__heading">
            <ListChecks size={16} aria-hidden="true" />
            <strong>Selected dates</strong>
            <span>{selectedDates.length}</span>
          </div>
          <div className="monthly-selected-dates__list">
            {selectedDates.map((date) => (
              <button
                className={activeDate === date ? 'monthly-selected-date monthly-selected-date--active' : 'monthly-selected-date'}
                key={date}
                onClick={() => onActivate(date)}
                type="button"
              >
                <span><strong>{formatDate(date, { weekday: true, short: true })}</strong><small>{entries[date].reason || 'Reason required'}</small></span>
                <span>{entries[date].hours ? `${entries[date].hours}h` : 'Hours required'}<ChevronRight size={14} /></span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function EmployeePlanEditorPage() {
  const { planId } = useParams()
  const isEditing = Boolean(planId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const initialWeek = toWeekValue(new Date())
  const [periodType, setPeriodType] = useState('weekly')
  const [periodValue, setPeriodValue] = useState(initialWeek)
  const initialPeriod = useMemo(() => getPeriod('weekly', initialWeek), [initialWeek])
  const [entries, setEntries] = useState(() => createEntryMap(initialPeriod.dates))
  const [activeDate, setActiveDate] = useState(null)
  const [remarks, setRemarks] = useState('')
  const [batchHours, setBatchHours] = useState('')
  const [batchReason, setBatchReason] = useState('')
  const [formError, setFormError] = useState('')
  const [hasVersionConflict, setHasVersionConflict] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const originalPlanRef = useRef(null)
  const initializedPlanRef = useRef(null)

  const planQuery = useQuery({
    queryKey: ['employee', 'overtime-plan', planId],
    queryFn: () => overtimePlanApi.getPlan(planId),
    enabled: isEditing,
  })

  const period = useMemo(
    () => getPeriod(periodType, periodValue),
    [periodType, periodValue],
  )
  const selectedDates = period.dates.filter((date) => entries[date]?.enabled)
  const totalHours = selectedDates.reduce(
    (total, date) => total + (Number(entries[date].hours) || 0),
    0,
  )
  const originalItems = originalPlanRef.current?.items || []
  const periodLocked = Boolean(originalItems.length)
  const canEdit = !isEditing || EDITABLE_STATUSES.includes(planQuery.data?.status)

  useEffect(() => {
    if (!planQuery.data || initializedPlanRef.current === planQuery.data.planId) return

    const plan = planQuery.data
    const nextPeriodValue = plan.periodType === 'weekly'
      ? toWeekValue(parseDate(plan.periodStartDate))
      : plan.periodStartDate.slice(0, 7)
    const nextPeriod = getPeriod(plan.periodType, nextPeriodValue)

    originalPlanRef.current = plan
    initializedPlanRef.current = plan.planId
    setPeriodType(plan.periodType)
    setPeriodValue(nextPeriodValue)
    setEntries(createEntryMap(nextPeriod.dates, plan.items || []))
    setActiveDate(plan.items?.[0]?.plannedDate || null)
    setRemarks(plan.remarks || '')
    setHasVersionConflict(false)
    setHasUnsavedChanges(false)
  }, [planQuery.data])

  useEffect(() => {
    function handleBeforeUnload(event) {
      if (!hasUnsavedChanges) return
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  function replacePeriod(nextType, nextValue) {
    const nextPeriod = getPeriod(nextType, nextValue)
    setPeriodType(nextType)
    setPeriodValue(nextValue)
    setEntries(createEntryMap(nextPeriod.dates))
    setActiveDate(null)
    setFormError('')
    setHasUnsavedChanges(true)
  }

  function handlePeriodType(nextType) {
    if (periodLocked || nextType === periodType) return
    const nextValue = nextType === 'weekly'
      ? toWeekValue(parseDate(period.startDate))
      : period.startDate.slice(0, 7)
    replacePeriod(nextType, nextValue)
  }

  function handleEntryChange(date, field, value) {
    setEntries((current) => ({
      ...current,
      [date]: { ...current[date], [field]: value },
    }))
    setHasUnsavedChanges(true)
    setFormError('')
  }

  function handleToggleDate(date) {
    const willEnable = !entries[date].enabled
    setEntries((current) => ({
      ...current,
      [date]: { ...current[date], enabled: willEnable },
    }))
    setActiveDate(willEnable ? date : activeDate === date ? null : activeDate)
    setHasUnsavedChanges(true)
    setFormError('')
  }

  function activateMonthlyDate(date) {
    if (!entries[date].enabled) {
      handleToggleDate(date)
      return
    }
    setActiveDate(date)
  }

  function selectWeekdays() {
    setEntries((current) => Object.fromEntries(period.dates.map((date) => [
      date,
      {
        ...current[date],
        enabled: [1, 2, 3, 4, 5].includes(parseDate(date).getDay()),
      },
    ])))
    setActiveDate(period.dates.find((date) => [1, 2, 3, 4, 5].includes(parseDate(date).getDay())) || null)
    setHasUnsavedChanges(true)
  }

  function clearDates() {
    setEntries((current) => Object.fromEntries(period.dates.map((date) => [
      date,
      { ...current[date], enabled: false },
    ])))
    setActiveDate(null)
    setHasUnsavedChanges(true)
  }

  function applyBatchValues() {
    if (!selectedDates.length || (!batchHours && !batchReason.trim())) return

    setEntries((current) => ({
      ...current,
      ...Object.fromEntries(selectedDates.map((date) => [
        date,
        {
          ...current[date],
          hours: batchHours || current[date].hours,
          reason: batchReason.trim() || current[date].reason,
        },
      ])),
    }))
    setHasUnsavedChanges(true)
    toast.success('Values applied to selected dates.')
  }

  function copyPreviousEntry() {
    if (!activeDate) return
    const previousDate = selectedDates.filter((date) => date < activeDate).at(-1)
    if (!previousDate) return

    handleEntryChange(activeDate, 'hours', entries[previousDate].hours)
    handleEntryChange(activeDate, 'reason', entries[previousDate].reason)
  }

  function validateEntries() {
    if (!selectedDates.length) {
      return { message: 'Select at least one planned overtime date.' }
    }

    for (const date of selectedDates) {
      if (!Number.isFinite(Number(entries[date].hours)) || Number(entries[date].hours) <= 0) {
        return { date, message: `Enter planned hours for ${formatDate(date, { short: true })}.` }
      }
      if (!entries[date].reason.trim()) {
        return { date, message: `Enter a reason for ${formatDate(date, { short: true })}.` }
      }
    }

    return null
  }

  async function saveNewPlan(items) {
    const plan = await overtimePlanApi.createDraft({
      periodType,
      periodStartDate: period.startDate,
      periodEndDate: period.endDate,
      remarks: remarks.trim() || undefined,
      items,
    })
    return plan.planId
  }

  async function saveExistingPlan(items) {
    const originalPlan = originalPlanRef.current
    const plan = await overtimePlanApi.replaceDraft(planId, {
      expectedUpdatedAt: originalPlan.updatedAt,
      periodType,
      periodStartDate: period.startDate,
      periodEndDate: period.endDate,
      remarks: remarks.trim() || undefined,
      items,
    })
    return plan.planId
  }

  async function reloadLatestPlan() {
    initializedPlanRef.current = null
    setFormError('')
    setHasVersionConflict(false)
    await planQuery.refetch()
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const validationError = validateEntries()

    if (validationError) {
      setFormError(validationError.message)
      if (validationError.date) setActiveDate(validationError.date)
      return
    }

    const items = selectedDates.map((date) => ({
      plannedDate: date,
      plannedHours: Number(entries[date].hours),
      reason: entries[date].reason.trim(),
    }))

    setIsSaving(true)
    setFormError('')
    setHasVersionConflict(false)

    try {
      const savedPlanId = isEditing
        ? await saveExistingPlan(items)
        : await saveNewPlan(items)

      setHasUnsavedChanges(false)
      await queryClient.invalidateQueries({ queryKey: ['employee', 'overtime-plans'] })
      await queryClient.invalidateQueries({ queryKey: ['employee', 'overtime-plan', savedPlanId] })
      toast.success(isEditing ? 'Overtime plan updated.' : 'Overtime plan created.')
      navigate(`/employee/plans/${encodeURIComponent(savedPlanId)}`)
    } catch (error) {
      setFormError(error.message)
      setHasVersionConflict(error.code === 'PLAN_VERSION_CONFLICT')
      toast.error(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  if (planQuery.isLoading) {
    return (
      <main className="employee-main plan-editor-page">
        <span className="plan-editor-visually-hidden" role="status">Loading overtime plan editor...</span>
        <PlanEditorSkeleton />
      </main>
    )
  }

  if (planQuery.isError) {
    return (
      <main className="employee-main plan-editor-page">
        <div className="plan-editor-state" role="alert">
          <AlertCircle size={26} aria-hidden="true" />
          <div><strong>Unable to load plan editor</strong><span>{planQuery.error.message}</span></div>
          <button onClick={() => planQuery.refetch()} type="button"><RefreshCw size={16} />Retry</button>
        </div>
      </main>
    )
  }

  if (!canEdit) {
    return (
      <main className="employee-main plan-editor-page">
        <Link className="plan-editor-back" to={`/employee/plans/${encodeURIComponent(planId)}`}>
          <ArrowLeft size={17} aria-hidden="true" />Back to plan
        </Link>
        <div className="plan-editor-state">
          <AlertCircle size={26} aria-hidden="true" />
          <div><strong>This plan cannot be edited</strong><span>Only draft or returned plans can be modified.</span></div>
        </div>
      </main>
    )
  }

  return (
    <main className="employee-main plan-editor-page">
      {isEditing ? (
        <header className="plan-editor-heading">
          <Link className="plan-editor-back" to={`/employee/plans/${encodeURIComponent(planId)}`}>
            <ArrowLeft size={17} aria-hidden="true" />
            Back to plan
          </Link>
          <div>
            <span><CalendarPlus size={22} aria-hidden="true" /></span>
            <div>
              <h1>Edit overtime plan</h1>
              <p>Update the dates, hours, and reasons in this draft.</p>
            </div>
          </div>
        </header>
      ) : null}

      <form className="plan-editor-form" onSubmit={handleSubmit}>
        <section className="plan-editor-period" aria-labelledby="plan-period-heading">
          <div>
            <small id="plan-period-heading">Plan period</small>
            <div className="plan-editor-segmented" aria-label="Period type">
              <button
                aria-pressed={periodType === 'weekly'}
                disabled={periodLocked}
                onClick={() => handlePeriodType('weekly')}
                type="button"
              >Weekly</button>
              <button
                aria-pressed={periodType === 'monthly'}
                disabled={periodLocked}
                onClick={() => handlePeriodType('monthly')}
                type="button"
              >Monthly</button>
            </div>
          </div>
          <label>
            <span>{periodType === 'weekly' ? 'Select week' : 'Select month'}</span>
            <input
              disabled={periodLocked}
              min={periodType === 'weekly' ? '2000-W01' : '2000-01'}
              onChange={(event) => {
                if (event.target.value) replacePeriod(periodType, event.target.value)
              }}
              type={periodType === 'weekly' ? 'week' : 'month'}
              value={periodValue}
            />
          </label>
          <div className="plan-editor-period__range">
            <CalendarDays size={17} aria-hidden="true" />
            <span><small>Generated range</small><strong>{period.label}</strong></span>
          </div>
          {periodLocked ? <small className="plan-editor-period__locked">Period locked because entries already exist.</small> : null}
        </section>

        <div className="plan-editor-layout">
          <section className="plan-entry-builder" aria-labelledby="plan-entry-heading">
            <header className="plan-entry-builder__header">
              <div>
                <ListChecks size={18} aria-hidden="true" />
                <span><h2 id="plan-entry-heading">Planned overtime entries</h2><small>{period.dates.length} dates generated automatically</small></span>
              </div>
              <div>
                <button onClick={selectWeekdays} type="button"><Sparkles size={14} />Select weekdays</button>
                <button disabled={!selectedDates.length} onClick={clearDates} type="button"><Eraser size={14} />Clear</button>
              </div>
            </header>

            {periodType === 'weekly' ? (
              <WeeklyTemplate
                activeDate={activeDate}
                dates={period.dates}
                entries={entries}
                onActivate={activateMonthlyDate}
                onChange={handleEntryChange}
                onRemove={handleToggleDate}
              />
            ) : (
              <MonthlyTemplate
                activeDate={activeDate}
                dates={period.dates}
                entries={entries}
                onActivate={activateMonthlyDate}
                onChange={handleEntryChange}
                onRemove={handleToggleDate}
              />
            )}

            <div className="plan-entry-batch" aria-label="Apply values to selected dates">
              <div><Sparkles size={16} aria-hidden="true" /><span><strong>Quick apply</strong><small>Update every selected date</small></span></div>
              <label><span>Hours</span><input min="0.25" onChange={(event) => setBatchHours(event.target.value)} placeholder="Keep" step="0.25" type="number" value={batchHours} /></label>
              <label><span>Reason</span><input onChange={(event) => setBatchReason(event.target.value)} placeholder="Keep existing reasons" type="text" value={batchReason} /></label>
              <button disabled={!selectedDates.length || (!batchHours && !batchReason.trim())} onClick={applyBatchValues} type="button">Apply</button>
              {periodType === 'monthly' ? (
                <button disabled={!activeDate || selectedDates.indexOf(activeDate) < 1} onClick={copyPreviousEntry} title="Copy previous selected entry" type="button">
                  <Copy size={14} />Copy previous
                </button>
              ) : null}
            </div>
          </section>

          <aside className="plan-editor-summary">
            <div className="plan-editor-summary__title">
              <CheckCircle2 size={18} aria-hidden="true" />
              <div><h2>Plan summary</h2><small>Saved as an employee draft</small></div>
            </div>
            <dl>
              <div><dt>Selected dates</dt><dd>{selectedDates.length}</dd></div>
              <div><dt>Planned hours</dt><dd>{totalHours.toLocaleString('en', { maximumFractionDigits: 2 })}</dd></div>
              <div><dt>Period</dt><dd>{periodType === 'weekly' ? 'Weekly' : 'Monthly'}</dd></div>
            </dl>
            <label className="plan-editor-remarks">
              <span>Plan remarks <small>Optional</small></span>
              <textarea
                maxLength="1000"
                onChange={(event) => {
                  setRemarks(event.target.value)
                  setHasUnsavedChanges(true)
                }}
                placeholder="General notes for this overtime plan"
                rows="5"
                value={remarks}
              />
            </label>
            {formError ? (
              <div className="plan-editor-error" role="alert">
                <AlertCircle size={15} />
                <span>{formError}</span>
                {hasVersionConflict ? (
                  <button onClick={reloadLatestPlan} type="button">
                    <RefreshCw size={13} />Reload latest
                  </button>
                ) : null}
              </div>
            ) : null}
            <button className="plan-editor-save" disabled={isSaving || hasVersionConflict} type="submit">
              {isSaving ? <RefreshCw className="plan-editor-spin" size={16} /> : <Save size={16} />}
              {isSaving ? 'Saving plan...' : isEditing ? 'Save changes' : 'Create draft plan'}
            </button>
            <Link className="plan-editor-cancel" to={isEditing ? `/employee/plans/${encodeURIComponent(planId)}` : '/employee/plans'}>Cancel</Link>
            <div className="plan-editor-summary__note"><Clock3 size={14} /><span>You can submit the plan after reviewing the saved draft.</span></div>
          </aside>
        </div>
      </form>
    </main>
  )
}
