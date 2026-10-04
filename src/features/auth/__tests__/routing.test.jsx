import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import App from '../../../App.jsx'
import { supervisorApi } from '../../../api/supervisorApi.js'
import { ToastProvider } from '../../../components/shared/toast/ToastProvider.jsx'
import { AuthProvider } from '../AuthProvider.jsx'
import { storeSession } from '../session.js'

function jsonResponse(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn(),
  }
}

function renderApplication(path, configureQueryClient) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  configureQueryClient?.(queryClient)

  return render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

describe('role-based route protection', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('redirects an unauthenticated employee route to login', async () => {
    renderApplication('/employee/plans')

    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeVisible()
  })

  test('restores a saved session and keeps the requested employee route', async () => {
    const user = {
      id: 'user-1',
      firstName: 'Test',
      lastName: 'Employee',
      name: 'Test Employee',
      role: 'user',
    }
    storeSession({ token: 'employee-token', user })
    vi.stubGlobal('fetch', vi.fn((url) => {
      if (url.endsWith('/api/auth/me')) {
        return Promise.resolve(jsonResponse(200, { user }))
      }
      if (url.includes('/api/overtime/plans/calendar?')) {
        return Promise.resolve(jsonResponse(200, { calendar: [] }))
      }
      if (url.includes('/api/overtime/plans?')) {
        return Promise.resolve(jsonResponse(200, { overtimePlans: [] }))
      }
      return Promise.resolve(jsonResponse(404, { message: 'Route not found.' }))
    }))

    renderApplication('/employee/plans')

    expect(await screen.findByRole('heading', { name: 'Overtime plan' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Overtime plan' })).toHaveClass(
      'employee-nav__item--active',
    )
  })

  test('shows login errors only as a toast', async () => {
    const browserUser = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401, {
      message: 'Invalid email or password.',
      code: 'INVALID_CREDENTIALS',
    })))
    renderApplication('/login')

    await browserUser.type(screen.getByLabelText('Email address'), 'wrong@example.com')
    await browserUser.type(screen.getByLabelText('Password'), 'wrong-password')
    await browserUser.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.')
    expect(document.querySelector('.form-alert')).not.toBeInTheDocument()
  })

  test('animates successful login before entering the employee workspace', async () => {
    const browserUser = userEvent.setup()
    const user = {
      id: 'user-1',
      firstName: 'Test',
      lastName: 'Employee',
      name: 'Test Employee',
      role: 'user',
    }
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, { token: 'employee-token', user }))
      .mockResolvedValueOnce(jsonResponse(200, { user }))
      .mockResolvedValueOnce(jsonResponse(200, {
        notifications: [],
        pagination: { limit: 20, offset: 0, total: 0 },
        unreadCount: 0,
      })))
    renderApplication('/login')

    await browserUser.type(screen.getByLabelText('Email address'), 'test@example.com')
    await browserUser.type(screen.getByLabelText('Password'), 'test-password')
    await browserUser.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('button', { name: 'Successful' })).toBeVisible()
    expect(await screen.findByRole('heading', { name: 'Welcome, Test.' }, { timeout: 4000 })).toBeVisible()
    expect(await screen.findByRole('navigation', { name: 'Employee navigation' }, { timeout: 4000 })).toBeVisible()
    expect(document.querySelector('.employee-dashboard')).toHaveClass('dashboard-assemble')
    expect(document.querySelector('.login-introduction')).not.toBeInTheDocument()
  })

  test('restores a supervisor session in the supervisor workspace', async () => {
    const user = {
      id: 'supervisor-1',
      firstName: 'Maria',
      lastName: 'Santos',
      name: 'Maria Santos',
      role: 'supervisor',
    }
    storeSession({ token: 'supervisor-token', user })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { user })))

    renderApplication('/supervisor')

    expect(await screen.findByRole('heading', { name: 'Hi, Maria.' })).toBeVisible()
    expect(screen.getByRole('navigation', { name: 'Supervisor navigation' })).toBeVisible()
    expect(document.querySelector('.supervisor-dashboard')).not.toHaveClass('dashboard-assemble')
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveClass(
      'supervisor-nav__item--active',
    )
    expect(screen.getByRole('link', { name: 'Overtime department plan' })).toHaveAttribute(
      'href',
      '/supervisor/overtime-department-plans',
    )
    const supervisorLinks = within(screen.getByRole('navigation', { name: 'Supervisor navigation' }))
      .getAllByRole('link')
    expect(supervisorLinks.findIndex((link) => link.textContent.includes('Overtime department plan')))
      .toBe(supervisorLinks.findIndex((link) => link.textContent.includes('Approvals')) + 1)
  })

  test('redirects a supervisor away from employee-only routes', async () => {
    const user = {
      id: 'supervisor-1',
      firstName: 'Maria',
      lastName: 'Santos',
      name: 'Maria Santos',
      role: 'supervisor',
    }
    storeSession({ token: 'supervisor-token', user })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { user })))

    renderApplication('/employee/plans')

    expect(await screen.findByRole('heading', { name: 'Hi, Maria.' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Overtime plan' })).not.toBeInTheDocument()
  })

  test('navigates the supervisor shell and keeps profile links role-scoped', async () => {
    const user = {
      id: 'supervisor-1',
      email: 'maria@example.com',
      firstName: 'Maria',
      lastName: 'Santos',
      name: 'Maria Santos',
      role: 'supervisor',
      status: 'active',
    }
    const supervisorEmployee = {
      employeeId: 'EMP-SUPERVISOR-1',
      userId: 'supervisor-1',
      employeeNo: 'SUP-001',
      firstName: 'Maria',
      middleName: '',
      lastName: 'Santos',
      fullName: 'Maria Santos',
      email: 'maria@example.com',
      departmentId: 'DEP-RTD',
      departmentName: 'RTD',
      position: 'Department Supervisor',
      supervisorName: '',
      shift: 'day',
      employmentType: 'regular',
      status: 'active',
      userStatus: 'active',
      createdAt: '2026-08-01T00:00:00.000Z',
    }
    storeSession({ token: 'supervisor-token', user })
    vi.stubGlobal('fetch', vi.fn((url) => {
      if (url.endsWith('/api/auth/me')) {
        return Promise.resolve(jsonResponse(200, { user }))
      }
      if (url.includes('/api/notifications?')) {
        return Promise.resolve(jsonResponse(200, {
          notifications: [],
          pagination: { limit: 20, offset: 0, total: 0 },
          unreadCount: 0,
        }))
      }
      if (url.endsWith('/api/overtime/employees/me')) {
        return Promise.resolve(jsonResponse(200, { employee: supervisorEmployee }))
      }
      if (url.endsWith('/api/users/signature')) {
        return Promise.resolve(jsonResponse(404, {
          message: 'No saved signature was found.',
          code: 'SIGNATURE_NOT_FOUND',
        }))
      }
      return Promise.resolve(jsonResponse(404, { message: 'Route not found.' }))
    }))

    renderApplication('/supervisor')

    expect(await screen.findByRole('navigation', { name: 'Supervisor navigation' })).toBeVisible()
    fireEvent.click(screen.getByRole('link', { name: 'Overtime department plan' }))
    expect(await screen.findByRole('heading', { name: 'Overtime department plan' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Overtime department plan' })).toHaveClass(
      'supervisor-nav__item--active',
    )

    fireEvent.click(screen.getByRole('button', { name: /Maria Santos/ }))
    expect(screen.getByRole('menuitem', { name: 'Profile' })).toHaveAttribute(
      'href',
      '/supervisor/profile',
    )
    fireEvent.click(screen.getByRole('menuitem', { name: 'Profile' }))
    expect(await screen.findByRole('heading', { name: 'My profile' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Maria Santos' })).toBeVisible()
    expect(screen.getByText('maria@example.com')).toBeVisible()
    expect(screen.getAllByText('Department Supervisor')[0]).toBeVisible()
    expect(screen.getByText('No saved signature')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }))
    const notificationMenu = await screen.findByRole('region', { name: 'Notifications' })
    expect(within(notificationMenu).getByRole('link', {
      name: 'View all notifications',
    })).toHaveAttribute('href', '/supervisor/notifications')
  })

  test('signs a supervisor into the supervisor workspace', async () => {
    const browserUser = userEvent.setup()
    const user = {
      id: 'supervisor-1',
      firstName: 'Maria',
      lastName: 'Santos',
      name: 'Maria Santos',
      role: 'supervisor',
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse(200, { token: 'supervisor-token', user }),
    ))
    renderApplication('/login')

    await browserUser.type(screen.getByLabelText('Email address'), 'maria@example.com')
    await browserUser.type(screen.getByLabelText('Password'), 'supervisor-password')
    await browserUser.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('button', { name: 'Successful' })).toBeVisible()
    expect(await screen.findByRole('heading', { name: 'Hi, Maria.' }, { timeout: 4000 })).toBeVisible()
    expect(document.querySelector('.supervisor-dashboard')).toHaveClass('dashboard-assemble')
    expect(document.querySelector('.login-introduction')).not.toBeInTheDocument()
  })

  test('lists only the employees returned by the supervisor team endpoint', async () => {
    const user = {
      id: 'supervisor-1',
      firstName: 'Maria',
      lastName: 'Santos',
      name: 'Maria Santos',
      role: 'supervisor',
    }
    const employee = {
      employeeId: 'EMP-TEAM-1',
      userId: 'user-team-1',
      employeeNo: 'EMP-014',
      firstName: 'RTD',
      middleName: '',
      lastName: 'Employee 1',
      fullName: 'RTD Employee 1',
      email: 'employee1@example.com',
      departmentId: 'DEP-RTD',
      departmentName: 'RTD',
      position: 'Production Worker',
      shift: 'day',
      employmentType: 'agency',
      status: 'active',
      userStatus: 'active',
      supervisorName: 'Maria Santos',
      createdAt: '2026-08-01T00:00:00.000Z',
    }
    storeSession({ token: 'supervisor-token', user })
    const fetchMock = vi.fn((url) => {
      if (url.endsWith('/api/auth/me')) {
        return Promise.resolve(jsonResponse(200, { user }))
      }
      if (url.endsWith('/api/overtime/employees')) {
        return Promise.resolve(jsonResponse(200, { employees: [employee] }))
      }
      if (url.endsWith('/api/overtime/employees/EMP-TEAM-1')) {
        return Promise.resolve(jsonResponse(200, { employee }))
      }
      if (url.includes('/api/notifications?')) {
        return Promise.resolve(jsonResponse(200, {
          notifications: [],
          pagination: { limit: 20, offset: 0, total: 0 },
          unreadCount: 0,
        }))
      }
      return Promise.resolve(jsonResponse(404, { message: 'Route not found.' }))
    })
    vi.stubGlobal('fetch', fetchMock)

    renderApplication('/supervisor/team')

    expect(await screen.findByRole('heading', { name: 'My team' })).toBeVisible()
    const employeeRow = (await screen.findByText('RTD Employee 1')).closest('tr')
    expect(within(employeeRow).getByText('EMP-014')).toBeVisible()
    expect(within(employeeRow).getByText('RTD')).toBeVisible()
    expect(within(employeeRow).getByText('Production Worker')).toBeVisible()
    expect(within(employeeRow).getByText('Day')).toBeVisible()
    expect(within(employeeRow).getByText('Agency')).toBeVisible()
    expect(screen.getByText('1 employee')).toBeVisible()

    fireEvent.change(screen.getByLabelText('Search employees by name'), {
      target: { value: 'missing name' },
    })
    expect(await screen.findByText('No matching employee')).toBeVisible()
    expect(screen.getByText('0 of 1 employees')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Clear employee search' }))

    const profileLink = await screen.findByRole('link', {
      name: 'View RTD Employee 1 profile',
    })
    fireEvent.click(profileLink)
    expect(await screen.findByRole('heading', { name: 'Employee profile' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'RTD Employee 1' })).toBeVisible()
    expect(screen.getAllByText('Maria Santos')[0]).toBeVisible()

    const teamRequest = fetchMock.mock.calls.find(([url]) => (
      url.endsWith('/api/overtime/employees')
    ))
    expect(teamRequest[1].headers.get('Authorization')).toBe('Bearer supervisor-token')
    const profileRequest = fetchMock.mock.calls.find(([url]) => (
      url.endsWith('/api/overtime/employees/EMP-TEAM-1')
    ))
    expect(profileRequest[1].headers.get('Authorization')).toBe('Bearer supervisor-token')
  })

  test('prepares and submits a signed weekly department overtime plan', async () => {
    const browserUser = userEvent.setup()
    const user = {
      id: 'supervisor-1',
      firstName: 'Maria',
      lastName: 'Santos',
      name: 'Maria Santos',
      role: 'supervisor',
    }
    const dashboard = {
      departmentId: 'DEP-RTD',
      supervisorUserId: 'supervisor-1',
      includeUnassigned: false,
      periodType: 'weekly',
      periodStartDate: '2026-08-31',
      periodEndDate: '2026-09-06',
      totalEmployees: 2,
      signedSubmissionCount: 1,
      unsignedSubmissionCount: 0,
      eligibleEmployeeCount: 1,
      notSubmittedCount: 1,
      includedPlannedHours: 4,
      departmentPlan: null,
      employees: [
        {
          employeeId: 'EMP-TEAM-1',
          employeeNo: 'EMP-014',
          employeeName: 'RTD Employee 1',
          hasPlan: true,
          hasSignedSubmission: true,
          eligibleForDepartmentPlan: true,
          submissionState: 'accepted_signed',
          plan: {
            planId: 'PLAN-EMPLOYEE-1',
            status: 'supervisor_accepted',
            plannedHours: 4,
            items: [
              { plannedDate: '2026-08-31', plannedHours: 2, reason: 'Production support' },
              { plannedDate: '2026-09-01', plannedHours: 2, reason: 'Inventory count' },
            ],
            signature: {
              signatureRecordId: 'SIGNATURE-1',
              signedUrl: 'data:image/png;base64,c2lnbmF0dXJl',
              previewAvailable: true,
            },
          },
        },
        {
          employeeId: 'EMP-TEAM-2',
          employeeNo: 'EMP-015',
          employeeName: 'RTD Employee 2',
          hasPlan: false,
          hasSignedSubmission: false,
          eligibleForDepartmentPlan: false,
          submissionState: 'not_submitted',
          plan: null,
        },
      ],
    }
    const detailPlan = {
      planId: 'DEPTPLAN-1',
      departmentId: 'DEP-RTD',
      departmentName: 'RTD',
      periodType: 'weekly',
      periodStartDate: '2026-08-31',
      periodEndDate: '2026-09-06',
      planScope: 'department',
      status: 'draft',
      remarks: 'Weekly department plan.',
      items: [
        {
          planItemId: 'ITEM-1',
          employeeId: 'EMP-TEAM-1',
          employeeName: 'RTD Employee 1',
          plannedDate: '2026-08-31',
          plannedHours: 2,
          reason: 'Production support',
        },
        {
          planItemId: 'ITEM-2',
          employeeId: 'EMP-TEAM-1',
          employeeName: 'RTD Employee 1',
          plannedDate: '2026-09-01',
          plannedHours: 2,
          reason: 'Inventory count',
        },
      ],
      logs: [],
    }
    storeSession({ token: 'supervisor-token', user })
    vi.spyOn(supervisorApi, 'getDepartmentPreparation').mockReturnValue(dashboard)
    const createSpy = vi.spyOn(supervisorApi, 'createDepartmentPlan')
      .mockResolvedValue(detailPlan)
    vi.spyOn(supervisorApi, 'getDepartmentPlan').mockImplementation(async () => detailPlan)
    const submitSpy = vi.spyOn(supervisorApi, 'submitDepartmentPlan')
      .mockImplementation(async () => {
        detailPlan.status = 'pending_approval'
        return detailPlan
      })
    const fetchMock = vi.fn((input) => {
      const url = String(input)
      if (url.endsWith('/api/auth/me')) {
        return Promise.resolve(jsonResponse(200, { user }))
      }
      if (url.includes('/api/notifications?')) {
        return Promise.resolve(jsonResponse(200, {
          notifications: [],
          pagination: { limit: 20, offset: 0, total: 0 },
          unreadCount: 0,
        }))
      }
      return Promise.resolve(jsonResponse(404, { message: 'Route not found.' }))
    })
    vi.stubGlobal('fetch', fetchMock)

    renderApplication('/supervisor/department-plans', (queryClient) => {
      queryClient.setQueryDefaults(['supervisor', 'department-preparation'], {
        initialData: dashboard,
        staleTime: Infinity,
      })
      queryClient.setQueryDefaults(['supervisor', 'department-plan'], {
        initialData: detailPlan,
        staleTime: Infinity,
      })
      queryClient.setQueryData([
        'supervisor',
        'department-preparation',
        { periodStartDate: '2026-08-31', periodEndDate: '2026-09-06' },
      ], dashboard)
      queryClient.setQueryData(
        ['supervisor', 'department-plan', 'DEPTPLAN-1'],
        detailPlan,
      )
      queryClient.setQueryData([
        'supervisor',
        'department-preparation',
        '2026-08-31',
        '2026-09-06',
      ], dashboard)
    })

    expect(await screen.findByRole('heading', { name: 'Department plans' })).toBeVisible()
    await browserUser.click(screen.getByRole('tab', { name: /Preparation workspace/ }))
    expect(screen.getByRole('heading', { name: 'Department readiness' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Submitted hours by day' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Employee review queue' })).toBeVisible()
    await browserUser.click(screen.getByRole('tab', { name: 'Weekly matrix' }))
    const matrixPanel = screen.getByRole('tabpanel', { name: 'Weekly matrix' })
    expect(await within(matrixPanel).findByRole('columnheader', { name: /Mon.*Aug 31/ })).toBeVisible()
    expect(within(matrixPanel).getByRole('columnheader', { name: /Sun.*Sep 6/ })).toBeVisible()
    expect(within(matrixPanel).getByText('RTD Employee 1')).toBeVisible()
    expect(within(matrixPanel).getByText('RTD Employee 2')).toBeVisible()
    expect(within(matrixPanel).getByRole('img', { name: 'RTD Employee 1 signature' })).toBeVisible()
    expect(within(matrixPanel).getByText('Not submitted')).toBeVisible()

    await browserUser.click(screen.getByRole('button', { name: 'Create department draft' }))
    const prepareDialog = screen.getByRole('dialog', { name: 'Create department draft' })
    expect(within(prepareDialog).getByText('RTD Employee 2')).toBeVisible()
    expect(within(prepareDialog).getByText('Employees without a signed submission')).toBeVisible()
    await browserUser.click(within(prepareDialog).getByRole('button', {
      name: 'Create draft',
    }))
    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1))

    expect(await screen.findByRole('heading', {
      name: /Aug 31, 2026 - Sep 06, 2026/,
    })).toBeVisible()
    await browserUser.click(screen.getByRole('button', { name: 'Review and submit' }))
    const submitDialog = screen.getByRole('dialog', { name: 'Submit department plan' })
    expect(within(submitDialog).getByText('RTD Employee 2')).toBeVisible()
    expect(within(submitDialog).getByText('Your saved signature will be applied automatically')).toBeVisible()
    await browserUser.click(within(submitDialog).getByRole('button', {
      name: 'Submit and sign',
    }))

    await waitFor(() => {
      expect(submitSpy).toHaveBeenCalledWith('DEPTPLAN-1', 'Weekly department plan.')
    })
    expect(await screen.findByText('Department plan workflow started')).toBeVisible()
  })

  test('lists department drafts in week and month calendar views', async () => {
    const browserUser = userEvent.setup()
    const user = {
      id: 'supervisor-1',
      firstName: 'Maria',
      lastName: 'Santos',
      name: 'Maria Santos',
      role: 'supervisor',
    }
    const anchor = new Date()
    const day = anchor.getDay()
    const monday = new Date(anchor)
    monday.setDate(anchor.getDate() - (day === 0 ? 6 : day - 1))
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    const secondDay = new Date(monday)
    secondDay.setDate(monday.getDate() + 1)
    const dateValue = (date) => [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-')
    const draft = {
      planId: 'DEPTPLAN-DRAFT-1',
      departmentId: 'DEP-RTD',
      departmentName: 'RTD',
      periodType: 'weekly',
      periodStartDate: dateValue(monday),
      periodEndDate: dateValue(sunday),
      planScope: 'department',
      status: 'draft',
      remarks: 'Current production draft.',
      itemCount: 2,
      plannedHours: 5,
      items: [
        {
          planItemId: 'DRAFT-ITEM-1',
          employeeId: 'EMP-TEAM-1',
          employeeNo: 'EMP-014',
          employeeName: 'RTD Employee 1',
          plannedDate: dateValue(monday),
          plannedHours: 2,
          reason: 'Production support',
        },
        {
          planItemId: 'DRAFT-ITEM-2',
          employeeId: 'EMP-TEAM-2',
          employeeNo: 'EMP-015',
          employeeName: 'RTD Employee 2',
          plannedDate: dateValue(secondDay),
          plannedHours: 3,
          reason: 'Inventory count',
        },
      ],
    }
    storeSession({ token: 'supervisor-token', user })
    const listDraftsSpy = vi.spyOn(supervisorApi, 'listDepartmentDrafts')
      .mockResolvedValueOnce([draft])
      .mockResolvedValue([])
    const deleteDraftSpy = vi.spyOn(supervisorApi, 'deleteDepartmentDraft')
      .mockResolvedValue(draft)
    vi.stubGlobal('fetch', vi.fn((input) => {
      const url = String(input)
      if (url.endsWith('/api/auth/me')) return Promise.resolve(jsonResponse(200, { user }))
      if (url.includes('/api/notifications?')) {
        return Promise.resolve(jsonResponse(200, {
          notifications: [],
          pagination: { limit: 20, offset: 0, total: 0 },
          unreadCount: 0,
        }))
      }
      return Promise.resolve(jsonResponse(404, { message: 'Route not found.' }))
    }))

    renderApplication('/supervisor/department-drafts')

    expect(await screen.findByRole('heading', { name: 'Department drafts' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Department drafts' })).toHaveClass(
      'supervisor-nav__item--active',
    )
    expect(await screen.findByText('Draft list')).toBeVisible()
    expect(screen.getAllByText('RTD Employee 1').length).toBeGreaterThan(0)
    expect(screen.getAllByText('RTD Employee 2').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'Open draft' })).toHaveAttribute(
      'href',
      '/supervisor/department-plans/DEPTPLAN-DRAFT-1',
    )
    expect(listDraftsSpy).toHaveBeenCalledWith(expect.objectContaining({
      dateFrom: dateValue(monday),
      dateTo: dateValue(sunday),
    }))

    await browserUser.click(screen.getByRole('button', { name: 'Delete draft' }))
    const deleteDialog = screen.getByRole('dialog', { name: 'Delete department draft?' })
    expect(within(deleteDialog).getByText(/Employee source plans remain unchanged/)).toBeVisible()
    await browserUser.click(within(deleteDialog).getByRole('button', { name: 'Delete draft' }))
    await waitFor(() => expect(deleteDraftSpy).toHaveBeenCalledWith('DEPTPLAN-DRAFT-1'))
    expect(await screen.findByText('Department draft deleted.')).toBeVisible()
    expect(await screen.findByText('No editable department drafts in this week')).toBeVisible()

    await browserUser.click(screen.getByRole('button', { name: 'Month' }))
    expect(screen.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Select draft date')).toHaveAttribute('type', 'month')
    expect(await screen.findByText('Sun')).toBeVisible()
  })

  test('shows a toast after logout redirects to login', async () => {
    const user = {
      id: 'user-1',
      firstName: 'Test',
      lastName: 'Employee',
      name: 'Test Employee',
      role: 'user',
    }
    storeSession({ token: 'employee-token', user })
    vi.stubGlobal('fetch', vi.fn((url) => {
      if (url.endsWith('/api/auth/me')) return Promise.resolve(jsonResponse(200, { user }))
      if (url.includes('/api/overtime/plans/items?')) {
        return Promise.resolve(jsonResponse(200, { overtimePlanItems: [] }))
      }
      if (url.includes('/api/overtime/plans?')) {
        return Promise.resolve(jsonResponse(200, { overtimePlans: [] }))
      }
      if (url.includes('/api/overtime/actual-periods?')) {
        return Promise.resolve(jsonResponse(200, { actualPeriods: [] }))
      }
      if (url.includes('/api/notifications?')) {
        return Promise.resolve(jsonResponse(200, {
          notifications: [],
          pagination: { limit: 20, offset: 0, total: 0 },
          unreadCount: 0,
        }))
      }
      return Promise.resolve(jsonResponse(404, { message: 'Route not found.' }))
    }))
    renderApplication('/employee')

    expect(await screen.findByRole('heading', { name: 'Welcome, Test.' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Test Employee' }))

    expect(screen.getByRole('menuitem', { name: 'Profile' })).toHaveAttribute(
      'href',
      '/employee/profile',
    )
    fireEvent.click(screen.getByRole('menuitem', { name: 'Logout' }))

    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('Logged out successfully.')
  })

  test('shows the employee weekly dashboard from plan, actual, and notification data', async () => {
    const browserUser = userEvent.setup()
    const user = {
      id: 'user-1',
      firstName: 'Test',
      lastName: 'Employee',
      name: 'Test Employee',
      role: 'user',
    }
    const monday = new Date()
    const day = monday.getDay()
    monday.setHours(0, 0, 0, 0)
    monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1))
    const toDateValue = (date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const dateNumber = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${dateNumber}`
    }
    const addDays = (date, daysToAdd) => {
      const nextDate = new Date(date)
      nextDate.setDate(nextDate.getDate() + daysToAdd)
      return nextDate
    }
    const periodStartDate = toDateValue(monday)
    const secondDate = toDateValue(addDays(monday, 1))
    const periodEndDate = toDateValue(addDays(monday, 6))
    const plan = {
      planId: 'PLAN-DASHBOARD-1',
      periodType: 'weekly',
      periodStartDate,
      periodEndDate,
      plannedHours: 6,
      status: 'supervisor_accepted',
      updatedAt: '2026-08-24T09:00:00.000Z',
    }
    const draftPlan = {
      ...plan,
      planId: 'PLAN-DASHBOARD-2',
      plannedHours: 4,
      status: 'draft',
      updatedAt: '2026-08-23T09:00:00.000Z',
    }
    const approvedPlan = {
      ...plan,
      planId: 'PLAN-DASHBOARD-FINAL',
      plannedHours: 99,
      status: 'approved',
      updatedAt: '2026-08-21T09:00:00.000Z',
    }
    const returnedPlan = {
      ...plan,
      planId: 'PLAN-DASHBOARD-RETURNED',
      plannedHours: 8,
      status: 'supervisor_returned',
      updatedAt: '2026-08-22T09:00:00.000Z',
    }
    const items = [
      {
        planItemId: 'ITEM-1',
        planId: plan.planId,
        plannedDate: periodStartDate,
        plannedHours: 2,
        reason: 'Release support',
      },
      {
        planItemId: 'ITEM-2',
        planId: plan.planId,
        plannedDate: secondDate,
        plannedHours: 4,
        reason: 'Data review',
      },
    ]
    const actualPeriod = {
      actualPeriodId: 'ACTUAL-DASHBOARD-1',
      periodType: 'weekly',
      periodStartDate,
      periodEndDate,
      status: 'open',
    }
    storeSession({ token: 'employee-token', user })
    vi.stubGlobal('fetch', vi.fn((url) => {
      if (url.endsWith('/api/auth/me')) {
        return Promise.resolve(jsonResponse(200, { user }))
      }
      if (url.includes('/api/overtime/plans/items?')) {
        return Promise.resolve(jsonResponse(200, { overtimePlanItems: items }))
      }
      if (url.includes('/api/overtime/plans?')) {
        return Promise.resolve(jsonResponse(200, {
          overtimePlans: [plan, draftPlan, returnedPlan, approvedPlan],
        }))
      }
      if (url.includes('/api/overtime/actual-periods?')) {
        return Promise.resolve(jsonResponse(200, { actualPeriods: [actualPeriod] }))
      }
      if (url.endsWith(`/api/overtime/actual-periods/${actualPeriod.actualPeriodId}`)) {
        return Promise.resolve(jsonResponse(200, {
          actualPeriod: {
            ...actualPeriod,
            entries: [
              {
                actualEntryId: 'ACTUAL-ENTRY-1',
                actualDate: secondDate,
                plannedHours: 2,
                actualHours: 3,
                varianceHours: 1,
                isPending: false,
                lastUpdatedAt: '2026-08-24T10:00:00.000Z',
              },
              {
                actualEntryId: 'ACTUAL-ENTRY-2',
                actualDate: periodStartDate,
                plannedHours: 4,
                actualHours: 0,
                varianceHours: 0,
                isPending: true,
                lastUpdatedAt: '',
              },
            ],
          },
        }))
      }
      if (url.includes('/api/notifications?')) {
        return Promise.resolve(jsonResponse(200, {
          notifications: [{
            notificationId: 'NOTIFICATION-DASHBOARD-1',
            title: 'Plan approved by supervisor',
            message: 'Your weekly plan is moving to management review.',
            type: 'plan_status_changed',
            readAt: '',
            createdAt: '2026-08-24T08:00:00.000Z',
          }],
          pagination: { limit: 20, offset: 0, total: 1 },
          unreadCount: 1,
        }))
      }
      return Promise.resolve(jsonResponse(404, { message: 'Route not found.' }))
    }))

    renderApplication('/employee')

    expect(await screen.findByRole('heading', { name: 'Planned vs actual' })).toBeVisible()
    expect(screen.getByRole('timer', { name: 'Current time' })).toHaveTextContent(/\d{2}:\d{2}:\d{2}/)
    expect(screen.getByText('Today is')).toBeVisible()
    const periodDetails = screen.getByRole('region', { name: 'Current week details' })
    expect(within(periodDetails).getByText('Planned').closest('li')).toHaveTextContent('6h')
    expect(within(periodDetails).getByText('Actual').closest('li')).toHaveTextContent('3h')
    expect(within(periodDetails).getByText('Variance').closest('li')).toHaveTextContent('+1h')
    expect(screen.getByRole('progressbar', {
      name: '3 of 32 monthly overtime hours used',
    })).toHaveAttribute('aria-valuenow', '3')
    expect(screen.getByText('29h remaining')).toBeVisible()
    expect(screen.queryByText('Needs attention')).not.toBeInTheDocument()
    const bulletin = screen.getByRole('region', { name: 'Action required bulletin' })
    expect(within(bulletin).getByRole('heading', { name: 'Action required' })).toBeVisible()
    expect(within(bulletin).getByText('2 actions')).toBeVisible()
    expect(within(bulletin).getByText('Revision')).toBeVisible()
    expect(within(bulletin).getByText('Draft')).toBeVisible()
    expect(within(bulletin).getByText('1 returned plan needs revision')).toBeVisible()
    expect(within(bulletin).getByText('1 draft plan is not submitted')).toBeVisible()
    expect(within(bulletin).queryByText(/Actual OT .*completion/i)).not.toBeInTheDocument()
    expect(screen.getByText('Release support')).toBeVisible()
    expect(screen.getByText('Plan approved by supervisor')).toBeVisible()
    let workflow = screen.getByRole('region', { name: 'Overtime plan workflow' })
    expect(within(workflow).getByText('Supervisor accepted')).toBeVisible()
    expect(within(workflow).getByText('1 / 3')).toBeVisible()
    expect(screen.queryByText('99h')).not.toBeInTheDocument()
    await browserUser.click(within(workflow).getByRole('button', { name: 'Next workflow' }))
    workflow = await screen.findByRole('region', { name: 'Overtime plan workflow' })
    expect(within(workflow).getByText('Draft')).toBeVisible()
    expect(within(workflow).getByText('2 / 3')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Bar chart' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Previous week' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Next week' })).toBeVisible()
    const dashboardDateInput = document.querySelector(
      'input[aria-label="Select dashboard date"]',
    )
    expect(dashboardDateInput).toBeInTheDocument()
    fireEvent.change(dashboardDateInput, {
      target: { value: periodStartDate },
    })
    expect(dashboardDateInput).toHaveValue(periodStartDate)

    const lineChartButton = await screen.findByRole('button', { name: 'Line chart' })
    await browserUser.click(lineChartButton)
    expect(screen.getByRole('button', { name: 'Line chart' })).toHaveAttribute('aria-pressed', 'true')
    await browserUser.click(screen.getByRole('button', { name: 'Area chart' }))
    expect(screen.getByRole('button', { name: 'Area chart' })).toHaveAttribute('aria-pressed', 'true')
    await browserUser.click(screen.getByRole('button', { name: 'Month' }))
    expect(await screen.findByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Previous month' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Next month' })).toBeVisible()
  }, 15_000)

  test('shows a current-week bulletin reminder when no overtime plan was submitted', async () => {
    const user = {
      id: 'user-1',
      firstName: 'Test',
      lastName: 'Employee',
      name: 'Test Employee',
      role: 'user',
    }
    storeSession({ token: 'employee-token', user })
    vi.stubGlobal('fetch', vi.fn((url) => {
      if (url.endsWith('/api/auth/me')) {
        return Promise.resolve(jsonResponse(200, { user }))
      }
      if (url.includes('/api/overtime/plans/items?')) {
        return Promise.resolve(jsonResponse(200, { overtimePlanItems: [] }))
      }
      if (url.includes('/api/overtime/plans?')) {
        return Promise.resolve(jsonResponse(200, { overtimePlans: [] }))
      }
      if (url.includes('/api/overtime/actual-periods?')) {
        return Promise.resolve(jsonResponse(200, { actualPeriods: [] }))
      }
      if (url.includes('/api/notifications?')) {
        return Promise.resolve(jsonResponse(200, {
          notifications: [],
          pagination: { limit: 20, offset: 0, total: 0 },
          unreadCount: 0,
        }))
      }
      return Promise.resolve(jsonResponse(404, { message: 'Route not found.' }))
    }))

    renderApplication('/employee')

    const bulletin = await screen.findByRole('region', { name: 'Action required bulletin' })
    expect(within(bulletin).getByText('1 action')).toBeVisible()
    expect(within(bulletin).getByText('No OT plan submitted for the current week')).toBeVisible()
    expect(screen.queryByRole('region', { name: 'Overtime plan workflow' })).not.toBeInTheDocument()
  })

  test('loads the employee profile and treats a missing signature as an empty state', async () => {
    const user = {
      id: 'user-1',
      firstName: 'Test',
      lastName: 'Employee',
      name: 'Test Employee',
      role: 'user',
    }
    const employee = {
      employeeId: 'EMPLOYEE-1',
      userId: 'user-1',
      employeeNo: 'EMP-001',
      firstName: 'Test',
      middleName: '',
      lastName: 'Employee',
      fullName: 'Test Employee',
      email: 'test@example.com',
      departmentId: 'DEPT-1',
      departmentName: 'Engineering',
      position: 'Developer',
      supervisorUserId: 'supervisor-1',
      supervisorName: 'Sample Supervisor',
      shift: 'day',
      employmentType: 'regular',
      status: 'active',
      userStatus: 'active',
      createdAt: '2026-08-01T00:00:00.000Z',
    }

    storeSession({ token: 'employee-token', user })
    vi.stubGlobal('fetch', vi.fn((url) => {
      if (url.endsWith('/api/auth/me')) {
        return Promise.resolve(jsonResponse(200, { user }))
      }
      if (url.endsWith('/api/overtime/employees/me')) {
        return Promise.resolve(jsonResponse(200, { employee }))
      }
      if (url.endsWith('/api/users/signature')) {
        return Promise.resolve(jsonResponse(404, {
          message: 'No saved signature was found.',
          code: 'SIGNATURE_NOT_FOUND',
        }))
      }

      return Promise.resolve(jsonResponse(404, { message: 'Route not found.' }))
    }))

    renderApplication('/employee/profile')

    expect(await screen.findByRole('heading', { name: 'My profile' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Test Employee' })).toBeVisible()
    expect(screen.getByText('Engineering')).toBeVisible()
    expect(screen.getByText('Sample Supervisor')).toBeVisible()
    expect(screen.getByText('No saved signature')).toBeVisible()
  })

  test('loads the authenticated employee overtime plan list', async () => {
    const browserUser = userEvent.setup()
    const user = {
      id: 'user-1',
      firstName: 'Test',
      lastName: 'Employee',
      name: 'Test Employee',
      role: 'user',
    }
    const overtimePlan = {
      planId: 'PLAN-1',
      departmentId: 'DEPT-1',
      departmentName: 'Engineering',
      periodType: 'weekly',
      periodStartDate: '2026-08-17',
      periodEndDate: '2026-08-23',
      status: 'approved',
      planScope: 'employee',
      itemCount: 3,
      plannedHours: 12.5,
      updatedAt: '2026-08-17T08:00:00.000Z',
    }
    const now = new Date()
    const calendarDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-19`
    const calendar = [{
      date: calendarDate,
      itemCount: 1,
      employeeCount: 1,
      planCount: 1,
      plannedHours: 4,
      statuses: ['submitted_to_supervisor'],
    }]

    storeSession({ token: 'employee-token', user })
    const fetchMock = vi.fn((url) => {
      if (url.endsWith('/api/auth/me')) {
        return Promise.resolve(jsonResponse(200, { user }))
      }
      if (url.includes('/api/overtime/plans/calendar?')) {
        return Promise.resolve(jsonResponse(200, { calendar }))
      }
      if (url.includes('/api/overtime/plans?')) {
        return Promise.resolve(jsonResponse(200, { overtimePlans: [overtimePlan] }))
      }

      return Promise.resolve(jsonResponse(404, { message: 'Route not found.' }))
    })
    vi.stubGlobal('fetch', fetchMock)

    renderApplication('/employee/plans')

    expect(await screen.findByRole('heading', { name: 'Overtime plan' })).toBeVisible()
    expect((await screen.findAllByText('Engineering'))[0]).toBeVisible()
    expect(screen.getAllByText('Approved')[0]).toBeVisible()
    expect(screen.getAllByText('12.5')[0]).toBeVisible()
    expect(await screen.findByText('1 plan')).toBeVisible()
    expect(screen.getByText('4h')).toBeVisible()
    expect(
      [...document.querySelectorAll('.ot-calendar__weekday')].map((element) => element.textContent),
    ).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])

    const plansRequest = fetchMock.mock.calls.find(([url]) => url.includes('/api/overtime/plans?'))
    expect(plansRequest[0]).toContain('limit=11')
    expect(plansRequest[1].headers.get('Authorization')).toBe('Bearer employee-token')

    const initialPlanRequestCount = fetchMock.mock.calls.filter(([url]) => (
      url.includes('/api/overtime/plans?')
    )).length
    const initialCalendarRequestCount = fetchMock.mock.calls.filter(([url]) => (
      url.includes('/api/overtime/plans/calendar?')
    )).length
    await browserUser.click(screen.getByRole('button', { name: 'Refresh overtime plans' }))
    await waitFor(() => {
      expect(fetchMock.mock.calls.filter(([url]) => (
        url.includes('/api/overtime/plans?')
      )).length).toBeGreaterThan(initialPlanRequestCount)
      expect(fetchMock.mock.calls.filter(([url]) => (
        url.includes('/api/overtime/plans/calendar?')
      )).length).toBeGreaterThan(initialCalendarRequestCount)
    })

    await browserUser.selectOptions(screen.getByLabelText('Plan period'), 'monthly')
    expect(screen.getByLabelText('Selected month')).toBeVisible()

    await waitFor(() => {
      const monthlyRequest = fetchMock.mock.calls.find(([url]) => (
        url.includes('periodType=monthly')
        && url.includes('dateFrom=')
        && url.includes('dateTo=')
      ))
      expect(monthlyRequest).toBeDefined()
    })
  })

  test('loads an employee-visible overtime plan detail', async () => {
    const browserUser = userEvent.setup()
    const user = {
      id: 'user-1',
      firstName: 'Test',
      lastName: 'Employee',
      name: 'Test Employee',
      role: 'user',
    }
    const overtimePlan = {
      planId: 'PLAN-1',
      departmentName: 'Engineering',
      periodType: 'weekly',
      periodStartDate: '2026-08-17',
      periodEndDate: '2026-08-23',
      status: 'draft',
      planScope: 'employee',
      itemCount: 1,
      plannedHours: 4,
      createdByName: 'Test Employee',
      createdAt: '2026-08-17T08:00:00.000Z',
      remarks: 'Week 34 overtime plan.',
      rejectionReason: '',
      items: [{
        planItemId: 'ITEM-1',
        plannedDate: '2026-08-19',
        plannedHours: 4,
        reason: 'Complete month-end reports.',
      }],
      logs: [{
        logId: 'LOG-1',
        action: 'plan_created',
        actionByName: 'Test Employee',
        actionAt: '2026-08-17T08:00:00.000Z',
        remarks: 'Overtime plan created.',
      }],
      workflowProgress: {
        departmentPlanStatus: '',
        stages: [
          {
            key: 'draft_created',
            label: 'Plan created',
            state: 'completed',
            detail: 'Your employee overtime plan was created.',
            completedAt: '2026-08-17T08:00:00.000Z',
          },
          {
            key: 'supervisor_review',
            label: 'Supervisor review',
            state: 'pending',
            detail: 'Submit the completed draft to your supervisor.',
            completedAt: null,
          },
        ],
      },
    }
    const submittedPlan = {
      ...overtimePlan,
      status: 'submitted_to_supervisor',
      logs: [
        ...overtimePlan.logs,
        {
          logId: 'LOG-2',
          action: 'submitted_to_supervisor',
          actionByName: 'Test Employee',
          actionAt: '2026-08-17T09:00:00.000Z',
          remarks: 'Please review this weekly plan.',
        },
      ],
    }

    storeSession({ token: 'employee-token', user })
    const fetchMock = vi.fn((url, options = {}) => {
      if (url.endsWith('/api/auth/me')) {
        return Promise.resolve(jsonResponse(200, { user }))
      }
      if (url.includes('/api/notifications?')) {
        return Promise.resolve(jsonResponse(200, {
          notifications: [],
          pagination: { limit: 20, offset: 0, total: 0 },
          unreadCount: 0,
        }))
      }
      if (url.endsWith('/api/overtime/plans/PLAN-1/submit-and-sign') && options.method === 'PATCH') {
        return Promise.resolve(jsonResponse(200, {
          plan: submittedPlan,
          signatureRecord: { signatureRecordId: 'SIGNATURE-RECORD-1', status: 'active' },
        }))
      }
      if (url.endsWith('/api/overtime/plans/PLAN-1')) {
        return Promise.resolve(jsonResponse(200, { overtimePlan }))
      }

      return Promise.resolve(jsonResponse(404, { message: 'Route not found.' }))
    })
    vi.stubGlobal('fetch', fetchMock)

    renderApplication('/employee/plans/PLAN-1')

    expect(await screen.findByRole('heading', { name: 'Overtime plan details' })).toBeVisible()
    expect(await screen.findByText('Complete month-end reports.')).toBeVisible()
    expect(screen.getByText('Week 34 overtime plan.')).toBeVisible()
    expect(screen.getByText('Overtime plan created.')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Workflow progress' })).toBeVisible()
    expect(screen.getByText('Submit the completed draft to your supervisor.')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Back to overtime plans' })).toHaveAttribute(
      'href',
      '/employee/plans',
    )
    expect(screen.getByRole('link', { name: 'Edit plan' })).toHaveAttribute(
      'href',
      '/employee/plans/PLAN-1/edit',
    )

    await browserUser.click(screen.getByRole('button', { name: 'Submit plan' }))
    expect(screen.getByRole('dialog', { name: 'Sign and submit plan?' })).toBeVisible()
    expect(screen.getByText('Your saved signature will be attached')).toBeVisible()
    expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/submit-and-sign'))).toBe(false)

    await browserUser.type(
      screen.getByLabelText(/Submission remarks/),
      'Please review this weekly plan.',
    )
    await browserUser.click(screen.getByRole('button', { name: 'Sign and submit' }))

    expect((await screen.findAllByText('Submitted To Supervisor'))[0]).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Edit plan' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Submit plan' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete plan' })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Overtime plan signed and submitted to your supervisor.',
    )

    const submitRequest = fetchMock.mock.calls.find(([url]) => url.endsWith('/submit-and-sign'))
    expect(submitRequest[1].method).toBe('PATCH')
    expect(submitRequest[1].headers.get('Authorization')).toBe('Bearer employee-token')
    expect(JSON.parse(submitRequest[1].body)).toEqual({
      remarks: 'Please review this weekly plan.',
    })
  })

  test('withdraws a submitted plan back to draft before supervisor review', async () => {
    const browserUser = userEvent.setup()
    const user = {
      id: 'user-1',
      firstName: 'Test',
      lastName: 'Employee',
      name: 'Test Employee',
      role: 'user',
    }
    const submittedPlan = {
      planId: 'PLAN-WITHDRAW',
      departmentName: 'Engineering',
      periodType: 'weekly',
      periodStartDate: '2026-08-17',
      periodEndDate: '2026-08-23',
      status: 'submitted_to_supervisor',
      planScope: 'employee',
      itemCount: 1,
      plannedHours: 3,
      createdByName: 'Test Employee',
      createdAt: '2026-08-17T08:00:00.000Z',
      updatedAt: '2026-08-17T09:00:00.000Z',
      items: [{
        planItemId: 'ITEM-WITHDRAW',
        plannedDate: '2026-08-19',
        plannedHours: 3,
        reason: 'Complete reports.',
      }],
      logs: [],
    }
    const withdrawnPlan = {
      ...submittedPlan,
      status: 'draft',
      submittedAt: null,
      updatedAt: '2026-08-17T10:00:00.000Z',
      logs: [{
        logId: 'LOG-WITHDRAW',
        action: 'submission_withdrawn',
        actionByName: 'Test Employee',
        actionAt: '2026-08-17T10:00:00.000Z',
        remarks: 'The planned dates need correction.',
      }],
    }
    let currentPlan = submittedPlan

    storeSession({ token: 'employee-token', user })
    const fetchMock = vi.fn((url, options = {}) => {
      if (url.endsWith('/api/auth/me')) {
        return Promise.resolve(jsonResponse(200, { user }))
      }
      if (url.includes('/api/notifications?')) {
        return Promise.resolve(jsonResponse(200, {
          notifications: [],
          pagination: { limit: 20, offset: 0, total: 0 },
          unreadCount: 0,
        }))
      }
      if (url.endsWith('/api/overtime/plans/PLAN-WITHDRAW/withdraw') && options.method === 'PATCH') {
        currentPlan = withdrawnPlan
        return Promise.resolve(jsonResponse(200, {
          message: 'Employee overtime plan withdrawn successfully.',
          plan: withdrawnPlan,
        }))
      }
      if (url.endsWith('/api/overtime/plans/PLAN-WITHDRAW')) {
        return Promise.resolve(jsonResponse(200, { overtimePlan: currentPlan }))
      }

      return Promise.resolve(jsonResponse(404, { message: 'Route not found.' }))
    })
    vi.stubGlobal('fetch', fetchMock)

    renderApplication('/employee/plans/PLAN-WITHDRAW')

    await browserUser.click(await screen.findByRole('button', { name: 'Withdraw' }))
    expect(screen.getByRole('dialog', { name: 'Withdraw submission?' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Withdraw submission' })).toBeDisabled()

    await browserUser.type(
      screen.getByLabelText(/Withdrawal reason/),
      'The planned dates need correction.',
    )
    await browserUser.click(screen.getByRole('button', { name: 'Withdraw submission' }))

    expect((await screen.findAllByText('Draft'))[0]).toBeVisible()
    expect(screen.getByRole('link', { name: 'Edit plan' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Withdraw' })).not.toBeInTheDocument()
    expect(screen.getByText('Overtime plan withdrawn and returned to draft.')).toBeVisible()

    const withdrawRequest = fetchMock.mock.calls.find(([url]) => url.endsWith('/withdraw'))
    expect(withdrawRequest[1].method).toBe('PATCH')
    expect(withdrawRequest[1].headers.get('Authorization')).toBe('Bearer employee-token')
    expect(JSON.parse(withdrawRequest[1].body)).toEqual({
      remarks: 'The planned dates need correction.',
    })
  })

  test('deletes an eligible employee overtime plan after confirmation', async () => {
    const browserUser = userEvent.setup()
    const user = {
      id: 'user-1',
      firstName: 'Test',
      lastName: 'Employee',
      name: 'Test Employee',
      role: 'user',
    }
    const overtimePlan = {
      planId: 'PLAN-RETURNED',
      departmentName: 'Engineering',
      periodType: 'weekly',
      periodStartDate: '2026-08-17',
      periodEndDate: '2026-08-23',
      status: 'supervisor_returned',
      planScope: 'employee',
      itemCount: 2,
      plannedHours: 5,
      createdByName: 'Test Employee',
      createdAt: '2026-08-17T08:00:00.000Z',
      items: [],
      logs: [],
    }

    storeSession({ token: 'employee-token', user })
    const fetchMock = vi.fn((url, options = {}) => {
      if (url.endsWith('/api/auth/me')) {
        return Promise.resolve(jsonResponse(200, { user }))
      }
      if (url.includes('/api/notifications?')) {
        return Promise.resolve(jsonResponse(200, {
          notifications: [],
          pagination: { limit: 20, offset: 0, total: 0 },
          unreadCount: 0,
        }))
      }
      if (url.endsWith('/api/overtime/plans/PLAN-RETURNED') && options.method === 'DELETE') {
        return Promise.resolve(jsonResponse(200, {
          message: 'Overtime plan deleted successfully.',
          overtimePlan,
        }))
      }
      if (url.endsWith('/api/overtime/plans/PLAN-RETURNED')) {
        return Promise.resolve(jsonResponse(200, { overtimePlan }))
      }
      if (url.includes('/api/overtime/plans/calendar?')) {
        return Promise.resolve(jsonResponse(200, { calendar: [] }))
      }
      if (url.includes('/api/overtime/plans?')) {
        return Promise.resolve(jsonResponse(200, { overtimePlans: [] }))
      }

      return Promise.resolve(jsonResponse(404, { message: 'Route not found.' }))
    })
    vi.stubGlobal('fetch', fetchMock)

    renderApplication('/employee/plans/PLAN-RETURNED')

    expect(await screen.findByRole('button', { name: 'Delete plan' })).toBeVisible()
    await browserUser.click(screen.getByRole('button', { name: 'Delete plan' }))

    expect(screen.getByRole('dialog', { name: 'Delete overtime plan?' })).toBeVisible()
    expect(screen.getByText('This action cannot be undone')).toBeVisible()
    expect(fetchMock.mock.calls.some(([, options]) => options.method === 'DELETE')).toBe(false)

    await browserUser.click(screen.getByRole('button', { name: 'Delete permanently' }))

    expect(await screen.findByRole('heading', { name: 'Overtime plan' })).toBeVisible()
    expect(screen.getByText('Overtime plan deleted successfully.')).toBeVisible()

    const deleteRequest = fetchMock.mock.calls.find(([, options]) => options.method === 'DELETE')
    expect(deleteRequest[0]).toMatch(/\/api\/overtime\/plans\/PLAN-RETURNED$/)
    expect(deleteRequest[1].headers.get('Authorization')).toBe('Bearer employee-token')
  })

  test('creates a weekly draft from the generated date template', async () => {
    const browserUser = userEvent.setup()
    const user = {
      id: 'user-1',
      firstName: 'Test',
      lastName: 'Employee',
      name: 'Test Employee',
      role: 'user',
    }
    const savedPlan = {
      planId: 'PLAN-NEW',
      departmentName: 'Engineering',
      periodType: 'weekly',
      periodStartDate: '2026-08-17',
      periodEndDate: '2026-08-23',
      status: 'draft',
      planScope: 'employee',
      itemCount: 1,
      plannedHours: 2.5,
      createdByName: 'Test Employee',
      createdAt: '2026-08-18T08:00:00.000Z',
      remarks: '',
      items: [{
        planItemId: 'ITEM-NEW',
        plannedDate: '2026-08-17',
        plannedHours: 2.5,
        reason: 'Prepare customer reports.',
      }],
      logs: [],
    }

    storeSession({ token: 'employee-token', user })
    const fetchMock = vi.fn((url, options = {}) => {
      if (url.endsWith('/api/auth/me')) {
        return Promise.resolve(jsonResponse(200, { user }))
      }
      if (url.includes('/api/notifications?')) {
        return Promise.resolve(jsonResponse(200, {
          notifications: [],
          pagination: { limit: 20, offset: 0, total: 0 },
          unreadCount: 0,
        }))
      }
      if (url.endsWith('/api/overtime/plans/draft') && options.method === 'POST') {
        return Promise.resolve(jsonResponse(201, { overtimePlan: savedPlan }))
      }
      if (url.endsWith('/api/overtime/plans/PLAN-NEW')) {
        return Promise.resolve(jsonResponse(200, { overtimePlan: savedPlan }))
      }

      return Promise.resolve(jsonResponse(404, { message: 'Route not found.' }))
    })
    vi.stubGlobal('fetch', fetchMock)

    renderApplication('/employee/plans/new')

    expect(await screen.findByText('Plan period')).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Create overtime plan' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Back to overtime plans' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Create OT plan' })).toHaveClass(
      'employee-nav__item--active',
    )
    expect(screen.getByRole('link', { name: 'Overtime plan' })).not.toHaveClass(
      'employee-nav__item--active',
    )

    fireEvent.change(screen.getByLabelText('Select week'), { target: { value: '2026-W34' } })
    await browserUser.click(screen.getAllByRole('button', { name: /^Include / })[0])
    await browserUser.type(screen.getByLabelText('Planned hours'), '2.5')
    await browserUser.type(screen.getAllByLabelText('Reason')[0], 'Prepare customer reports.')
    await browserUser.click(screen.getByRole('button', { name: 'Create draft plan' }))

    expect(await screen.findByRole('heading', { name: 'Overtime plan details' })).toBeVisible()

    const createRequest = fetchMock.mock.calls.find(([url, options]) => (
      url.endsWith('/api/overtime/plans/draft') && options?.method === 'POST'
    ))
    expect(JSON.parse(createRequest[1].body)).toEqual({
      periodType: 'weekly',
      periodStartDate: '2026-08-17',
      periodEndDate: '2026-08-23',
      items: [{
        plannedDate: '2026-08-17',
        plannedHours: 2.5,
        reason: 'Prepare customer reports.',
      }],
    })
  })

  test('prevents an atomic draft edit from overwriting a newer plan version', async () => {
    const browserUser = userEvent.setup()
    const user = {
      id: 'user-1',
      firstName: 'Test',
      lastName: 'Employee',
      name: 'Test Employee',
      role: 'user',
    }
    const overtimePlan = {
      planId: 'PLAN-EDIT',
      departmentName: 'Engineering',
      periodType: 'weekly',
      periodStartDate: '2026-08-17',
      periodEndDate: '2026-08-23',
      status: 'draft',
      planScope: 'employee',
      itemCount: 1,
      plannedHours: 2,
      createdByName: 'Test Employee',
      createdAt: '2026-08-17T08:00:00.000Z',
      updatedAt: '2026-08-18T01:00:00.000Z',
      remarks: 'Original remarks.',
      items: [{
        planItemId: 'ITEM-EDIT',
        plannedDate: '2026-08-19',
        plannedHours: 2,
        reason: 'Complete reports.',
      }],
      logs: [],
    }

    storeSession({ token: 'employee-token', user })
    const fetchMock = vi.fn((url, options = {}) => {
      if (url.endsWith('/api/auth/me')) {
        return Promise.resolve(jsonResponse(200, { user }))
      }
      if (url.includes('/api/notifications?')) {
        return Promise.resolve(jsonResponse(200, {
          notifications: [],
          pagination: { limit: 20, offset: 0, total: 0 },
          unreadCount: 0,
        }))
      }
      if (url.endsWith('/api/overtime/plans/PLAN-EDIT/draft') && options.method === 'PUT') {
        return Promise.resolve(jsonResponse(409, {
          message: 'This overtime plan changed after you opened it. Reload the latest version before saving.',
          code: 'PLAN_VERSION_CONFLICT',
        }))
      }
      if (url.endsWith('/api/overtime/plans/PLAN-EDIT')) {
        return Promise.resolve(jsonResponse(200, { overtimePlan }))
      }

      return Promise.resolve(jsonResponse(404, { message: 'Route not found.' }))
    })
    vi.stubGlobal('fetch', fetchMock)

    renderApplication('/employee/plans/PLAN-EDIT/edit')

    expect(await screen.findByRole('heading', { name: 'Edit overtime plan' })).toBeVisible()
    fireEvent.change(screen.getByLabelText(/Plan remarks/), {
      target: { value: 'Updated remarks.' },
    })
    await browserUser.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByRole('button', { name: 'Reload latest' })).toBeVisible()
    expect(screen.getAllByText(/changed after you opened it/)).toHaveLength(2)

    const replaceRequest = fetchMock.mock.calls.find(([url, options]) => (
      url.endsWith('/api/overtime/plans/PLAN-EDIT/draft') && options?.method === 'PUT'
    ))
    expect(JSON.parse(replaceRequest[1].body)).toEqual({
      expectedUpdatedAt: '2026-08-18T01:00:00.000Z',
      periodType: 'weekly',
      periodStartDate: '2026-08-17',
      periodEndDate: '2026-08-23',
      remarks: 'Updated remarks.',
      items: [{
        plannedDate: '2026-08-19',
        plannedHours: 2,
        reason: 'Complete reports.',
      }],
    })
  })

  test('shows all monthly Actual OT periods, selects weeks, and adds a comment', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-08-21T12:00:00'))
    const browserUser = userEvent.setup()
    const user = {
      id: 'user-1',
      firstName: 'Test',
      lastName: 'Employee',
      name: 'Test Employee',
      role: 'user',
    }
    const latestPeriod = {
      actualPeriodId: 'ACTUAL-LATEST',
      sourceDepartmentPlanId: 'DEPTPLAN-LATEST',
      departmentId: 'DEP-RTD',
      departmentName: 'RTD',
      periodType: 'weekly',
      periodStartDate: '2026-08-17',
      periodEndDate: '2026-08-23',
      status: 'open',
      entryCount: 2,
      plannedHours: 7,
      actualHours: 6,
      entries: [{
        actualEntryId: 'ACTUALENTRY-1',
        actualPeriodId: 'ACTUAL-LATEST',
        sourcePlanItemId: 'PLANITEM-1',
        sourceEmployeePlanId: 'PLAN-1',
        employeeId: 'EMP-1',
        actualDate: '2026-08-17',
        plannedHours: 3,
        actualHours: 2,
        varianceHours: -1,
        lastUpdatedAt: '2026-08-17T10:00:00.000Z',
        plannedReason: 'Production support',
        periodStatus: 'open',
        comments: [{
          commentId: 'ACTUALCOMMENT-ADMIN',
          actualEntryId: 'ACTUALENTRY-1',
          userId: 'user-admin',
          userName: 'Test Admin',
          userRole: 'admin',
          remarks: 'Please confirm this adjustment.',
          createdAt: '2026-08-20T08:00:00.000Z',
        }],
      }, {
        actualEntryId: 'ACTUALENTRY-TODAY',
        actualPeriodId: 'ACTUAL-LATEST',
        sourcePlanItemId: 'PLANITEM-TODAY',
        sourceEmployeePlanId: 'PLAN-1',
        employeeId: 'EMP-1',
        actualDate: '2026-08-21',
        plannedHours: 4,
        actualHours: 4,
        varianceHours: 0,
        isPending: true,
        plannedReason: 'Month-end processing',
        periodStatus: 'open',
        comments: [],
      }],
    }
    const olderPeriod = {
      ...latestPeriod,
      actualPeriodId: 'ACTUAL-OLDER',
      periodStartDate: '2026-08-10',
      periodEndDate: '2026-08-16',
      entryCount: 1,
      plannedHours: 1.5,
      actualHours: 1.5,
      entries: [{
        actualEntryId: 'ACTUALENTRY-OLDER',
        actualPeriodId: 'ACTUAL-OLDER',
        sourcePlanItemId: 'PLANITEM-OLDER',
        sourceEmployeePlanId: 'PLAN-OLDER',
        employeeId: 'EMP-1',
        actualDate: '2026-08-12',
        plannedHours: 1.5,
        actualHours: 0,
        varianceHours: 0,
        isPending: false,
        plannedReason: 'Previous week overtime',
        periodStatus: 'open',
        comments: [],
      }],
    }
    const savedComment = {
      commentId: 'ACTUALCOMMENT-1',
      actualEntryId: 'ACTUALENTRY-1',
      userId: 'user-1',
      userName: 'Test Employee',
      userRole: 'user',
      remarks: 'Please verify these hours.',
      createdAt: '2026-08-21T08:00:00.000Z',
    }

    storeSession({ token: 'employee-token', user })
    const fetchMock = vi.fn((url, options = {}) => {
      if (url.endsWith('/api/auth/me')) {
        return Promise.resolve(jsonResponse(200, { user }))
      }
      if (url.includes('/api/notifications?')) {
        return Promise.resolve(jsonResponse(200, {
          notifications: [],
          pagination: { limit: 20, offset: 0, total: 0 },
          unreadCount: 0,
        }))
      }
      if (url.endsWith('/api/overtime/actual-periods')) {
        return Promise.resolve(jsonResponse(200, {
          actualPeriods: [latestPeriod, olderPeriod],
        }))
      }
      if (url.endsWith('/api/overtime/actual-periods/ACTUAL-LATEST')) {
        return Promise.resolve(jsonResponse(200, { actualPeriod: latestPeriod }))
      }
      if (url.endsWith('/api/overtime/actual-periods/ACTUAL-OLDER')) {
        return Promise.resolve(jsonResponse(200, { actualPeriod: olderPeriod }))
      }
      if (
        url.endsWith('/api/overtime/actual-entries/ACTUALENTRY-1/comments')
        && options.method === 'POST'
      ) {
        return Promise.resolve(jsonResponse(201, {
          message: 'Actual OT comment added successfully.',
          comment: savedComment,
        }))
      }

      return Promise.resolve(jsonResponse(404, { message: 'Route not found.' }))
    })
    vi.stubGlobal('fetch', fetchMock)

    renderApplication('/employee/actual-overtime')

    expect(await screen.findByRole('heading', { name: 'August 2026' })).toBeVisible()
    expect(screen.getByText('Month-end processing')).toBeVisible()
    const todayCell = screen.getByRole('button', { name: /actual overtime pending, 4 planned hours/ })
    expect(todayCell).toHaveClass('actual-calendar__day--today')
    expect(todayCell).toHaveClass('actual-calendar__day--selected')
    expect(todayCell).toHaveClass('actual-calendar__day--selected-week')
    expect(within(todayCell).getByText('Awaiting actual')).toBeVisible()
    expect(screen.getAllByText('Pending')).not.toHaveLength(0)
    expect(screen.getByRole('button', { name: /Aug 30, 2026/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Sep 05, 2026/ })).toBeDisabled()
    expect(fetchMock.mock.calls.some(([url]) => url.includes('ACTUAL-OLDER'))).toBe(true)
    expect(screen.getByRole('button', {
      name: /1.5 actual hours, 1.5 planned hours/,
    })).not.toHaveClass('actual-calendar__day--selected-week')

    await browserUser.click(screen.getByRole('button', {
      name: 'Previous actual overtime week',
    }))
    expect(await screen.findByText('Previous week overtime')).toBeVisible()
    expect(screen.getByLabelText('Actual overtime totals')).toHaveTextContent(
      /Week entries\s*1.*Planned hours\s*1.5.*Actual hours\s*1.5.*Variance\s*0/,
    )
    expect(screen.getByRole('button', {
      name: /1.5 actual hours, 1.5 planned hours/,
    })).toHaveClass('actual-calendar__day--selected-week')

    await browserUser.click(screen.getByRole('button', {
      name: 'Next actual overtime week',
    }))
    expect(await screen.findByText('Month-end processing')).toBeVisible()

    await browserUser.click(screen.getByRole('button', {
      name: /2 actual hours, 3 planned hours/,
    }))
    expect(screen.getByText('Production support')).toBeVisible()
    expect(screen.getByText('Please confirm this adjustment.').closest('li')).not.toHaveClass(
      'actual-entry-comments__message--own',
    )
    await browserUser.type(screen.getByLabelText('Add comment'), 'Please verify these hours.')
    await browserUser.click(screen.getByRole('button', { name: 'Send comment' }))

    const ownComment = await screen.findByText('Please verify these hours.')
    expect(ownComment.closest('li')).toHaveClass('actual-entry-comments__message--own')
    const commentRequest = fetchMock.mock.calls.find(([url]) => (
      url.endsWith('/api/overtime/actual-entries/ACTUALENTRY-1/comments')
    ))
    expect(commentRequest[1].method).toBe('POST')
    expect(JSON.parse(commentRequest[1].body)).toEqual({
      remarks: 'Please verify these hours.',
    })
    expect(commentRequest[1].headers.get('Authorization')).toBe('Bearer employee-token')
  })

  test('refreshes, reads, and opens an overtime plan notification', async () => {
    const browserUser = userEvent.setup()
    const user = {
      id: 'user-1',
      firstName: 'Test',
      lastName: 'Employee',
      name: 'Test Employee',
      role: 'user',
    }
    const notification = {
      notificationId: 'NOTIFICATION-1',
      planId: 'PLAN-1',
      logId: 'LOG-2',
      type: 'supervisor_accepted',
      title: 'Supervisor accepted the plan',
      message: 'Employee OT plan supervisor accepted.',
      actorName: 'Sample Supervisor',
      readAt: null,
      createdAt: '2026-08-17T09:00:00.000Z',
    }
    const overtimePlan = {
      planId: 'PLAN-1',
      departmentName: 'Engineering',
      periodType: 'weekly',
      periodStartDate: '2026-08-17',
      periodEndDate: '2026-08-23',
      status: 'supervisor_accepted',
      planScope: 'employee',
      itemCount: 0,
      plannedHours: 0,
      createdByName: 'Test Employee',
      createdAt: '2026-08-17T08:00:00.000Z',
      items: [],
      logs: [{
        logId: 'LOG-2',
        action: 'supervisor_accepted',
        actionByName: 'Sample Supervisor',
        actionAt: '2026-08-17T09:00:00.000Z',
        remarks: 'Employee OT plan supervisor accepted.',
      }],
    }

    storeSession({ token: 'employee-token', user })
    let notificationListRequests = 0
    const fetchMock = vi.fn((url) => {
      if (url.endsWith('/api/auth/me')) {
        return Promise.resolve(jsonResponse(200, { user }))
      }
      if (url.includes('/api/notifications?')) {
        notificationListRequests += 1
        return Promise.resolve(jsonResponse(200, {
          notifications: [notification],
          pagination: { limit: 20, offset: 0, total: 1 },
          unreadCount: 1,
        }))
      }
      if (url.endsWith('/api/notifications/NOTIFICATION-1/read')) {
        return Promise.resolve(jsonResponse(200, {
          notification: { ...notification, readAt: '2026-08-17T10:00:00.000Z' },
        }))
      }
      if (url.endsWith('/api/overtime/plans/PLAN-1')) {
        return Promise.resolve(jsonResponse(200, { overtimePlan }))
      }

      return Promise.resolve(jsonResponse(404, { message: 'Route not found.' }))
    })
    vi.stubGlobal('fetch', fetchMock)

    renderApplication('/employee')

    const bell = await screen.findByRole('button', { name: 'Notifications, 1 unread' })
    await browserUser.click(bell)
    const notificationMenu = await screen.findByRole('region', { name: 'Notifications' })
    expect(within(notificationMenu).getByText('Supervisor accepted the plan')).toBeVisible()
    expect(within(notificationMenu).getByRole('link', { name: 'View all notifications' })).toHaveAttribute(
      'href',
      '/employee/notifications',
    )

    await browserUser.click(within(notificationMenu).getByRole('button', { name: 'Refresh notifications' }))
    await waitFor(() => expect(notificationListRequests).toBe(2))

    await browserUser.click(within(notificationMenu).getByRole('button', {
      name: /Supervisor accepted the plan/,
    }))

    expect(await screen.findByRole('heading', { name: 'Activity history' })).toBeVisible()
    expect(screen.getByText('Employee OT plan supervisor accepted.')).toBeVisible()

    const readRequest = fetchMock.mock.calls.find(([url]) => (
      url.endsWith('/api/notifications/NOTIFICATION-1/read')
    ))
    expect(readRequest[1].method).toBe('PATCH')
    expect(readRequest[1].headers.get('Authorization')).toBe('Bearer employee-token')
  })

  test('opens an Actual OT notification on its affected calendar date', async () => {
    const browserUser = userEvent.setup()
    const user = {
      id: 'user-1',
      firstName: 'Test',
      lastName: 'Employee',
      name: 'Test Employee',
      role: 'user',
    }
    const notification = {
      notificationId: 'NOTIFICATION-ACTUAL-1',
      targetType: 'actual_overtime',
      actualPeriodId: 'ACTUALPERIOD-1',
      actualEntryId: 'ACTUALENTRY-1',
      actualDate: '2026-08-19',
      type: 'actual_hours_updated',
      title: 'Actual overtime hours updated',
      message: 'Matched timekeeping.',
      actorName: 'Sample Supervisor',
      readAt: null,
      createdAt: '2026-08-21T09:00:00.000Z',
      periodStartDate: '2026-08-17',
      periodEndDate: '2026-08-23',
    }
    const actualPeriod = {
      actualPeriodId: 'ACTUALPERIOD-1',
      departmentId: 'DEP-RTD',
      departmentName: 'RTD',
      periodType: 'weekly',
      periodStartDate: '2026-08-17',
      periodEndDate: '2026-08-23',
      status: 'open',
      entryCount: 1,
      plannedHours: 2,
      actualHours: 2,
      entries: [{
        actualEntryId: 'ACTUALENTRY-1',
        actualPeriodId: 'ACTUALPERIOD-1',
        actualDate: '2026-08-19',
        plannedHours: 2,
        actualHours: 2,
        varianceHours: 0,
        isPending: false,
        lastUpdatedAt: '2026-08-19T10:00:00.000Z',
        plannedReason: 'Notification target entry',
        periodStatus: 'open',
        comments: [],
      }],
    }

    storeSession({ token: 'employee-token', user })
    const fetchMock = vi.fn((url) => {
      if (url.endsWith('/api/auth/me')) {
        return Promise.resolve(jsonResponse(200, { user }))
      }
      if (url.includes('/api/notifications?')) {
        return Promise.resolve(jsonResponse(200, {
          notifications: [notification],
          pagination: { limit: 20, offset: 0, total: 1 },
          unreadCount: 1,
        }))
      }
      if (url.endsWith('/api/notifications/NOTIFICATION-ACTUAL-1/read')) {
        return Promise.resolve(jsonResponse(200, {
          notification: { ...notification, readAt: '2026-08-21T10:00:00.000Z' },
        }))
      }
      if (url.endsWith('/api/overtime/actual-periods')) {
        return Promise.resolve(jsonResponse(200, { actualPeriods: [actualPeriod] }))
      }
      if (url.endsWith('/api/overtime/actual-periods/ACTUALPERIOD-1')) {
        return Promise.resolve(jsonResponse(200, { actualPeriod }))
      }

      return Promise.resolve(jsonResponse(404, { message: 'Route not found.' }))
    })
    vi.stubGlobal('fetch', fetchMock)

    renderApplication('/employee')

    await browserUser.click(await screen.findByRole('button', {
      name: 'Notifications, 1 unread',
    }))
    await browserUser.click(screen.getByRole('button', {
      name: /Actual overtime hours updated/,
    }))

    expect(await screen.findByRole('heading', { name: 'August 2026' })).toBeVisible()
    expect(screen.getByText('Notification target entry')).toBeVisible()
    expect(screen.getByRole('button', {
      name: /2 actual hours, 2 planned hours/,
    })).toHaveClass('actual-calendar__day--selected')
    expect(fetchMock.mock.calls.some(([url]) => (
      url.endsWith('/api/notifications/NOTIFICATION-ACTUAL-1/read')
    ))).toBe(true)
  })

  test('paginates the dedicated employee notification history', async () => {
    const browserUser = userEvent.setup()
    const user = {
      id: 'user-1',
      firstName: 'Test',
      lastName: 'Employee',
      name: 'Test Employee',
      role: 'user',
    }
    const firstNotification = {
      notificationId: 'NOTIFICATION-1',
      planId: 'PLAN-1',
      logId: 'LOG-1',
      type: 'submitted_to_supervisor',
      title: 'Plan submitted for review',
      message: 'Your plan is waiting for supervisor review.',
      actorName: 'Test Employee',
      readAt: null,
      createdAt: '2026-08-18T09:00:00.000Z',
      periodStartDate: '2026-08-17',
      periodEndDate: '2026-08-23',
    }
    const olderNotification = {
      ...firstNotification,
      notificationId: 'NOTIFICATION-11',
      planId: 'PLAN-11',
      logId: 'LOG-11',
      title: 'Older notification',
      readAt: '2026-08-10T09:00:00.000Z',
    }

    storeSession({ token: 'employee-token', user })
    const fetchMock = vi.fn((url) => {
      if (url.endsWith('/api/auth/me')) {
        return Promise.resolve(jsonResponse(200, { user }))
      }
      if (url.includes('/api/notifications?')) {
        const requestUrl = new URL(url)
        const limit = Number(requestUrl.searchParams.get('limit'))
        const offset = Number(requestUrl.searchParams.get('offset'))

        if (limit === 10 && offset === 10) {
          return Promise.resolve(jsonResponse(200, {
            notifications: [olderNotification],
            pagination: { limit: 10, offset: 10, total: 11 },
            unreadCount: 1,
          }))
        }

        return Promise.resolve(jsonResponse(200, {
          notifications: [firstNotification],
          pagination: { limit, offset, total: 11 },
          unreadCount: 1,
        }))
      }

      return Promise.resolve(jsonResponse(404, { message: 'Route not found.' }))
    })
    vi.stubGlobal('fetch', fetchMock)

    renderApplication('/employee/notifications')

    expect(await screen.findByRole('heading', { name: 'Notification history' })).toBeVisible()
    expect(await screen.findByText('Plan submitted for review')).toBeVisible()
    expect(screen.getByText('Page 1 of 2')).toBeVisible()

    await browserUser.click(screen.getByRole('button', { name: 'Next notification page' }))

    expect(await screen.findByText('Older notification')).toBeVisible()
    expect(screen.getByText('Page 2 of 2')).toBeVisible()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('limit=10&offset=10'),
      expect.any(Object),
    )
  })

  test('removes a stale notification when its overtime plan was deleted', async () => {
    const browserUser = userEvent.setup()
    const user = {
      id: 'user-1',
      firstName: 'Test',
      lastName: 'Employee',
      name: 'Test Employee',
      role: 'user',
    }
    const notification = {
      notificationId: 'NOTIFICATION-DELETED',
      planId: 'PLAN-DELETED',
      logId: 'LOG-DELETED',
      type: 'supervisor_returned',
      title: 'Supervisor returned the plan',
      message: 'This plan was returned before being deleted.',
      actorName: 'Sample Supervisor',
      readAt: '2026-08-17T10:00:00.000Z',
      createdAt: '2026-08-17T09:00:00.000Z',
    }

    storeSession({ token: 'employee-token', user })
    const fetchMock = vi.fn((url) => {
      if (url.endsWith('/api/auth/me')) {
        return Promise.resolve(jsonResponse(200, { user }))
      }
      if (url.includes('/api/notifications?')) {
        return Promise.resolve(jsonResponse(200, {
          notifications: [notification],
          pagination: { limit: 20, offset: 0, total: 1 },
          unreadCount: 0,
        }))
      }
      if (url.endsWith('/api/overtime/plans/PLAN-DELETED')) {
        return Promise.resolve(jsonResponse(404, { message: 'Overtime plan not found.' }))
      }

      return Promise.resolve(jsonResponse(404, { message: 'Route not found.' }))
    })
    vi.stubGlobal('fetch', fetchMock)

    renderApplication('/employee')

    await browserUser.click(await screen.findByRole('button', { name: 'Notifications' }))
    await browserUser.click(screen.getByRole('button', { name: /Supervisor returned the plan/ }))

    expect(await screen.findByText('This overtime plan is no longer available.')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Welcome, Test.' })).toBeVisible()
    expect(screen.queryByText('Supervisor returned the plan')).not.toBeInTheDocument()
  })
})
