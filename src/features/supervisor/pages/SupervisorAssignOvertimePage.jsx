import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  CalendarDays,
  CalendarPlus2,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileSignature,
  ListChecks,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { supervisorApi } from '../../../api/supervisorApi.js'
import { useToast } from '../../../components/shared/toast/useToast.js'
import {
  addDays,
  getPeriodDays,
  getWeekPeriod,
  parseDateValue,
  toDateValue,
} from '../utils/weekPeriod.js'
import './supervisorAssignOvertimePage.css'

const BLOCKING_EMPLOYEE_STATUSES = new Set([
  'submitted',
  'submitted_to_supervisor',
  'supervisor_returned',
  'supervisor_accepted',
  'pending_approval',
  'returned_for_revision',
  'approved',
  'closed',
])

function getMonthPeriod(anchorDate) {
  const anchor = parseDateValue(anchorDate)
  const firstDay = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const lastDay = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
  return {
    periodStartDate: toDateValue(firstDay),
    periodEndDate: toDateValue(lastDay),
  }
}

function formatPeriod(period, periodType) {
  const formatter = new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
  if (periodType === 'monthly') {
    return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' })
      .format(parseDateValue(period.periodStartDate))
  }
  return `${formatter.format(parseDateValue(period.periodStartDate))} - ${formatter.format(parseDateValue(period.periodEndDate))}`
}

function displayHours(value) {
  const hours = Number(value || 0)
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1)
}

function getInitials(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'E'
}

function cellKey(employeeId, date) {
  return `${employeeId}|${date}`
}

function EditorLoading() {
  return (
    <div className="assign-ot__loading" aria-label="Loading overtime assignment calendar" role="status">
      <span /><span /><span /><span /><span />
    </div>
  )
}

function SubmissionDialog({ isPending, onClose, onConfirm, summary }) {
  return (
    <div className="assign-ot-dialog__backdrop" role="presentation">
      <section aria-labelledby="assign-ot-dialog-title" aria-modal="true" className="assign-ot-dialog" role="dialog">
        <header>
          <div><span>Assignment review</span><h2 id="assign-ot-dialog-title">Send employee plans to review</h2></div>
          <button aria-label="Close submission confirmation" disabled={isPending} onClick={onClose} type="button"><X size={18} aria-hidden="true" /></button>
        </header>
        <dl>
          <div><dt>Employees</dt><dd>{summary.employeeCount}</dd></div>
          <div><dt>Entries</dt><dd>{summary.entryCount}</dd></div>
          <div><dt>Total hours</dt><dd>{displayHours(summary.totalHours)}h</dd></div>
          <div><dt>Period</dt><dd>{summary.periodLabel}</dd></div>
        </dl>
        <div className="assign-ot-dialog__signature">
          <span><FileSignature size={20} aria-hidden="true" /></span>
          <div><strong>Employee signature records</strong><small>Each employee's saved signature will be recorded as applied by the supervisor on their behalf.</small></div>
          <Check size={16} aria-hidden="true" />
        </div>
        <footer>
          <button className="assign-ot-dialog__cancel" disabled={isPending} onClick={onClose} type="button">Cancel</button>
          <button disabled={isPending} onClick={onConfirm} type="button"><Send size={15} aria-hidden="true" />{isPending ? 'Assigning...' : 'Confirm assignment'}</button>
        </footer>
      </section>
    </div>
  )
}

function WithdrawalDialog({ count, isPending, mode, onClose, onConfirm }) {
  return (
    <div className="assign-ot-dialog__backdrop" role="presentation">
      <section aria-labelledby="withdraw-bulk-title" aria-modal="true" className="assign-ot-dialog assign-ot-withdraw-dialog" role="dialog">
        <header>
          <div><span>Permanent correction</span><h2 id="withdraw-bulk-title">Withdraw employee submissions?</h2></div>
          <button aria-label="Close withdrawal confirmation" disabled={isPending} onClick={onClose} type="button"><X size={18} aria-hidden="true" /></button>
        </header>
        <div className="assign-ot-withdraw-dialog__body">
          <span><Trash2 size={19} aria-hidden="true" /></span>
          <div>
            <strong>{count} {count === 1 ? 'submission' : 'submissions'} will be removed</strong>
            <p>{mode === 'all' ? 'Every eligible supervisor-created submission in this period' : 'Only the selected employee submissions'} will be withdrawn and permanently deleted. Accepted plans are protected.</p>
          </div>
        </div>
        <footer>
          <button className="assign-ot-dialog__cancel" disabled={isPending} onClick={onClose} type="button">Keep submissions</button>
          <button className="assign-ot-withdraw-dialog__confirm" disabled={isPending} onClick={onConfirm} type="button"><Trash2 size={15} aria-hidden="true" />{isPending ? 'Withdrawing...' : 'Withdraw and delete'}</button>
        </footer>
      </section>
    </div>
  )
}

