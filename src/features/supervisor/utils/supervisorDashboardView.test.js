import { describe, expect, test } from 'vitest'
import {
  buildDashboardChartData,
  combinePreparationDashboards,
  getDashboardRange,
  getPreparationPeriods,
  moveDashboardAnchor,
  summarizeDashboardActual,
  buildDashboardWorkload,
  getDashboardWorkflow,
} from './supervisorDashboardView.js'

function dashboard({ employeeId = 'EMP-001', plan = null, start, end }) {
  return {
    departmentPlan: null,
    employees: [{
      employeeId,
      employeeName: 'RTD Employee',
      employeeNo: 'EMP-001',
      eligibleForDepartmentPlan: plan?.status === 'supervisor_accepted',
      hasSignedSubmission: Boolean(plan?.signature),
      plan,
      submissionState: plan?.status === 'supervisor_accepted' ? 'accepted_signed' : 'not_submitted',
    }],
    periodEndDate: end,
    periodStartDate: start,
    periodType: 'weekly',
  }
}

describe('supervisor dashboard view helpers', () => {
  test('builds navigable week and month ranges', () => {
    expect(getDashboardRange('week', '2026-09-04')).toMatchObject({
      dateFrom: '2026-08-31',
      dateTo: '2026-09-06',
    })
    expect(getDashboardRange('month', '2026-09-04')).toMatchObject({
      dateFrom: '2026-09-01',
      dateTo: '2026-09-30',
    })
    expect(getPreparationPeriods('month', '2026-09-04')).toHaveLength(6)
    expect(moveDashboardAnchor('month', '2026-09-04', 1)).toBe('2026-10-01')
  })

  test('deduplicates plans while combining weekly dashboard responses', () => {
    const plan = {
      items: [{ plannedDate: '2026-09-01', plannedHours: 2 }],
      planId: 'PLAN-001',
      plannedHours: 2,
      signature: { signatureRecordId: 'SIG-001' },
      status: 'supervisor_accepted',
    }
    const combined = combinePreparationDashboards([
      dashboard({ plan, start: '2026-08-31', end: '2026-09-06' }),
      dashboard({ plan, start: '2026-08-31', end: '2026-09-06' }),
    ])

    expect(combined.totalEmployees).toBe(1)
    expect(combined.acceptedCount).toBe(1)
    expect(combined.includedPlannedHours).toBe(2)
    expect(combined.employees[0].planCount).toBe(1)
  })

  test('aggregates submitted, accepted, and actual hours per chart day', () => {
    const preparation = combinePreparationDashboards([dashboard({
      end: '2026-09-06',
      plan: {
        items: [{ plannedDate: '2026-09-01', plannedHours: 2 }],
        planId: 'PLAN-001',
        plannedHours: 2,
        signature: { signatureRecordId: 'SIG-001' },
        status: 'supervisor_accepted',
      },
      start: '2026-08-31',
    })])
    const points = buildDashboardChartData({
      actualEntries: [{ actualDate: '2026-09-01', actualHours: 2.5 }],
      mode: 'week',
      preparation,
      range: { dateFrom: '2026-08-31', dateTo: '2026-09-06' },
    })

    expect(points.find((point) => point.date === '2026-09-01')).toMatchObject({
      accepted: 2,
      actual: 2.5,
      planned: 2,
    })
  })

  test('clips boundary-week hours and excludes returned signatures from submitted totals', () => {
    const accepted = dashboard({ start: '2026-08-31', end: '2026-09-06', plan: {
      planId: 'ACCEPTED', status: 'supervisor_accepted', signature: {}, plannedHours: 10,
      items: [{ plannedDate: '2026-08-31', plannedHours: 8 }, { plannedDate: '2026-09-01', plannedHours: 2 }],
    } })
    const returned = dashboard({ start: '2026-09-07', end: '2026-09-13', plan: {
      planId: 'RETURNED', status: 'supervisor_returned', signature: {}, plannedHours: 4,
      items: [{ plannedDate: '2026-09-07', plannedHours: 4 }],
    } })
    returned.employees[0].submissionState = 'returned'
    const range = getDashboardRange('month', '2026-09-01')
    const combined = combinePreparationDashboards([accepted, returned], range)
    const chart = buildDashboardChartData({ preparation: combined, range, mode: 'month' })
    expect(combined.includedPlannedHours).toBe(2)
    expect(chart.reduce((sum, point) => sum + point.planned, 0)).toBe(2)
    expect(combined.returnedPlans).toHaveLength(1)
    expect(combined.employees[0].submissionState).toBe('returned')
    expect(combined.employees[0].coveredWeeks).toBe(1)
    expect(combined.employees[0].totalWeeks).toBe(2)
    expect(combined.coverageGaps).toBe(1)
  })

  test('includes overlapping monthly submissions in week mode', () => {
    expect(getPreparationPeriods('week', '2026-09-01').map((period) => period.periodType)).toEqual(['weekly', 'monthly', 'monthly'])
    const weekly = dashboard({ start: '2026-09-07', end: '2026-09-13' })
    const monthly = { ...dashboard({ start: '2026-09-01', end: '2026-09-30', plan: {
      planId: 'MONTH', status: 'supervisor_accepted', signature: {},
      items: [{ plannedDate: '2026-09-08', plannedHours: 3 }, { plannedDate: '2026-09-20', plannedHours: 10 }],
    } }), periodType: 'monthly' }
    const combined = combinePreparationDashboards([weekly, monthly], getDashboardRange('week', '2026-09-07'))
    expect(combined.includedPlannedHours).toBe(3)
    expect(combined.coverageGaps).toBe(0)
    expect(combined.coveredWeeks).toBe(1)
  })

  test('keeps separate review and revision actions for the same employee', () => {
    const submitted = dashboard({ start: '2026-09-14', end: '2026-09-20', plan: {
      planId: 'REVIEW', status: 'submitted_to_supervisor', signature: {}, items: [],
    } })
    submitted.employees[0].submissionState = 'submitted_signed'
    const returned = dashboard({ start: '2026-09-07', end: '2026-09-13', plan: {
      planId: 'REVISION', status: 'supervisor_returned', items: [],
    } })
    returned.employees[0].submissionState = 'returned'
    const combined = combinePreparationDashboards([submitted, returned])
    expect(combined.awaitingReview).toHaveLength(1)
    expect(combined.returnedPlans).toHaveLength(1)
  })

  test('filters and deduplicates actual entries without making pending dates a negative variance', () => {
    const entries = [
      { actualEntryId: 'OUTSIDE', actualDate: '2026-08-31', plannedHours: 8, actualHours: 10 },
      { actualEntryId: 'PENDING', actualDate: '2026-09-07', plannedHours: 3, actualHours: 0, isPending: true },
      { actualEntryId: 'DONE', actualDate: '2026-09-08', plannedHours: 2, actualHours: 2.5, varianceHours: .5 },
    ]
    const actual = summarizeDashboardActual([...entries, entries[2]], getDashboardRange('week', '2026-09-07'))
    expect(actual).toMatchObject({ plannedHours: 5, actualHours: 2.5, pendingCount: 1, varianceHours: .5 })
    expect(actual.entries).toHaveLength(2)
  })

  test('ranks workload from signed plans and includes employees with actual records only', () => {
    const combined = combinePreparationDashboards([dashboard({ start: '2026-09-07', end: '2026-09-13', plan: {
      planId: 'PLAN', status: 'submitted_to_supervisor', signature: {}, items: [{ plannedDate: '2026-09-07', plannedHours: 2 }],
    } })])
    const rows = buildDashboardWorkload(combined, [{ employeeId: 'EMP-002', employeeName: 'Former member', actualHours: 5 }])
    expect(rows.map((row) => row.employeeId)).toEqual(['EMP-002', 'EMP-001'])
    expect(rows[1].planned).toBe(2)
  })

  test('keeps draft and returned workflows at zero and pending approval below completion', () => {
    expect(getDashboardWorkflow({ status: 'draft' }).progress).toBe(0)
    expect(getDashboardWorkflow({ status: 'returned_for_revision' }, [{ status: 'approved' }]).progress).toBe(0)
    expect(getDashboardWorkflow({ status: 'pending_approval' }).progress).toBeLessThan(100)
    expect(getDashboardWorkflow({ status: 'pending_approval' }, [{ status: 'approved' }]).progress).toBeLessThan(100)
    expect(getDashboardWorkflow(null).steps).toEqual([])
  })
})
