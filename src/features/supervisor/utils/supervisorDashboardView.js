import {
  addDays,
  getPeriodDays,
  getWeekPeriod,
  parseDateValue,
  toDateValue,
} from './weekPeriod.js'

const ACTIVE_DEPARTMENT_STATUSES = new Set([
  'draft',
  'pending_approval',
  'returned_for_revision',
])

const STATE_PRIORITY = {
  accepted_signed: 1,
  submitted_signed: 4,
  submitted_unsigned: 5,
  returned: 6,
  draft: 3,
  not_submitted: 0,
}

export function isSignedSubmission(plan) {
  return Boolean(plan.signature && ['submitted_to_supervisor', 'supervisor_accepted'].includes(plan.status))
}

function inRange(date, range) {
  return !range || (date >= range.dateFrom && date <= range.dateTo)
}

export function getDashboardRange(mode, anchorDate) {
  if (mode === 'week') {
    const week = getWeekPeriod(anchorDate)
    return {
      dateFrom: week.periodStartDate,
      dateTo: week.periodEndDate,
      labelType: 'week',
    }
  }

  const anchor = parseDateValue(anchorDate)
  const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const monthEnd = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
  return {
    dateFrom: toDateValue(monthStart),
    dateTo: toDateValue(monthEnd),
    labelType: 'month',
  }
}

export function getPreparationPeriods(mode, anchorDate) {
  const range = getDashboardRange(mode, anchorDate)
  if (mode === 'week') {
    const months = [...new Set([range.dateFrom.slice(0, 7), range.dateTo.slice(0, 7)])]
    return [{
      periodType: 'weekly',
      periodStartDate: range.dateFrom,
      periodEndDate: range.dateTo,
    }, ...months.map((month) => {
      const monthly = getDashboardRange('month', `${month}-01`)
      return { periodType: 'monthly', periodStartDate: monthly.dateFrom, periodEndDate: monthly.dateTo }
    })]
  }

  const periods = [{
    periodType: 'monthly',
    periodStartDate: range.dateFrom,
    periodEndDate: range.dateTo,
  }]
  let weekStart = getWeekPeriod(range.dateFrom).periodStartDate

  while (weekStart <= range.dateTo && periods.length < 8) {
    const week = getWeekPeriod(weekStart)
    periods.push({
      periodType: 'weekly',
      periodStartDate: week.periodStartDate,
      periodEndDate: week.periodEndDate,
    })
    weekStart = toDateValue(addDays(weekStart, 7))
  }

  return periods
}

function planKey(employeeId, plan) {
  return `${employeeId}:${plan.planId}`
}

