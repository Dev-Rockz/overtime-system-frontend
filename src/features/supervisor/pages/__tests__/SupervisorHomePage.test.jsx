import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { actualOvertimeApi } from '../../../../api/actualOvertimeApi.js'
import { supervisorApi } from '../../../../api/supervisorApi.js'
import { SupervisorHomePage } from '../SupervisorHomePage.jsx'

vi.mock('../../../../api/actualOvertimeApi.js', () => ({ actualOvertimeApi: { listMyPeriods: vi.fn(), getPeriod: vi.fn() } }))
vi.mock('../../../../api/supervisorApi.js', () => ({ supervisorApi: { getDepartmentPreparation: vi.fn(), getDepartmentApprovalDetails: vi.fn(), listDepartmentApprovalPlans: vi.fn() } }))
vi.mock('../../../auth/useAuth.js', () => ({ useAuth: () => ({ user: { firstName: 'RTD Supervisor' } }) }))
vi.mock('../../components/SupervisorDashboardChart.jsx', () => ({ SupervisorDashboardChart: ({ data, type, visibleSeries }) => <div data-testid="chart" data-type={type} data-series={visibleSeries.join(',')} data-points={JSON.stringify(data)} /> }))

const members = Array.from({ length: 8 }, (_, index) => ({ employeeId: `EMP-${index}`, employeeName: `Employee ${index}`, employeeNo: `E-${index}` }))
const departmentPlans = [
  { planId: 'DEPT-DRAFT', status: 'draft', periodStartDate: '2026-09-07', periodEndDate: '2026-09-13' },
  { planId: 'DEPT-PENDING', status: 'pending_approval', periodStartDate: '2026-09-07', periodEndDate: '2026-09-13' },
]
const actualPeriod = { actualPeriodId: 'ACTUAL', status: 'open', periodStartDate: '2026-08-31', periodEndDate: '2026-09-30', plannedHours: 100, actualHours: 99 }

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}><MemoryRouter><SupervisorHomePage /></MemoryRouter></QueryClientProvider>)
}

