import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { supervisorApi } from '../../../../api/supervisorApi.js'
import { SupervisorAssignOvertimePage } from '../SupervisorAssignOvertimePage.jsx'

const navigate = vi.fn()
const toast = {
  error: vi.fn(),
  success: vi.fn(),
}

vi.mock('../../../../api/supervisorApi.js', () => ({
  supervisorApi: {
    assignBulkEmployeePlans: vi.fn(),
    getDepartmentPreparation: vi.fn(),
    listMyTeam: vi.fn(),
    withdrawBulkEmployeePlans: vi.fn(),
  },
}))

vi.mock('../../../../components/shared/toast/useToast.js', () => ({
  useToast: () => toast,
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigate,
  }
})

const employees = [
  {
    employeeId: 'EMP-001',
    employeeNo: 'EMP-001',
    fullName: 'RTD Employee 1',
  },
  {
    employeeId: 'EMP-002',
    employeeNo: 'EMP-002',
    fullName: 'RTD Employee 2',
  },
]

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SupervisorAssignOvertimePage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SupervisorAssignOvertimePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    supervisorApi.listMyTeam.mockResolvedValue(employees)
    supervisorApi.getDepartmentPreparation.mockResolvedValue({
      departmentPlan: null,
      employees: [],
    })
  })

  test('creates employee submissions without entering department approval', async () => {
    const browserUser = userEvent.setup()
    supervisorApi.assignBulkEmployeePlans.mockResolvedValue([
      { planId: 'PLAN-EMP-001', status: 'submitted_to_supervisor' },
      { planId: 'PLAN-EMP-002', status: 'submitted_to_supervisor' },
    ])

    renderPage()

    expect(await screen.findByText('RTD Employee 1')).toBeVisible()
    const hourInputs = screen.getAllByRole('spinbutton')
    await browserUser.type(hourInputs[0], '2.5')
    await browserUser.type(hourInputs[hourInputs.length - 1], '1')
    await browserUser.type(
      screen.getByPlaceholderText('Enter the weekly or monthly overtime purpose'),
      'Production support coverage',
    )

    await browserUser.click(screen.getByRole('button', { name: 'Assign and send to review' }))

    const dialog = await screen.findByRole('dialog', { name: 'Send employee plans to review' })
    expect(dialog).toHaveTextContent('Employee signature records')
    expect(dialog).toHaveTextContent('applied by the supervisor on their behalf')
    expect(dialog).toHaveTextContent('3.5h')
    await browserUser.click(screen.getByRole('button', { name: 'Confirm assignment' }))

    await waitFor(() => {
      expect(supervisorApi.assignBulkEmployeePlans).toHaveBeenCalledTimes(1)
    })
    const payload = supervisorApi.assignBulkEmployeePlans.mock.calls[0][0]
    expect(payload.periodType).toBe('weekly')
    expect(payload.remarks).toBe('Production support coverage')
    expect(payload.items).toHaveLength(2)
    expect(payload.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ employeeId: 'EMP-001', plannedHours: 2.5 }),
      expect.objectContaining({ employeeId: 'EMP-002', plannedHours: 1 }),
    ]))
    expect(toast.success).toHaveBeenCalledWith(
      'Employee overtime assigned and sent to supervisor review.',
    )
    expect(navigate).toHaveBeenCalledWith('/supervisor/department-plans')
  })

  test('reports an atomic bulk assignment failure without navigating', async () => {
    const browserUser = userEvent.setup()
    supervisorApi.assignBulkEmployeePlans.mockRejectedValue(
      new Error('Employee EMP-001 must have a saved signature.'),
    )

    renderPage()

    expect(await screen.findByText('RTD Employee 1')).toBeVisible()
    await browserUser.type(screen.getAllByRole('spinbutton')[0], '2')
    await browserUser.type(
      screen.getByPlaceholderText('Enter the weekly or monthly overtime purpose'),
      'Equipment setup',
    )
    await browserUser.click(screen.getByRole('button', { name: 'Assign and send to review' }))
    await browserUser.click(await screen.findByRole('button', { name: 'Confirm assignment' }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Employee EMP-001 must have a saved signature.',
      )
    })
    expect(navigate).not.toHaveBeenCalled()
  })

  test('locks employees who already have an active plan for the period', async () => {
    supervisorApi.getDepartmentPreparation.mockResolvedValue({
      departmentPlan: null,
      employees: [{
        employeeId: 'EMP-001',
        plan: {
          status: 'submitted_to_supervisor',
          items: [
            { plannedDate: '2026-08-31', plannedHours: 2 },
            { plannedDate: '2026-09-01', plannedHours: 1.5 },
          ],
        },
      }],
    })

    renderPage()

    expect(await screen.findByText('Already submitted')).toBeVisible()
    const hourInputs = screen.getAllByRole('spinbutton')
    expect(hourInputs.slice(0, 7).every((input) => input.disabled)).toBe(true)
    expect(hourInputs[0]).toHaveValue(2)
    expect(hourInputs[1]).toHaveValue(1.5)
    expect(hourInputs.slice(7).every((input) => !input.disabled)).toBe(true)
    const employeeRow = screen.getByRole('rowheader', { name: /RTD Employee 1/ }).closest('tr')
    expect(employeeRow).toHaveTextContent('3.5h')
  })

  test('withdraws and deletes selected supervisor-created submissions', async () => {
    const browserUser = userEvent.setup()
    supervisorApi.getDepartmentPreparation.mockResolvedValue({
      departmentPlan: null,
      employees: employees.map((employee, index) => ({
        employeeId: employee.employeeId,
        canSupervisorBulkWithdraw: true,
        plan: {
          planId: `PLAN-${index + 1}`,
          status: 'submitted_to_supervisor',
        },
      })),
    })
    supervisorApi.withdrawBulkEmployeePlans.mockResolvedValue({
      deletedCount: 1,
      employeeIds: ['EMP-001'],
      planIds: ['PLAN-1'],
    })

    renderPage()

    expect(await screen.findByText('Correct submitted assignments')).toBeVisible()
    await browserUser.click(screen.getByRole('checkbox', {
      name: 'Select RTD Employee 1 for withdrawal',
    }))
    await browserUser.click(screen.getByRole('button', { name: 'Withdraw selected' }))

    const dialog = await screen.findByRole('dialog', {
      name: 'Withdraw employee submissions?',
    })
    expect(dialog).toHaveTextContent('1 submission will be removed')
    await browserUser.click(screen.getByRole('button', { name: 'Withdraw and delete' }))

    await waitFor(() => {
      expect(supervisorApi.withdrawBulkEmployeePlans).toHaveBeenCalledWith(
        expect.objectContaining({
          allEmployees: false,
          employeeIds: ['EMP-001'],
          periodType: 'weekly',
        }),
      )
    })
    expect(toast.success).toHaveBeenCalledWith(
      '1 employee submission withdrawn and deleted.',
    )
  })
})
