import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { supervisorApi } from '../../../../api/supervisorApi.js'
import { SupervisorApprovalsPage } from '../SupervisorApprovalsPage.jsx'

vi.mock('../../../../api/supervisorApi.js', () => ({
  supervisorApi: {
    getDepartmentApprovalDetails: vi.fn(),
    listDepartmentApprovalPlans: vi.fn(),
  },
}))

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SupervisorApprovalsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SupervisorApprovalsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('cycles through ongoing department approvals one submission at a time', async () => {
    const browserUser = userEvent.setup()
    const plans = [
      {
        planId: 'DEPTPLAN-1',
        departmentId: 'DEP-RTD',
        departmentName: 'RTD',
        periodStartDate: '2026-08-31',
        periodEndDate: '2026-09-06',
        plannedHours: 10,
        status: 'pending_approval',
        currentApproverRole: 'japanese_management',
      },
      {
        planId: 'DEPTPLAN-2',
        departmentId: 'DEP-RTD',
        departmentName: 'RTD',
        periodStartDate: '2026-09-07',
        periodEndDate: '2026-09-13',
        plannedHours: 8,
        status: 'pending_approval',
        currentApproverRole: 'admin',
      },
      {
        planId: 'DEPTPLAN-3',
        departmentId: 'DEP-RTD',
        departmentName: 'RTD',
        periodStartDate: '2026-09-14',
        periodEndDate: '2026-09-20',
        plannedHours: 12,
        status: 'approved',
        currentApproverRole: 'admin',
      },
    ]
    const approvalDetails = Object.fromEntries(plans.map((plan, planIndex) => [
      plan.planId,
      {
        ...plan,
        approvals: [
          {
            approvalId: `${plan.planId}-SUPERVISOR`,
            approverRole: 'supervisor',
            status: 'approved',
            stepName: 'Supervisor',
            stepOrder: 1,
          },
          {
            approvalId: `${plan.planId}-CURRENT`,
            approverRole: plan.currentApproverRole,
            status: 'pending',
            stepName: planIndex ? 'Admin' : 'Japanese Management',
            stepOrder: 2,
          },
        ],
      },
    ]))

    supervisorApi.listDepartmentApprovalPlans.mockResolvedValue(plans)
    supervisorApi.getDepartmentApprovalDetails.mockImplementation(
      async (planId) => approvalDetails[planId],
    )

    renderPage()

    let spotlight = await screen.findByRole('region', { name: 'Ongoing approval' })
    expect(within(spotlight).getByText('Aug 31, 2026 - Sep 06, 2026')).toBeVisible()
    expect(within(spotlight).getByText('1 / 2')).toBeVisible()
    expect(within(spotlight).getAllByText('Japanese Management').length).toBeGreaterThan(0)

    const history = await screen.findByRole('region', { name: 'Department approval history' })
    expect(within(history).getByText('Sep 14, 2026 - Sep 20, 2026')).toBeVisible()
    expect(within(history).queryByText('Aug 31, 2026 - Sep 06, 2026')).not.toBeInTheDocument()

    await browserUser.click(within(spotlight).getByRole('button', { name: 'Next ongoing approval' }))

    spotlight = await screen.findByRole('region', { name: 'Ongoing approval' })
    expect(within(spotlight).getByText('Sep 07, 2026 - Sep 13, 2026')).toBeVisible()
    expect(within(spotlight).getByText('2 / 2')).toBeVisible()
    await waitFor(() => {
      expect(supervisorApi.getDepartmentApprovalDetails).toHaveBeenCalledWith('DEPTPLAN-2')
    })
  })

  test('opens ongoing tracking even when approval history is empty', async () => {
    const browserUser = userEvent.setup()
    const plan = {
      planId: 'DEPTPLAN-ONGOING',
      departmentId: 'DEP-RTD',
      departmentName: 'RTD',
      periodStartDate: '2026-09-21',
      periodEndDate: '2026-09-27',
      plannedHours: 9,
      status: 'pending_approval',
      currentApproverRole: 'japanese_management',
    }
    const detail = {
      ...plan,
      itemCount: 5,
      approvals: [
        {
          approvalId: 'APPROVAL-SUPERVISOR',
          approverRole: 'supervisor',
          status: 'approved',
          stepName: 'Supervisor',
          stepOrder: 1,
        },
        {
          approvalId: 'APPROVAL-JM',
          approverRole: 'japanese_management',
          status: 'pending',
          stepName: 'Japanese Management',
          stepOrder: 2,
        },
      ],
    }

    supervisorApi.listDepartmentApprovalPlans.mockImplementation(async ({ status }) => (
      status === 'pending_approval' ? [plan] : []
    ))
    supervisorApi.getDepartmentApprovalDetails.mockResolvedValue(detail)

    renderPage()

    const spotlight = await screen.findByRole('region', { name: 'Ongoing approval' })
    await browserUser.click(within(spotlight).getByRole('button', { name: 'Open tracking' }))

    expect(await screen.findByRole('region', {
      name: 'Approval progress for Sep 21, 2026 - Sep 27, 2026',
    })).toBeVisible()
    expect(screen.getByText('No approval history in this status')).toBeVisible()
  })

  test('paginates approval history through backend limit and offset parameters', async () => {
    const browserUser = userEvent.setup()
    const firstPage = Array.from({ length: 9 }, (_, index) => ({
      planId: `DEPTPLAN-HISTORY-${index + 1}`,
      departmentId: 'DEP-RTD',
      departmentName: 'RTD',
      periodStartDate: '2026-08-31',
      periodEndDate: '2026-09-06',
      plannedHours: index + 1,
      status: 'approved',
    }))
    const secondPage = [{
      ...firstPage[0],
      planId: 'DEPTPLAN-HISTORY-9',
      plannedHours: 9,
    }]

    supervisorApi.listDepartmentApprovalPlans.mockImplementation(async (filters) => {
      if (filters.status === 'pending_approval') return []
      return filters.offset === 8 ? secondPage : firstPage
    })
    supervisorApi.getDepartmentApprovalDetails.mockImplementation(async (planId) => ({
      ...firstPage[0],
      planId,
      approvals: [],
    }))

    renderPage()

    const nextPage = await screen.findByRole('button', { name: 'Next approval history page' })
    expect(nextPage).toBeEnabled()
    await browserUser.click(nextPage)

    await waitFor(() => {
      expect(supervisorApi.listDepartmentApprovalPlans).toHaveBeenCalledWith({
        limit: 9,
        offset: 8,
        status: 'returned_for_revision,approved,closed',
      })
    })
    expect(await screen.findByText('Page 2')).toBeVisible()
  })

  test('surfaces who returned a plan and the return remarks', async () => {
    const plan = {
      planId: 'DEPTPLAN-RETURNED',
      departmentId: 'DEP-RTD',
      departmentName: 'RTD',
      periodStartDate: '2026-08-31',
      periodEndDate: '2026-09-06',
      plannedHours: 7,
      status: 'returned_for_revision',
    }

    supervisorApi.listDepartmentApprovalPlans.mockImplementation(async ({ status }) => (
      status === 'pending_approval' ? [] : [plan]
    ))
    supervisorApi.getDepartmentApprovalDetails.mockResolvedValue({
      ...plan,
      approvals: [{
        approvalId: 'APPROVAL-RETURNED',
        actedAt: '2026-09-02T08:00:00.000Z',
        actedByName: 'Japanese Manager',
        approverRole: 'japanese_management',
        remarks: 'Please correct the Friday allocation.',
        status: 'rejected',
        stepName: 'Japanese Management',
        stepOrder: 2,
      }],
    })

    renderPage()

    expect(await screen.findByText(/Returned by Japanese Manager/)).toBeVisible()
    expect(screen.getByText('Please correct the Friday allocation.')).toBeVisible()
  })
})