describe('Supervisor dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-07T09:00:00+08:00'))
    supervisorApi.getDepartmentPreparation.mockImplementation(async (period) => ({
      ...period, departmentPlan: null,
      employees: members.map((member, index) => ({ ...member,
        submissionState: period.periodType === 'weekly' && index < 2 ? 'submitted_signed' : 'not_submitted',
        plan: period.periodType === 'weekly' && index < 2 ? {
          planId: `${period.periodStartDate}-${index}`, status: 'submitted_to_supervisor', signature: {},
          items: [{ plannedDate: period.periodStartDate, plannedHours: 3 }], plannedHours: 3,
        } : null,
      })),
    }))
    supervisorApi.listDepartmentApprovalPlans.mockResolvedValue(departmentPlans)
    supervisorApi.getDepartmentApprovalDetails.mockResolvedValue({ approvals: [{ approvalId: 'JP', stepName: 'Japanese management', status: 'pending' }] })
    actualOvertimeApi.listMyPeriods.mockResolvedValue([actualPeriod])
    actualOvertimeApi.getPeriod.mockResolvedValue({ ...actualPeriod, entries: [
      { actualEntryId: 'OUTSIDE', employeeId: 'EMP-0', actualDate: '2026-08-31', actualHours: 50, plannedHours: 40 },
      { actualEntryId: 'TODAY', employeeId: 'EMP-0', actualDate: '2026-09-07', actualHours: 0, plannedHours: 3, isPending: true },
      { actualEntryId: 'ADJUSTED', employeeId: 'EMP-1', actualDate: '2026-09-08', actualHours: 2.5, plannedHours: 2, varianceHours: .5 },
    ] })
  })
  afterEach(() => vi.useRealTimers())

  test('shows date-clipped totals and excludes pending variance, with navigable workflows', async () => {
    const browserUser = userEvent.setup()
    renderPage()
    const ledger = await screen.findByRole('region', { name: /Actual OT ledger/ })
    await waitFor(() => expect(within(ledger).getByText('2.5h')).toBeVisible())
    expect(within(ledger).getByText('+0.5h')).toBeVisible()
    expect(within(ledger).getByText('5h')).toBeVisible()
    expect(screen.getByRole('progressbar', { name: 'Approval progress' })).toHaveAttribute('aria-valuenow', '0')
    await browserUser.click(screen.getByRole('button', { name: 'Next department workflow' }))
    expect(await screen.findByText('Japanese management')).toBeVisible()
    expect(supervisorApi.getDepartmentApprovalDetails).toHaveBeenCalledWith('DEPT-PENDING')
    expect(actualOvertimeApi.listMyPeriods).toHaveBeenCalledWith({ dateFrom: '2026-09-07', dateTo: '2026-09-13' })
  })

  test('searches, filters and paginates employees and toggles chart controls', async () => {
    const browserUser = userEvent.setup()
    renderPage()
    const team = await screen.findByRole('region', { name: /Team overview/ })
    expect(within(team).getAllByRole('row')).toHaveLength(7)
    await browserUser.click(screen.getByRole('button', { name: 'Next employees' }))
    expect(within(team).getByRole('rowheader', { name: /Employee 7/ })).toBeVisible()
    await browserUser.type(screen.getByRole('textbox', { name: 'Search dashboard employees' }), 'Employee 0')
    expect(within(team).getAllByRole('row')).toHaveLength(2)
    await browserUser.click(screen.getByRole('button', { name: 'Clear employee search' }))
    await browserUser.selectOptions(screen.getByRole('combobox', { name: 'Team submission status' }), 'review')
    expect(within(team).getAllByRole('row')).toHaveLength(3)
    await browserUser.click(screen.getByRole('button', { name: 'Line chart' }))
    expect(screen.getByTestId('chart')).toHaveAttribute('data-type', 'line')
    await browserUser.click(screen.getByRole('checkbox', { name: 'Show accepted hours' }))
    expect(screen.getByTestId('chart')).toHaveAttribute('data-series', 'planned,actual')
  })

  test('preserves the selected date on mode change and ignores an empty date input', async () => {
    const browserUser = userEvent.setup()
    renderPage()
    const input = await screen.findByLabelText('Select dashboard week')
    fireEvent.change(input, { target: { value: '' } })
    expect(input).toHaveValue('2026-09-07')
    await browserUser.click(screen.getByRole('button', { name: 'Previous week' }))
    await waitFor(() => expect(screen.getByLabelText('Select dashboard week')).toHaveValue('2026-08-31'))
    await browserUser.click(screen.getByRole('button', { name: 'Month', exact: true }))
    await waitFor(() => expect(screen.getByLabelText('Select dashboard month')).toHaveValue('2026-08'))
    await browserUser.click(screen.getByRole('button', { name: 'Today', exact: true }))
    await waitFor(() => expect(screen.getByLabelText('Select dashboard month')).toHaveValue('2026-09'))
  })

  test('keeps planned data visible when actual details fail instead of displaying zero', async () => {
    actualOvertimeApi.getPeriod.mockRejectedValue(new Error('Actual records unavailable'))
    renderPage()
    expect(await screen.findByText('Actual overtime is unavailable. Submitted and accepted hours are still shown.')).toBeVisible()
    const ledger = screen.getByRole('region', { name: /Actual OT ledger/ })
    expect(within(ledger).getAllByText('--')).toHaveLength(4)
    const points = JSON.parse(screen.getByTestId('chart').getAttribute('data-points'))
    expect(points.every((point) => point.actual === null)).toBe(true)
    expect(points.reduce((sum, point) => sum + point.planned, 0)).toBe(6)
  })

  test('shows loading and retry states for the dashboard', async () => {
    supervisorApi.getDepartmentPreparation.mockImplementation(() => new Promise(() => {}))
    const view = renderPage()
    expect(screen.getByRole('status', { name: 'Loading supervisor dashboard' })).toBeVisible()
    view.unmount()
    supervisorApi.getDepartmentPreparation.mockRejectedValue(new Error('Preparation unavailable'))
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('Preparation unavailable')
    expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible()
  })
})
