import { useMemo, useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { actualOvertimeApi } from '../../api/actualOvertimeApi.js'
import { supervisorApi } from '../../api/supervisorApi.js'
import {
  buildDashboardChartData,
  buildDashboardWorkload,
  combinePreparationDashboards,
  getDashboardRange,
  getPreparationPeriods,
  summarizeDashboardActual,
} from './utils/supervisorDashboardView.js'

export function useSupervisorDashboard(mode, anchorDate) {
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const range = useMemo(() => getDashboardRange(mode, anchorDate), [mode, anchorDate])
  const preparationQuery = useQuery({
    queryKey: ['supervisor', 'dashboard', 'preparation', mode, range.dateFrom, range.dateTo],
    queryFn: () => Promise.all(getPreparationPeriods(mode, anchorDate).map(supervisorApi.getDepartmentPreparation)),
  })
  const workflowsQuery = useQuery({
    queryKey: ['supervisor', 'dashboard', 'workflows', range.dateFrom, range.dateTo],
    queryFn: async () => {
      const plans = []
      let batch
      do {
        batch = await supervisorApi.listDepartmentApprovalPlans({
          dateFrom: range.dateFrom, dateTo: range.dateTo,
          status: 'draft,pending_approval,returned_for_revision', limit: 100, offset: plans.length,
        })
        plans.push(...batch)
      } while (batch.length === 100)
      return [...new Map(plans.map((plan) => [plan.planId, plan])).values()]
    },
  })
  const preparation = useMemo(() => {
    const combined = combinePreparationDashboards(preparationQuery.data || [], range)
    if (workflowsQuery.data) combined.activeDepartmentPlans = workflowsQuery.data
    return combined
  }, [preparationQuery.data, range, workflowsQuery.data])
  const actualPeriodsQuery = useQuery({
    queryKey: ['supervisor', 'dashboard', 'actual-periods', range.dateFrom, range.dateTo],
    queryFn: () => actualOvertimeApi.listMyPeriods({ dateFrom: range.dateFrom, dateTo: range.dateTo }),
  })
  const actualPeriods = (actualPeriodsQuery.data || []).filter((period) => (
    period.periodEndDate >= range.dateFrom && period.periodStartDate <= range.dateTo
  ))
  const detailQueries = useQueries({
    queries: actualPeriods.map((period) => ({
      queryKey: ['supervisor', 'actual-overtime', 'period', period.actualPeriodId],
      queryFn: () => actualOvertimeApi.getPeriod(period.actualPeriodId),
    })),
  })
  const actual = summarizeDashboardActual(detailQueries.flatMap((query) => query.data?.entries || []), range)
  const actualLoading = actualPeriodsQuery.isPending || detailQueries.some((query) => query.isPending)
  const actualError = actualPeriodsQuery.error || detailQueries.find((query) => query.isError)?.error
  const actualReady = !actualLoading && !actualError
  const plans = preparation.activeDepartmentPlans
  const selectedIndex = Math.max(0, plans.findIndex((plan) => plan.planId === selectedPlanId))
  const activePlan = plans[selectedIndex]
  const approvalQuery = useQuery({
    enabled: Boolean(activePlan && activePlan.status !== 'draft'),
    queryKey: ['supervisor', 'dashboard', 'approval', activePlan?.planId],
    queryFn: () => supervisorApi.getDepartmentApprovalDetails(activePlan.planId),
  })
  const chartData = buildDashboardChartData({ preparation, range, mode, actualEntries: actual.entries })
    .map((point) => ({ ...point, actual: actualReady ? point.actual : null }))
  const workload = buildDashboardWorkload(preparation, actualReady ? actual.entries : [])
  const queries = [preparationQuery, workflowsQuery, actualPeriodsQuery, ...detailQueries]
  if (activePlan && activePlan.status !== 'draft') queries.push(approvalQuery)

  return {
    range, preparation, preparationQuery, workflowsQuery, actual, actualPeriods, actualReady, actualLoading,
    actualError, chartData, workload, activePlan, selectedIndex, approvalQuery,
    isRefreshing: queries.some((query) => query.isFetching),
    updatedAt: preparationQuery.dataUpdatedAt,
    refresh: () => Promise.all(queries.map((query) => query.refetch())),
    selectPlan: (direction) => setSelectedPlanId(plans[(selectedIndex + direction + plans.length) % plans.length]?.planId || ''),
  }
}
