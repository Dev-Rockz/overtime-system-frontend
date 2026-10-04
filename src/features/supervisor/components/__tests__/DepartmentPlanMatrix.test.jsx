import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { DepartmentPlanMatrix } from '../DepartmentPlanMatrix.jsx'
import { getPeriodDays, getWeekDays } from '../../utils/weekPeriod.js'

describe('DepartmentPlanMatrix', () => {
  test('hides unapproved signatures and reveals accepted signatures in the weekly grid', async () => {
    const submittedEmployee = {
      employeeId: 'EMP-1',
      employeeNo: 'EMP-014',
      employeeName: 'RTD Employee 1',
      planId: 'PLAN-1',
      plan: { planId: 'PLAN-1', remarks: 'Support the weekly production close.' },
      canAccept: true,
      matrixItems: [
        { plannedDate: '2026-08-31', plannedHours: 2, reason: 'Production support' },
        { plannedDate: '2026-09-01', plannedHours: 1.5, reason: 'Inventory count' },
      ],
      rowState: 'submitted',
      signature: {
        signatureRecordId: 'SIGNATURE-1',
        signedUrl: 'data:image/png;base64,c2lnbmF0dXJl',
      },
      statusLabel: 'Ready for review',
    }
    const missingEmployee = {
      employeeId: 'EMP-2',
      employeeNo: 'EMP-015',
      employeeName: 'RTD Employee 2',
      planId: '',
      plan: null,
      canAccept: false,
      matrixItems: [],
      rowState: 'missing',
      signature: null,
      statusLabel: 'Not submitted',
    }
    const acceptedEmployee = {
      employeeId: 'EMP-3',
      employeeNo: 'EMP-016',
      employeeName: 'RTD Employee 3',
      planId: 'PLAN-3',
      plan: { planId: 'PLAN-3' },
      canAccept: false,
      matrixItems: [],
      rowState: 'accepted',
      signature: {
        signatureRecordId: 'SIGNATURE-3',
        confirmationMethod: 'supervisor_on_behalf',
        signedUrl: 'data:image/png;base64,c2lnbmF0dXJl',
      },
      statusLabel: 'Accepted',
    }

    render(
      <DepartmentPlanMatrix
        days={getWeekDays('2026-08-31')}
        rows={[submittedEmployee, missingEmployee, acceptedEmployee]}
      />,
    )

    expect(screen.getByRole('columnheader', { name: /Mon.*Aug 31/ })).toBeVisible()
    expect(screen.getByRole('columnheader', { name: /Sun.*Sep 6/ })).toBeVisible()

    const submittedRow = screen.getByRole('rowheader', { name: /RTD Employee 1/ }).closest('tr')
    expect(within(submittedRow).getByText('2h')).toBeVisible()
    expect(within(submittedRow).getByText('1.5h')).toBeVisible()
    expect(within(submittedRow).getByText('Pending approval')).toBeVisible()
    expect(within(submittedRow).queryByRole('img', {
      name: 'RTD Employee 1 signature',
    })).not.toBeInTheDocument()
    expect(within(submittedRow).getByText('Ready for review')).toBeVisible()

    const missingRow = screen.getByRole('rowheader', { name: /RTD Employee 2/ }).closest('tr')
    expect(within(missingRow).getByText('Awaiting')).toBeVisible()
    expect(within(missingRow).getByText('Not submitted')).toBeVisible()

    expect(within(submittedRow).queryByRole('combobox')).not.toBeInTheDocument()
    expect(within(submittedRow).queryByRole('button', {
      name: /remarks/i,
    })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Employee remarks' })).not.toBeInTheDocument()

    const acceptedRow = screen.getByRole('rowheader', { name: /RTD Employee 3/ }).closest('tr')
    expect(within(acceptedRow).getByRole('img', {
      name: 'RTD Employee 3 signature',
    })).toBeVisible()
    fireEvent.click(within(acceptedRow).getByRole('button', {
      name: 'Preview RTD Employee 3 signature',
    }))
    const signatureDialog = screen.getByRole('dialog', { name: 'RTD Employee 3 signature' })
    expect(signatureDialog).toBeVisible()
    expect(within(signatureDialog).getByText(
      'Applied by the supervisor on behalf of the employee',
    )).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Close signature preview' }))

  })

  test('calculates daily totals across a monthly period', () => {
    render(
      <DepartmentPlanMatrix
        days={getPeriodDays('2026-08-01', '2026-08-31')}
        rows={[
          {
            employeeId: 'EMP-1',
            employeeName: 'Employee 1',
            matrixItems: [
              { plannedDate: '2026-08-03', plannedHours: 1 },
              { plannedDate: '2026-08-04', plannedHours: 2 },
            ],
            rowState: 'included',
            statusLabel: 'Included',
          },
          {
            employeeId: 'EMP-2',
            employeeName: 'Employee 2',
            matrixItems: [
              { plannedDate: '2026-08-03', plannedHours: 2.5 },
            ],
            rowState: 'included',
            statusLabel: 'Included',
          },
        ]}
        showDailyTotals
      />,
    )

    expect(screen.getByRole('columnheader', { name: /^Sat\s*Aug 1$/ })).toBeVisible()
    expect(screen.getByRole('columnheader', { name: /^Mon\s*Aug 31$/ })).toBeVisible()
    const totalsRow = screen.getByRole('rowheader', { name: 'Total hours' }).closest('tr')
    expect(within(totalsRow).getByText('3.5h')).toBeVisible()
    expect(within(totalsRow).getByText('5.5h period')).toBeVisible()
    expect(screen.getByRole('table')).toHaveStyle({ minWidth: '2919px' })
  })
})
