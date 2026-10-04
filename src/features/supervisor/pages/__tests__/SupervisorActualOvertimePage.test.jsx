import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { actualOvertimeApi } from '../../../../api/actualOvertimeApi.js'
import { supervisorApi } from '../../../../api/supervisorApi.js'
import { SupervisorActualOvertimePage } from '../SupervisorActualOvertimePage.jsx'

const toast = {
  error: vi.fn(),
  success: vi.fn(),
}

vi.mock('../../../../api/actualOvertimeApi.js', () => ({
  actualOvertimeApi: {
    addComment: vi.fn(),
    getFinalDocument: vi.fn(),
    getPeriod: vi.fn(),
    listMyPeriods: vi.fn(),
    updateEntry: vi.fn(),
  },
}))

vi.mock('../../../../api/supervisorApi.js', () => ({
  supervisorApi: {
    getDepartmentPreparation: vi.fn(),
  },
}))

vi.mock('../../../../components/shared/toast/useToast.js', () => ({
  useToast: () => toast,
}))

vi.mock('../../../auth/useAuth.js', () => ({
  useAuth: () => ({ user: { id: 'USER-SUPERVISOR' } }),
}))

const openSummary = {
  actualHours: 2,
  actualPeriodId: 'ACTUAL-OPEN',
  departmentId: 'DEP-RTD',
  departmentName: 'RTD',
  entryCount: 1,
  periodEndDate: '2026-09-06',
  periodStartDate: '2026-08-31',
  periodType: 'weekly',
  plannedHours: 2,
  status: 'open',
}

const finalizedSummary = {
  ...openSummary,
  actualHours: 3,
  actualPeriodId: 'ACTUAL-FINALIZED',
  finalizedAt: '2026-08-30T08:00:00.000Z',
  finalizedByName: 'HR User',
  finalizationRemarks: 'Payroll verified.',
  periodEndDate: '2026-08-30',
  periodStartDate: '2026-08-24',
  plannedHours: 3,
  status: 'finalized',
}

function makeEntry(overrides = {}) {
  return {
    actualDate: '2026-09-01',
    actualEntryId: 'ENTRY-OPEN',
    actualHours: 2,
    actualPeriodId: 'ACTUAL-OPEN',
    adjustments: [],
    comments: [],
    employeeId: 'EMP-001',
    employeeName: 'RTD Employee 1',
    employeeNo: 'EMP-001',
    isPending: false,
    plannedHours: 2,
    plannedReason: 'Production close',
    ...overrides,
  }
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <SupervisorActualOvertimePage />
    </QueryClientProvider>,
  )
}

describe('SupervisorActualOvertimePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    actualOvertimeApi.listMyPeriods.mockResolvedValue([openSummary, finalizedSummary])
    actualOvertimeApi.getPeriod.mockImplementation(async (actualPeriodId) => (
      actualPeriodId === finalizedSummary.actualPeriodId
        ? {
            ...finalizedSummary,
            entries: [makeEntry({
              actualDate: '2026-08-25',
              actualEntryId: 'ENTRY-FINALIZED',
              actualHours: 3,
              actualPeriodId: 'ACTUAL-FINALIZED',
              periodStatus: 'finalized',
              plannedHours: 3,
            })],
          }
        : { ...openSummary, entries: [makeEntry()] }
    ))
    actualOvertimeApi.updateEntry.mockResolvedValue(makeEntry({ actualHours: 2.5 }))
    actualOvertimeApi.addComment.mockResolvedValue({
      actualEntryId: 'ENTRY-OPEN',
      commentId: 'COMMENT-001',
      createdAt: '2026-09-03T08:00:00.000Z',
      remarks: 'Confirmed with the employee.',
      userId: 'USER-SUPERVISOR',
      userName: 'RTD Supervisor',
    })
    actualOvertimeApi.getFinalDocument.mockResolvedValue({
      actualPeriodId: 'ACTUAL-FINALIZED',
      blob: new Blob(['actual overtime workbook']),
      fileName: 'ACTUAL-FINALIZED.xlsx',
    })
    supervisorApi.getDepartmentPreparation.mockResolvedValue({
      employees: [{
        employeeId: 'EMP-001',
        plan: {
          signature: {
            signedUrl: 'data:image/png;base64,c2lnbmF0dXJl',
          },
        },
      }],
    })
  })

  test('reviews open entries, saves adjustments and comments, then locks finalized periods and downloads the document', async () => {
    const browserUser = userEvent.setup()
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:actual-overtime')
    const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    renderPage()

    expect(await screen.findByRole('heading', { name: 'RTD Employee 1' })).toBeVisible()
    expect(actualOvertimeApi.listMyPeriods).toHaveBeenCalledWith()
    expect(screen.getByText('Production close')).toBeVisible()

    const actualHoursInput = screen.getByLabelText('Actual hours')
    await browserUser.clear(actualHoursInput)
    await browserUser.type(actualHoursInput, '2.5')
    await browserUser.type(screen.getByLabelText('Adjustment remarks'), 'Verified attendance record.')
    await browserUser.click(screen.getByRole('button', { name: 'Save adjustment' }))

    await waitFor(() => expect(actualOvertimeApi.updateEntry).toHaveBeenCalledWith('ENTRY-OPEN', {
      actualHours: 2.5,
      remarks: 'Verified attendance record.',
    }))

    await browserUser.type(screen.getByPlaceholderText('Write a comment'), 'Confirmed with the employee.')
    await browserUser.click(screen.getByRole('button', { name: 'Send comment' }))
    await waitFor(() => expect(actualOvertimeApi.addComment).toHaveBeenCalledWith(
      'ENTRY-OPEN',
      'Confirmed with the employee.',
    ))

    expect(screen.getByText('Ongoing today')).toBeVisible()
    expect(await screen.findByRole('button', { name: 'Preview RTD Employee 1 signature' })).toBeVisible()
    expect(screen.getByRole('rowheader', { name: 'Daily total' })).toBeVisible()

    await browserUser.click(screen.getByRole('button', { name: /finalized/i }))
    await browserUser.click(screen.getByRole('button', { name: 'Open actual overtime period 2026-08-24' }))

    expect(await screen.findByText('Finalized by HR User')).toBeVisible()
    expect(screen.getByText('Hours and comments are locked for this period.')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Save adjustment' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Send comment' })).not.toBeInTheDocument()

    await browserUser.click(screen.getByRole('button', { name: 'Download final document' }))
    await waitFor(() => expect(actualOvertimeApi.getFinalDocument).toHaveBeenCalledWith('ACTUAL-FINALIZED'))
    expect(clickSpy).toHaveBeenCalled()
    expect(createObjectUrlSpy).toHaveBeenCalled()
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:actual-overtime')
    clickSpy.mockRestore()
    createObjectUrlSpy.mockRestore()
    revokeObjectUrlSpy.mockRestore()
  })
})
