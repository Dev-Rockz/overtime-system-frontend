import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { DepartmentPreparationWorkspace } from '../DepartmentPreparationWorkspace.jsx'
import { getWeekDays } from '../../utils/weekPeriod.js'

describe('DepartmentPreparationWorkspace', () => {
  test('reviews, accepts, and returns signed employee submissions', async () => {
    const browserUser = userEvent.setup()
    const onAccept = vi.fn()
    const onReturn = vi.fn()
    const submittedEmployee = {
      employeeId: 'EMP-1',
      employeeNo: 'EMP-014',
      employeeName: 'RTD Employee 1',
      hasSignedSubmission: true,
      eligibleForDepartmentPlan: false,
      submissionState: 'submitted_signed',
      plan: {
        planId: 'PLAN-1',
        itemCount: 2,
        plannedHours: 3.5,
        remarks: 'Support the weekly production close.',
        items: [
          {
            planItemId: 'ITEM-1',
            plannedDate: '2026-08-31',
            plannedHours: 2,
            reason: 'Production support',
          },
          {
            planItemId: 'ITEM-2',
            plannedDate: '2026-09-01',
            plannedHours: 1.5,
            reason: 'Inventory count',
          },
        ],
        signature: {
          signatureRecordId: 'SIGNATURE-1',
          signedUrl: 'data:image/png;base64,c2lnbmF0dXJl',
        },
      },
    }
    const missingEmployee = {
      employeeId: 'EMP-2',
      employeeNo: 'EMP-015',
      employeeName: 'RTD Employee 2',
      hasSignedSubmission: false,
      eligibleForDepartmentPlan: false,
      submissionState: 'not_submitted',
      plan: null,
    }

    render(
      <DepartmentPreparationWorkspace
        days={getWeekDays('2026-08-31')}
        employees={[submittedEmployee, missingEmployee]}
        onAccept={onAccept}
        onReturn={onReturn}
      />,
    )

    const readiness = screen.getByRole('region', { name: 'Department readiness' })
    expect(within(readiness).getByText('0%')).toBeVisible()
    expect(within(readiness).getByText('1', { selector: 'dd' })).toBeVisible()

    const dailyHours = screen.getByRole('region', { name: 'Submitted hours by day' })
    expect(within(dailyHours).getByText('2h')).toBeVisible()
    expect(within(dailyHours).getByText('1.5h')).toBeVisible()

    await browserUser.click(screen.getByRole('button', { name: 'Review next submission' }))
    let reviewDialog = screen.getByRole('dialog', { name: 'RTD Employee 1' })
    expect(within(reviewDialog).getByText('Production support')).toBeVisible()
    expect(within(reviewDialog).getByText('Available after approval')).toBeVisible()
    expect(within(reviewDialog).queryByRole('img', {
      name: 'RTD Employee 1 signature',
    })).not.toBeInTheDocument()
    const returnButton = within(reviewDialog).getByRole('button', { name: 'Return' })
    expect(returnButton).toBeDisabled()
    await browserUser.type(
      within(reviewDialog).getByLabelText('Return remarks'),
      'Please correct Tuesday hours.',
    )
    await browserUser.click(returnButton)
    expect(onReturn).toHaveBeenCalledWith(
      expect.objectContaining({ employeeId: 'EMP-1', plan: submittedEmployee.plan }),
      'Please correct Tuesday hours.',
    )

    await browserUser.click(screen.getByRole('button', { name: 'Review next submission' }))
    reviewDialog = screen.getByRole('dialog', { name: 'RTD Employee 1' })
    await browserUser.click(within(reviewDialog).getByRole('button', { name: 'Accept plan' }))
    expect(onAccept).toHaveBeenCalledWith(expect.objectContaining({
      employeeId: 'EMP-1',
      plan: submittedEmployee.plan,
    }))

    await browserUser.click(screen.getByRole('button', { name: 'Has issues' }))
    expect(screen.getByText('RTD Employee 2')).toBeVisible()
    expect(screen.getByText('No signed overtime plan submitted')).toBeVisible()
  })

  test('keeps submitted department preparation read-only while allowing inspection', async () => {
    const browserUser = userEvent.setup()
    const employee = {
      employeeId: 'EMP-1',
      employeeNo: 'EMP-014',
      employeeName: 'RTD Employee 1',
      hasSignedSubmission: true,
      eligibleForDepartmentPlan: false,
      submissionState: 'submitted_signed',
      plan: {
        planId: 'PLAN-1',
        itemCount: 1,
        plannedHours: 2,
        items: [{
          planItemId: 'ITEM-1',
          plannedDate: '2026-08-31',
          plannedHours: 2,
          reason: 'Production support',
        }],
        signature: { signatureRecordId: 'SIGNATURE-1' },
      },
    }

    render(
      <DepartmentPreparationWorkspace
        days={getWeekDays('2026-08-31')}
        employees={[employee]}
        isReadOnly
        onAccept={vi.fn()}
        onReturn={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Review locked' })).toBeDisabled()
    await browserUser.click(screen.getByRole('button', {
      name: 'Inspect RTD Employee 1 overtime plan',
    }))
    const dialog = screen.getByRole('dialog', { name: 'RTD Employee 1' })
    expect(within(dialog).getByText('Production support')).toBeVisible()
    expect(within(dialog).queryByRole('button', { name: 'Accept plan' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Return' })).not.toBeInTheDocument()
  })
})
