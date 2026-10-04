import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { supervisorApi } from '../../../../api/supervisorApi.js'
import { SupervisorApprovedDepartmentPlansPage } from '../SupervisorApprovedDepartmentPlansPage.jsx'

vi.mock('../../../../api/supervisorApi.js', () => ({
  supervisorApi: {
    getDepartmentPlan: vi.fn(),
    getDepartmentPreparation: vi.fn(),
    listDepartmentApprovalPlans: vi.fn(),
  },
}))

function toDateValue(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function getCurrentWeek() {
  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { end: toDateValue(sunday), start: toDateValue(monday) }
}

function getCurrentMonth() {
  const now = new Date()
  return {
    end: toDateValue(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    start: toDateValue(new Date(now.getFullYear(), now.getMonth(), 1)),
  }
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SupervisorApprovedDepartmentPlansPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SupervisorApprovedDepartmentPlansPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('filters final-approved plans by week and month and shows the employee matrix', async () => {
    const browserUser = userEvent.setup()
    const week = getCurrentWeek()
    const month = getCurrentMonth()
    const summary = {
      approvedAt: '2026-09-02T08:00:00.000Z',
      departmentId: 'DEP-RTD',
      departmentName: 'RTD',
      employeeCount: 1,
      itemCount: 1,
      periodEndDate: week.end,
      periodStartDate: week.start,
      periodType: 'weekly',
      planId: 'DEPTPLAN-APPROVED',
      plannedHours: 2,
      status: 'approved',
    }
    const plan = {
      ...summary,
      logs: [{
        action: 'approved',
        actionAt: '2026-09-02T08:00:00.000Z',
        actionByName: 'Admin User',
        logId: 'LOG-001',
        remarks: 'Final hours confirmed.',
      }],
      remarks: 'Support the production close.',
      items: [{
        employeeId: 'EMP-001',
        employeeName: 'RTD Employee 1',
        employeeNo: 'EMP-001',
        planItemId: 'ITEM-001',
        plannedDate: week.start,
        plannedHours: 2,
        reason: 'Inventory close',
      }],
    }

    supervisorApi.listDepartmentApprovalPlans.mockResolvedValue([
      summary,
      { ...summary, planId: 'DEPTPLAN-CLOSED', status: 'closed' },
    ])
    supervisorApi.getDepartmentPlan.mockResolvedValue(plan)
    supervisorApi.getDepartmentPreparation.mockResolvedValue({
      employees: [{
        employeeId: 'EMP-001',
        employeeName: 'RTD Employee 1',
        employeeNo: 'EMP-001',
        plan: {
          signature: {
            signedAt: '2026-09-01T08:00:00.000Z',
            signedUrl: 'data:image/png;base64,c2lnbmF0dXJl',
          },
        },
      }],
    })

    renderPage()

    expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('grid')).not.toBeInTheDocument()
    await waitFor(() => expect(supervisorApi.listDepartmentApprovalPlans).toHaveBeenCalledWith({
      dateFrom: week.start,
      dateTo: week.end,
      limit: 100,
      status: 'approved',
    }))

    expect(await screen.findByRole('button', { name: 'Preview RTD Employee 1 signature' })).toBeVisible()
    expect(screen.getByText('1/1')).toBeVisible()
    expect(screen.getByText('Inventory close')).toBeVisible()
    expect(screen.getByText('Support the production close.')).toBeVisible()
    expect(screen.getByText('Final hours confirmed.')).toBeVisible()
    expect(screen.getByText(/Admin User/)).toBeVisible()
    const totalsRow = screen.getByRole('rowheader', { name: 'Total hours' }).closest('tr')
    expect(within(totalsRow).getByText('2h')).toBeVisible()
    expect(within(totalsRow).getByText('2h period')).toBeVisible()

    await browserUser.click(screen.getByRole('button', { name: 'Month' }))

    expect(screen.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(supervisorApi.listDepartmentApprovalPlans).toHaveBeenCalledWith({
      dateFrom: month.start,
      dateTo: month.end,
      limit: 100,
      status: 'approved',
    }))
    expect(screen.queryByRole('grid')).not.toBeInTheDocument()
  })
})