export function SupervisorAssignOvertimePage() {
  const today = useMemo(() => toDateValue(new Date()), [])
  const [periodType, setPeriodType] = useState('weekly')
  const [anchorDate, setAnchorDate] = useState(today)
  const [hoursByCell, setHoursByCell] = useState({})
  const [remarks, setRemarks] = useState('')
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false)
  const [selectedWithdrawalIds, setSelectedWithdrawalIds] = useState(() => new Set())
  const [withdrawalMode, setWithdrawalMode] = useState('')
  const loadedEditorKey = useRef('')
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const toast = useToast()
  const period = useMemo(() => (
    periodType === 'weekly' ? getWeekPeriod(anchorDate) : getMonthPeriod(anchorDate)
  ), [anchorDate, periodType])
  const days = useMemo(() => (
    getPeriodDays(period.periodStartDate, period.periodEndDate)
  ), [period.periodEndDate, period.periodStartDate])
  const periodLabel = formatPeriod(period, periodType)

  const teamQuery = useQuery({
    queryKey: ['supervisor', 'team'],
    queryFn: supervisorApi.listMyTeam,
  })
  const periodQueryKey = [
    'supervisor',
    'bulk-overtime-period',
    periodType,
    period.periodStartDate,
    period.periodEndDate,
  ]
  const periodQuery = useQuery({
    queryKey: periodQueryKey,
    queryFn: () => supervisorApi.getDepartmentPreparation({ periodType, ...period }),
  })
  const existingPlan = periodQuery.data?.departmentPlan || null
  const employees = teamQuery.data || []
  const editorReady = periodQuery.isSuccess
  const periodEmployeesById = useMemo(() => new Map(
    (periodQuery.data?.employees || []).map((employee) => [employee.employeeId, employee]),
  ), [periodQuery.data?.employees])
  const existingEmployeePlans = useMemo(() => new Map(
    (periodQuery.data?.employees || [])
      .filter((employee) => employee.plan)
      .map((employee) => [employee.employeeId, employee.plan]),
  ), [periodQuery.data?.employees])
  const blockedEmployeeIds = useMemo(() => new Set(
    [...existingEmployeePlans.entries()]
      .filter(([, plan]) => BLOCKING_EMPLOYEE_STATUSES.has(plan.status))
      .map(([employeeId]) => employeeId),
  ), [existingEmployeePlans])
  const withdrawableEmployees = useMemo(() => (
    (periodQuery.data?.employees || []).filter(
      (employee) => employee.canSupervisorBulkWithdraw,
    )
  ), [periodQuery.data?.employees])
  const withdrawableEmployeeIds = useMemo(() => new Set(
    withdrawableEmployees.map((employee) => employee.employeeId),
  ), [withdrawableEmployees])

  useEffect(() => {
    if (!editorReady) return
    const editorKey = `${periodType}:${period.periodStartDate}:${period.periodEndDate}`
    if (loadedEditorKey.current === editorKey) return

    loadedEditorKey.current = editorKey
    setHoursByCell(Object.fromEntries(
      [],
    ))
    setRemarks('')
    setSelectedWithdrawalIds(new Set())
  }, [editorReady, period.periodEndDate, period.periodStartDate, periodType])

  const items = useMemo(() => (
    Object.entries(hoursByCell).flatMap(([key, value]) => {
      const plannedHours = Number(value)
      if (!Number.isFinite(plannedHours) || plannedHours <= 0) return []
      const [employeeId, plannedDate] = key.split('|')
      return [{ employeeId, plannedDate, plannedHours }]
    })
  ), [hoursByCell])
  const existingDisplayItems = useMemo(() => (
    [...existingEmployeePlans.entries()].flatMap(([employeeId, plan]) => (
      blockedEmployeeIds.has(employeeId)
        ? (plan.items || []).map((item) => ({
            employeeId,
            plannedDate: item.plannedDate,
            plannedHours: Number(item.plannedHours || 0),
          }))
        : []
    ))
  ), [blockedEmployeeIds, existingEmployeePlans])
  const displayItems = useMemo(
    () => [...existingDisplayItems, ...items],
    [existingDisplayItems, items],
  )
  const assignedEmployeeIds = useMemo(() => (
    new Set(items.map((item) => item.employeeId))
  ), [items])
  const dailyTotals = useMemo(() => new Map(days.map((day) => [
    day.date,
    displayItems
      .filter((item) => item.plannedDate === day.date)
      .reduce((total, item) => total + item.plannedHours, 0),
  ])), [days, displayItems])
  const newTotalHours = items.reduce((total, item) => total + item.plannedHours, 0)
  const periodTotalHours = displayItems.reduce((total, item) => total + item.plannedHours, 0)
  const isExistingPlanEditable = !existingPlan
  const isLoading = teamQuery.isLoading || periodQuery.isLoading
  const hasLoadError = teamQuery.isError || periodQuery.isError
  const loadError = teamQuery.error || periodQuery.error
  const canSubmit = Boolean(
    editorReady
    && employees.length
    && items.length
    && remarks.trim()
    && isExistingPlanEditable
  )

  const submitMutation = useMutation({
    mutationFn: async () => {
      return supervisorApi.assignBulkEmployeePlans({
        items,
        remarks: remarks.trim(),
        periodType,
        ...period,
      })
    },
    onSuccess: async () => {
      setIsConfirmationOpen(false)
      toast.success('Employee overtime assigned and sent to supervisor review.')
      await queryClient.invalidateQueries({ queryKey: ['supervisor'] })
      navigate('/supervisor/department-plans')
    },
    onError: (error) => {
      setIsConfirmationOpen(false)
      toast.error(error.message)
    },
  })
  const withdrawalMutation = useMutation({
    mutationFn: (mode) => supervisorApi.withdrawBulkEmployeePlans({
      allEmployees: mode === 'all',
      employeeIds: mode === 'selected' ? [...selectedWithdrawalIds] : undefined,
      periodType,
      ...period,
    }),
    onSuccess: async (result) => {
      setWithdrawalMode('')
      setSelectedWithdrawalIds(new Set())
      toast.success(`${result.deletedCount} employee ${result.deletedCount === 1 ? 'submission' : 'submissions'} withdrawn and deleted.`)
      await queryClient.invalidateQueries({ queryKey: ['supervisor'] })
    },
    onError: (error) => {
      setWithdrawalMode('')
      toast.error(error.message)
    },
  })

  function movePeriod(offset) {
    if (periodType === 'weekly') {
      setAnchorDate(toDateValue(addDays(period.periodStartDate, offset * 7)))
      return
    }
    const current = parseDateValue(period.periodStartDate)
    setAnchorDate(toDateValue(new Date(current.getFullYear(), current.getMonth() + offset, 1)))
  }

  function changePeriodType(nextType) {
    setPeriodType(nextType)
    loadedEditorKey.current = ''
  }

  function updateHours(employeeId, date, value) {
    setHoursByCell((current) => ({
      ...current,
      [cellKey(employeeId, date)]: value,
    }))
  }

  function refreshEditor() {
    loadedEditorKey.current = ''
    teamQuery.refetch()
    periodQuery.refetch()
  }

  function toggleWithdrawalEmployee(employeeId) {
    setSelectedWithdrawalIds((current) => {
      const next = new Set(current)
      if (next.has(employeeId)) next.delete(employeeId)
      else next.add(employeeId)
      return next
    })
  }

  function selectAllWithdrawable() {
    setSelectedWithdrawalIds(new Set(withdrawableEmployeeIds))
  }

  const summary = {
    employeeCount: assignedEmployeeIds.size,
    entryCount: items.length,
    periodLabel,
    totalHours: newTotalHours,
  }

  return (
    <main className="supervisor-main assign-ot-page">
      <header className="assign-ot__header">
        <div><span>Department schedule</span><h1>Assign overtime</h1></div>
        <button aria-label="Refresh overtime assignment" disabled={isLoading} onClick={refreshEditor} title="Refresh" type="button"><RefreshCw className={isLoading ? 'assign-ot__spin' : ''} size={16} aria-hidden="true" /></button>
      </header>

      <section className="assign-ot__toolbar" aria-label="Overtime period controls">
        <div className="assign-ot__mode" role="group" aria-label="Period type">
          <button className={periodType === 'weekly' ? 'is-active' : ''} onClick={() => changePeriodType('weekly')} type="button">Week</button>
          <button className={periodType === 'monthly' ? 'is-active' : ''} onClick={() => changePeriodType('monthly')} type="button">Month</button>
        </div>
        <div className="assign-ot__date-nav">
          <button aria-label={`Previous ${periodType === 'weekly' ? 'week' : 'month'}`} onClick={() => movePeriod(-1)} type="button"><ChevronLeft size={16} aria-hidden="true" /></button>
          <label><CalendarDays size={15} aria-hidden="true" /><input aria-label="Select overtime assignment date" onChange={(event) => setAnchorDate(event.target.value)} type="date" value={anchorDate} /></label>
          <button aria-label={`Next ${periodType === 'weekly' ? 'week' : 'month'}`} onClick={() => movePeriod(1)} type="button"><ChevronRight size={16} aria-hidden="true" /></button>
          <button className="assign-ot__today" disabled={anchorDate === today} onClick={() => setAnchorDate(today)} type="button">Today</button>
        </div>
        <div className="assign-ot__period"><span>Selected {periodType === 'weekly' ? 'week' : 'month'}</span><strong>{periodLabel}</strong></div>
      </section>

      <div className="assign-ot__summary" aria-label="Overtime assignment totals">
        <span><UsersRound size={15} aria-hidden="true" /><small>Assigned</small><strong>{assignedEmployeeIds.size} / {employees.length}</strong></span>
        <span><CalendarPlus2 size={15} aria-hidden="true" /><small>Entries</small><strong>{items.length}</strong></span>
        <span><Clock3 size={15} aria-hidden="true" /><small>Period hours</small><strong>{displayHours(periodTotalHours)}h</strong></span>
        <span className="is-ready"><FileSignature size={15} aria-hidden="true" /><small>Employee signatures</small><strong>Applied on assignment</strong></span>
      </div>

      {existingPlan && !isExistingPlanEditable ? (
        <div className="assign-ot__notice assign-ot__notice--locked" role="status"><ShieldCheck size={17} aria-hidden="true" /><span><strong>A department plan already exists</strong><small>Status: {existingPlan.status.replaceAll('_', ' ')}</small></span><Link to={`/supervisor/department-plans/${encodeURIComponent(existingPlan.planId)}`}>View plan</Link></div>
      ) : null}

      {!existingPlan && withdrawableEmployees.length ? (
        <section className="assign-ot__correction" aria-label="Bulk withdrawal controls">
          <span className="assign-ot__correction-icon"><ListChecks size={17} aria-hidden="true" /></span>
          <div><strong>Correct submitted assignments</strong><small>{withdrawableEmployees.length} supervisor-created {withdrawableEmployees.length === 1 ? 'submission is' : 'submissions are'} still awaiting your review.</small></div>
          <div className="assign-ot__correction-selection"><strong>{selectedWithdrawalIds.size}</strong><small>selected</small></div>
          <button className="assign-ot__correction-select" onClick={selectedWithdrawalIds.size === withdrawableEmployees.length ? () => setSelectedWithdrawalIds(new Set()) : selectAllWithdrawable} type="button">{selectedWithdrawalIds.size === withdrawableEmployees.length ? 'Clear' : 'Select all'}</button>
          <button className="assign-ot__correction-delete" disabled={!selectedWithdrawalIds.size} onClick={() => setWithdrawalMode('selected')} type="button"><Trash2 size={14} aria-hidden="true" />Withdraw selected</button>
          <button className="assign-ot__correction-delete assign-ot__correction-delete--all" onClick={() => setWithdrawalMode('all')} type="button">Withdraw all</button>
        </section>
      ) : null}

      {isLoading ? <EditorLoading /> : null}
      {hasLoadError ? (
        <div className="assign-ot__state" role="alert"><AlertCircle size={22} aria-hidden="true" /><span><strong>Unable to load assignment calendar</strong><small>{loadError.message}</small></span><button onClick={refreshEditor} type="button">Retry</button></div>
      ) : null}
      {!isLoading && !hasLoadError && !employees.length ? (
        <div className="assign-ot__state"><UsersRound size={22} aria-hidden="true" /><span><strong>No assigned employees</strong><small>Employees will appear after they are assigned to your supervision.</small></span></div>
      ) : null}

      {!isLoading && !hasLoadError && employees.length ? (
        <section className={`assign-ot__matrix-section${isExistingPlanEditable ? '' : ' is-locked'}`} aria-labelledby="assign-ot-matrix-title">
          <header><div><h2 id="assign-ot-matrix-title">Employee schedule</h2><span>{existingPlan ? 'Period already prepared' : 'New employee submissions'}</span></div><span><ShieldCheck size={14} aria-hidden="true" /> Sent to supervisor review</span></header>
          <div className="assign-ot__matrix-wrap">
            <table className="assign-ot__matrix" style={{ minWidth: `${430 + (days.length * 88)}px` }}>
              <thead><tr><th scope="col">Employee</th>{days.map((day) => <th key={day.date} scope="col"><strong>{day.dayLabel}</strong><span>{day.dateLabel}</span></th>)}<th scope="col">Total</th><th scope="col">Authorization</th></tr></thead>
              <tbody>
                {employees.map((employee) => {
                  const rowItems = displayItems.filter((item) => item.employeeId === employee.employeeId)
                  const rowHours = rowItems.reduce((total, item) => total + item.plannedHours, 0)
                  const existingEmployeePlan = existingEmployeePlans.get(employee.employeeId)
                  const isEmployeeBlocked = blockedEmployeeIds.has(employee.employeeId)
                  const canWithdrawEmployee = periodEmployeesById.get(employee.employeeId)?.canSupervisorBulkWithdraw
                  return (
                    <tr key={employee.employeeId}>
                      <th scope="row">
                        {canWithdrawEmployee ? <input aria-label={`Select ${employee.fullName} for withdrawal`} checked={selectedWithdrawalIds.has(employee.employeeId)} className="assign-ot__withdraw-check" onChange={() => toggleWithdrawalEmployee(employee.employeeId)} type="checkbox" /> : <span className="assign-ot__avatar" aria-hidden="true">{getInitials(employee.fullName)}</span>}
                        <span><strong>{employee.fullName}</strong><small>{employee.employeeNo || employee.position || 'Employee'}</small></span>
                      </th>
                      {days.map((day) => (
                        <td key={day.date}>
                          <label className="assign-ot__hours"><input aria-label={`${employee.fullName} hours for ${day.date}`} disabled={!isExistingPlanEditable || isEmployeeBlocked} inputMode="decimal" max="24" min="0" onChange={(event) => updateHours(employee.employeeId, day.date, event.target.value)} placeholder="-" step="0.5" type="number" value={isEmployeeBlocked ? rowItems.find((item) => item.plannedDate === day.date)?.plannedHours || '' : hoursByCell[cellKey(employee.employeeId, day.date)] || ''} /><span>h</span></label>
                        </td>
                      ))}
                      <td className="assign-ot__row-total"><strong>{displayHours(rowHours)}h</strong></td>
                      <td className="assign-ot__authorization"><span><ShieldCheck size={14} aria-hidden="true" /><strong>{isEmployeeBlocked ? 'Already submitted' : 'Employee signature'}</strong><small>{isEmployeeBlocked ? existingEmployeePlan.status.replaceAll('_', ' ') : 'Supervisor on behalf'}</small></span></td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot><tr><th scope="row">Daily total</th>{days.map((day) => <td key={day.date}><strong>{displayHours(dailyTotals.get(day.date))}h</strong></td>)}<td><strong>{displayHours(periodTotalHours)}h</strong></td><td><span>{displayItems.length} entries</span></td></tr></tfoot>
            </table>
          </div>
        </section>
      ) : null}

      {!isLoading && !hasLoadError && employees.length ? (
        <section className="assign-ot__submission" aria-labelledby="assign-ot-remarks-title">
          <label><span><FileSignature size={16} aria-hidden="true" /><strong id="assign-ot-remarks-title">Period remarks</strong><small>{remarks.length}/500</small></span><textarea disabled={!isExistingPlanEditable} maxLength="500" onChange={(event) => setRemarks(event.target.value)} placeholder="Enter the weekly or monthly overtime purpose" rows="3" value={remarks} /></label>
          <div><span><strong>{displayHours(newTotalHours)}h</strong><small>{assignedEmployeeIds.size} new employees, {items.length} new entries</small></span><button disabled={!canSubmit || submitMutation.isPending} onClick={() => setIsConfirmationOpen(true)} type="button"><Send size={16} aria-hidden="true" />Assign and send to review</button></div>
        </section>
      ) : null}

      {isConfirmationOpen ? <SubmissionDialog isPending={submitMutation.isPending} onClose={() => setIsConfirmationOpen(false)} onConfirm={() => submitMutation.mutate()} summary={summary} /> : null}
      {withdrawalMode ? <WithdrawalDialog count={withdrawalMode === 'all' ? withdrawableEmployees.length : selectedWithdrawalIds.size} isPending={withdrawalMutation.isPending} mode={withdrawalMode} onClose={() => setWithdrawalMode('')} onConfirm={() => withdrawalMutation.mutate(withdrawalMode)} /> : null}
    </main>
  )
}