export function combinePreparationDashboards(dashboards = [], range) {
  const employeeMap = new Map()
  const planMap = new Map()
  const departmentPlanMap = new Map()

  dashboards.forEach((dashboard) => {
    if (dashboard?.departmentPlan) {
      departmentPlanMap.set(dashboard.departmentPlan.planId, {
        ...dashboard.departmentPlan,
        periodEndDate: dashboard.periodEndDate,
        periodStartDate: dashboard.periodStartDate,
        periodType: dashboard.periodType,
      })
    }

    ;(dashboard?.employees || []).forEach((employee) => {
      const current = employeeMap.get(employee.employeeId) || {
        ...employee,
        hasSignedSubmission: false,
        planCount: 0,
        plans: [],
        plannedHours: 0,
        submissionState: 'not_submitted',
      }

      if (employee.plan) {
        const key = planKey(employee.employeeId, employee.plan)
        if (!planMap.has(key)) {
          const plan = {
            ...employee.plan,
            employeeId: employee.employeeId,
            employeeName: employee.employeeName,
            periodEndDate: dashboard.periodEndDate,
            periodStartDate: dashboard.periodStartDate,
            periodType: dashboard.periodType,
            submissionState: employee.submissionState,
          }
          plan.items = (plan.items || []).filter((item) => inRange(item.plannedDate, range))
          plan.plannedHours = plan.items.reduce((sum, item) => sum + Number(item.plannedHours || 0), 0)
          planMap.set(key, plan)
          current.plans.push(plan)
          current.planCount += 1
          current.plannedHours += Number(plan.plannedHours || 0)
        }
      }

      current.hasSignedSubmission = current.hasSignedSubmission || Boolean(employee.plan && isSignedSubmission(employee.plan))
      current.eligibleForDepartmentPlan = current.eligibleForDepartmentPlan || employee.eligibleForDepartmentPlan
      if ((STATE_PRIORITY[employee.submissionState] || 0) > (STATE_PRIORITY[current.submissionState] || 0)) {
        current.submissionState = employee.submissionState
      }
      employeeMap.set(employee.employeeId, current)
    })
  })

  const employees = [...employeeMap.values()].sort((left, right) => (
    left.employeeName.localeCompare(right.employeeName)
  ))
  const plans = [...planMap.values()]
  const weeks = [...new Map(dashboards.filter((dashboard) => dashboard?.periodType === 'weekly')
    .map((dashboard) => [dashboard.periodStartDate, dashboard])).values()]
  employees.forEach((employee) => {
    const signed = employee.plans.filter(isSignedSubmission)
    employee.coveredWeeks = weeks.filter((week) => {
      const days = getPeriodDays(week.periodStartDate, week.periodEndDate).filter((day) => inRange(day.date, range))
      return days.length && days.every((day) => signed.some((plan) => day.date >= plan.periodStartDate && day.date <= plan.periodEndDate))
    }).length
    employee.totalWeeks = weeks.length
    employee.coverageGap = employee.coveredWeeks < employee.totalWeeks
  })
  const departmentPlans = [...departmentPlanMap.values()].sort((left, right) => (
    String(right.updatedAt || right.createdAt || '').localeCompare(
      String(left.updatedAt || left.createdAt || ''),
    )
  ))

  return {
    acceptedCount: plans.filter((plan) => plan.status === 'supervisor_accepted').length,
    activeDepartmentPlan: departmentPlans.find((plan) => ACTIVE_DEPARTMENT_STATUSES.has(plan.status)) || null,
    activeDepartmentPlans: departmentPlans.filter((plan) => ACTIVE_DEPARTMENT_STATUSES.has(plan.status)),
    departmentPlans,
    employees,
    includedPlannedHours: plans
      .filter(isSignedSubmission)
      .reduce((sum, plan) => sum + Number(plan.plannedHours || 0), 0),
    notSubmittedCount: employees.filter((employee) => !employee.hasSignedSubmission).length,
    plans,
    returnedCount: plans.filter((plan) => plan.status === 'supervisor_returned').length,
    signedSubmissionCount: plans.filter(isSignedSubmission).length,
    awaitingReview: plans.filter((plan) => plan.status === 'submitted_to_supervisor' && plan.signature),
    returnedPlans: plans.filter((plan) => ['supervisor_returned', 'returned_for_revision'].includes(plan.status)),
    unsignedPlans: plans.filter((plan) => ['submitted_to_supervisor', 'supervisor_accepted'].includes(plan.status) && !plan.signature),
    submittedCount: plans.filter((plan) => (
      ['submitted_to_supervisor', 'supervisor_accepted'].includes(plan.status)
    )).length,
    totalEmployees: employees.length,
    coveredWeeks: employees.reduce((sum, employee) => sum + employee.coveredWeeks, 0),
    totalWeeks: employees.reduce((sum, employee) => sum + employee.totalWeeks, 0),
    coverageGaps: employees.filter((employee) => employee.coverageGap).length,
  }
}

