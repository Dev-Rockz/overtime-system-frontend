import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AlertCircle,
  BadgeCheck,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Signature,
  UsersRound,
} from 'lucide-react'
import { supervisorApi } from '../../../api/supervisorApi.js'
import { ApprovedPlanRecord } from '../components/ApprovedPlanRecord.jsx'
import { DepartmentPlanMatrix } from '../components/DepartmentPlanMatrix.jsx'
import {
  formatWeek,
  getPeriodDays,
  getWeekPeriod,
  parseDateValue,
  toDateValue,
} from '../utils/weekPeriod.js'
import './supervisorApprovedDepartmentPlansPage.css'

function getSelectedRange(viewMode, anchorDate) {
  if (viewMode === 'week') return getWeekPeriod(anchorDate)
  return {
    periodStartDate: toDateValue(new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1)),
    periodEndDate: toDateValue(new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0)),
  }
}

function displayHours(value) {
  const hours = Number(value || 0)
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1)
}

function formatDate(value) {
  if (!value) return 'Not recorded'
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function formatRange(viewMode, range) {
  if (viewMode === 'week') return formatWeek(range.periodStartDate, range.periodEndDate)
  return new Intl.DateTimeFormat('en', {
    month: 'long',
    year: 'numeric',
  }).format(parseDateValue(range.periodStartDate))
}

function buildEmployeeRows(plan, dashboard) {
  const itemsByEmployee = new Map()
  ;(plan?.items || []).forEach((item) => {
    const items = itemsByEmployee.get(item.employeeId) || []
    items.push(item)
    itemsByEmployee.set(item.employeeId, items)
  })

  const dashboardByEmployee = new Map(
    (dashboard?.employees || []).map((employee) => [employee.employeeId, employee]),
  )

  return [...itemsByEmployee.entries()].map(([employeeId, matrixItems]) => {
    const employee = dashboardByEmployee.get(employeeId)
    const firstItem = matrixItems[0] || {}
    const signature = employee?.plan?.signature || null
    return {
      employeeId,
      employeeName: employee?.employeeName || firstItem.employeeName || employeeId,
      employeeNo: employee?.employeeNo || firstItem.employeeNo || '',
      matrixItems,
      rowState: 'included',
      signature,
      statusLabel: signature ? 'Included and signed' : 'Signature unavailable',
    }
  })
}

export function SupervisorApprovedDepartmentPlansPage() {
  const today = useMemo(() => new Date(), [])
  const [anchorDate, setAnchorDate] = useState(today)
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [viewMode, setViewMode] = useState('week')
  const range = useMemo(() => getSelectedRange(viewMode, anchorDate), [anchorDate, viewMode])
  const approvedPlansQuery = useQuery({
    queryKey: [
      'supervisor',
      'approved-department-plans',
      viewMode,
      range.periodStartDate,
      range.periodEndDate,
    ],
    queryFn: () => supervisorApi.listDepartmentApprovalPlans({
      dateFrom: range.periodStartDate,
      dateTo: range.periodEndDate,
      limit: 100,
      status: 'approved',
    }),
  })
  const approvedPlans = useMemo(
    () => (approvedPlansQuery.data || []).filter((plan) => plan.status === 'approved'),
    [approvedPlansQuery.data],
  )

  useEffect(() => {
    if (!approvedPlans.some((plan) => plan.planId === selectedPlanId)) {
      setSelectedPlanId(approvedPlans[0]?.planId || '')
    }
  }, [approvedPlans, selectedPlanId])

  const selectedPlanSummary = approvedPlans.find((plan) => plan.planId === selectedPlanId)
  const planQuery = useQuery({
    queryKey: ['supervisor', 'approved-department-plan', selectedPlanId],
    queryFn: () => supervisorApi.getDepartmentPlan(selectedPlanId),
    enabled: Boolean(selectedPlanId),
  })
  const plan = planQuery.data
  const dashboardQuery = useQuery({
    queryKey: ['supervisor', 'approved-department-plan-employees', selectedPlanId],
    queryFn: () => supervisorApi.getDepartmentPreparation({
      periodType: plan.periodType,
      periodStartDate: plan.periodStartDate,
      periodEndDate: plan.periodEndDate,
    }),
    enabled: Boolean(plan),
  })
  const employeeRows = useMemo(
    () => buildEmployeeRows(plan, dashboardQuery.data),
    [dashboardQuery.data, plan],
  )
  const signatureCount = employeeRows.filter((employee) => employee.signature).length
  const isRefreshing = approvedPlansQuery.isFetching || planQuery.isFetching || dashboardQuery.isFetching

  function changeViewMode(nextMode) {
    setViewMode(nextMode)
    setSelectedPlanId('')
  }

  function shiftPeriod(amount) {
    setAnchorDate((current) => {
      if (viewMode === 'month') {
        return new Date(current.getFullYear(), current.getMonth() + amount, 1)
      }
      const next = new Date(current)
      next.setDate(next.getDate() + (amount * 7))
      return next
    })
    setSelectedPlanId('')
  }

  async function refreshPage() {
    const requests = [approvedPlansQuery.refetch()]
    if (selectedPlanId) requests.push(planQuery.refetch())
    if (plan) requests.push(dashboardQuery.refetch())
    await Promise.all(requests)
  }

  return (
    <main className="supervisor-main approved-department-page">
      <header className="approved-department__header">
        <div>
          <span>Final-approved archive</span>
          <h1>Overtime department plan</h1>
          <p>Employee overtime hours and verified submission signatures</p>
        </div>
        <button
          aria-label="Refresh approved department plans"
          disabled={isRefreshing}
          onClick={refreshPage}
          title="Refresh"
          type="button"
        >
          <RefreshCw className={isRefreshing ? 'approved-department__spin' : ''} size={16} aria-hidden="true" />
        </button>
      </header>

      <section className="approved-period-filter" aria-label="Approved department plan period">
        <div className="approved-period-filter__modes" role="group" aria-label="Period view">
          <button aria-pressed={viewMode === 'week'} onClick={() => changeViewMode('week')} type="button">Week</button>
          <button aria-pressed={viewMode === 'month'} onClick={() => changeViewMode('month')} type="button">Month</button>
        </div>

        <div className="approved-period-filter__range">
          <button aria-label={`Previous ${viewMode}`} onClick={() => shiftPeriod(-1)} title={`Previous ${viewMode}`} type="button">
            <ChevronLeft size={17} aria-hidden="true" />
          </button>
          <div>
            <CalendarRange size={17} aria-hidden="true" />
            <span><small>Selected {viewMode}</small><strong>{formatRange(viewMode, range)}</strong></span>
          </div>
          <button aria-label={`Next ${viewMode}`} onClick={() => shiftPeriod(1)} title={`Next ${viewMode}`} type="button">
            <ChevronRight size={17} aria-hidden="true" />
          </button>
        </div>

        <button className="approved-period-filter__today" onClick={() => setAnchorDate(today)} type="button">Today</button>

        <div className="approved-period-filter__selection">
          <span><strong>{approvedPlans.length}</strong><small>approved {approvedPlans.length === 1 ? 'plan' : 'plans'}</small></span>
          {approvedPlans.length > 1 ? (
            <label>
              <span className="approved-visually-hidden">Select approved plan</span>
              <select onChange={(event) => setSelectedPlanId(event.target.value)} value={selectedPlanId}>
                {approvedPlans.map((approvedPlan) => (
                  <option key={approvedPlan.planId} value={approvedPlan.planId}>
                    {formatWeek(approvedPlan.periodStartDate, approvedPlan.periodEndDate)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </section>

      {approvedPlansQuery.isLoading ? (
        <div className="approved-plan-detail approved-plan-detail--loading" aria-label="Loading approved department plan">
          <span /><span /><span /><span />
        </div>
      ) : null}

      {approvedPlansQuery.isError ? (
        <div className="approved-department__state approved-department__state--error" role="alert">
          <AlertCircle size={22} aria-hidden="true" />
          <div><strong>Unable to load approved plans</strong><span>{approvedPlansQuery.error.message}</span></div>
          <button onClick={() => approvedPlansQuery.refetch()} type="button">Retry</button>
        </div>
      ) : null}

      {approvedPlansQuery.isSuccess && !approvedPlans.length ? (
        <div className="approved-department__state approved-department__state--empty">
          <CalendarRange size={23} aria-hidden="true" />
          <div><strong>No final-approved plan in this {viewMode}</strong><span>Use the arrows or switch the period view.</span></div>
        </div>
      ) : null}

      {selectedPlanSummary ? (
        <section className="approved-plan-detail" aria-labelledby="approved-plan-detail-title">
          <header>
            <div>
              <span>Selected approved plan</span>
              <h2 id="approved-plan-detail-title">{formatWeek(selectedPlanSummary.periodStartDate, selectedPlanSummary.periodEndDate)}</h2>
              <p>{selectedPlanSummary.departmentName || selectedPlanSummary.departmentId}</p>
            </div>
            <span className="approved-plan-detail__status"><BadgeCheck size={14} aria-hidden="true" /> Final approved</span>
          </header>

          <dl className="approved-plan-detail__summary">
            <div><dt><UsersRound size={14} aria-hidden="true" /> Employees</dt><dd>{employeeRows.length || selectedPlanSummary.employeeCount || 0}</dd></div>
            <div><dt><CalendarRange size={14} aria-hidden="true" /> OT entries</dt><dd>{plan?.items?.length ?? selectedPlanSummary.itemCount ?? 0}</dd></div>
            <div><dt>Planned hours</dt><dd>{displayHours(plan?.plannedHours ?? selectedPlanSummary.plannedHours)}h</dd></div>
            <div><dt><Signature size={14} aria-hidden="true" /> Verified signatures</dt><dd>{signatureCount}/{employeeRows.length || selectedPlanSummary.employeeCount || 0}</dd></div>
            <div><dt>Final approval</dt><dd>{formatDate(selectedPlanSummary.approvedAt)}</dd></div>
          </dl>

          {planQuery.isLoading || dashboardQuery.isLoading ? (
            <div className="approved-plan-detail__matrix-loading" aria-label="Loading approved plan employee signatures"><span /><span /><span /></div>
          ) : null}
          {planQuery.isError || dashboardQuery.isError ? (
            <div className="approved-department__state approved-department__state--error" role="alert">
              <AlertCircle size={22} aria-hidden="true" />
              <div><strong>Unable to load employee signatures</strong><span>{planQuery.error?.message || dashboardQuery.error?.message}</span></div>
              <button onClick={() => refreshPage()} type="button">Retry</button>
            </div>
          ) : null}
          {plan && dashboardQuery.isSuccess && employeeRows.length ? (
            <DepartmentPlanMatrix
              days={getPeriodDays(plan.periodStartDate, plan.periodEndDate)}
              rows={employeeRows}
              showDailyTotals
            />
          ) : null}
          {plan && dashboardQuery.isSuccess && !employeeRows.length ? (
            <div className="approved-department__state approved-department__state--empty">
              <Signature size={22} aria-hidden="true" />
              <div><strong>No employee signature records found</strong><span>The approved plan contains no accessible employee entries.</span></div>
            </div>
          ) : null}
          {plan ? <ApprovedPlanRecord logs={plan.logs} remarks={plan.remarks} /> : null}
        </section>
      ) : null}
    </main>
  )
}