export function buildDashboardChartData({ actualEntries = [], preparation, range, mode }) {
  const signedPlans = preparation?.plans.filter(isSignedSubmission) || []
  const acceptedPlans = signedPlans.filter((plan) => plan.status === 'supervisor_accepted')
  const formatter = new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    weekday: 'short',
  })

  return getPeriodDays(range.dateFrom, range.dateTo).map((day) => {
    const planned = signedPlans.flatMap((plan) => plan.items || [])
      .filter((item) => item.plannedDate === day.date)
      .reduce((sum, item) => sum + Number(item.plannedHours || 0), 0)
    const accepted = acceptedPlans.flatMap((plan) => plan.items || [])
      .filter((item) => item.plannedDate === day.date)
      .reduce((sum, item) => sum + Number(item.plannedHours || 0), 0)
    const actual = actualEntries
      .filter((entry) => entry.actualDate === day.date)
      .reduce((sum, entry) => sum + Number(entry.actualHours || 0), 0)

    return {
      accepted,
      actual,
      date: day.date,
      fullLabel: formatter.format(parseDateValue(day.date)),
      planned,
      tick: mode === 'month'
        ? String(parseDateValue(day.date).getDate())
        : day.dayLabel,
    }
  })
}

export function summarizeDashboardActual(entries = [], range) {
  const seen = new Set()
  const selectedEntries = entries.filter((entry) => {
    if (!inRange(entry.actualDate, range)) return false
    if (entry.actualEntryId && seen.has(entry.actualEntryId)) return false
    if (entry.actualEntryId) seen.add(entry.actualEntryId)
    return true
  })
  return selectedEntries.reduce((summary, entry) => {
    const actual = Number(entry.actualHours || 0)
    const planned = Number(entry.plannedHours || 0)
    summary.actualHours += actual
    summary.plannedHours += planned
    summary.pendingCount += Number(Boolean(entry.isPending))
    // Today's untouched entries are pending, not a shortfall against the plan.
    summary.varianceHours += entry.isPending ? 0 : Number(entry.varianceHours ?? actual - planned)
    return summary
  }, { entries: selectedEntries, actualHours: 0, plannedHours: 0, varianceHours: 0, pendingCount: 0 })
}

export function buildDashboardWorkload(preparation, entries = []) {
  const rows = new Map(preparation.employees.map((employee) => [employee.employeeId, {
    employeeId: employee.employeeId,
    employeeName: employee.employeeName,
    planned: employee.plans.filter(isSignedSubmission).reduce((sum, plan) => sum + plan.plannedHours, 0),
    actual: 0,
  }]))
  entries.forEach((entry) => {
    const row = rows.get(entry.employeeId) || {
      employeeId: entry.employeeId,
      employeeName: entry.employeeName || 'Employee',
      planned: 0,
      actual: 0,
    }
    row.actual += Number(entry.actualHours || 0)
    rows.set(entry.employeeId, row)
  })
  return [...rows.values()].sort((a, b) => Math.max(b.planned, b.actual) - Math.max(a.planned, a.actual)
    || a.employeeName.localeCompare(b.employeeName))
}

export function getDashboardWorkflow(plan, approvals = []) {
  if (!plan) return { progress: 0, steps: [] }
  const needsSubmission = ['draft', 'returned_for_revision'].includes(plan.status)
  const steps = [{ id: 'prepared', label: 'Draft prepared', status: 'approved' }, {
    id: 'submitted', label: 'Submitted for approval', status: needsSubmission ? 'pending' : 'approved',
  }, ...approvals.map((step, index) => ({
    id: step.approvalId || `approval-${index}`,
    label: step.stepName || String(step.approverRole || 'Approval').replaceAll('_', ' '),
    status: step.status,
  }))]
  if (!approvals.length) steps.push({ id: 'final', label: 'Final approval', status: 'waiting' })
  const complete = steps.filter((step) => step.status === 'approved').length
  return {
    steps,
    progress: needsSubmission ? 0 : Math.min(99, Math.round(complete / steps.length * 100)),
  }
}

export function moveDashboardAnchor(mode, anchorDate, direction) {
  if (mode === 'week') return toDateValue(addDays(anchorDate, direction * 7))
  const anchor = parseDateValue(anchorDate)
  return toDateValue(new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1))
}
