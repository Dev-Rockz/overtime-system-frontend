import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { authApi } from '../../../api/authApi.js'
import { LoginPage } from '../LoginPage.jsx'
import { WorkspaceEntrance } from '../WorkspaceEntrance.jsx'
import { getStoredSession, storeSession } from '../session.js'
import { getStoredTestCredentials, storeTestCredentials } from '../testCredentials.js'

const auth = vi.hoisted(() => ({ login: vi.fn(), logout: vi.fn() }))
const toast = vi.hoisted(() => ({ error: vi.fn() }))
vi.mock('../../../api/authApi.js', () => ({ authApi: { login: vi.fn() } }))
vi.mock('../useAuth.js', () => ({ useAuth: () => auth }))
vi.mock('../../../components/shared/toast/useToast.js', () => ({ useToast: () => toast }))
vi.mock('../../../config/appConfig.js', () => ({ appConfig: { rememberTestCredentials: true } }))

function Workspace() {
  const location = useLocation()
  return <WorkspaceEntrance><h1>Workspace ready</h1><output data-testid="location">{location.pathname}</output><output data-testid="entrance-flag">{String(Boolean(location.state?.loginEntrance))}</output></WorkspaceEntrance>
}

function renderPage(from) {
  return render(<MemoryRouter initialEntries={[{ pathname: '/login', state: from ? { from: { pathname: from } } : null }]}><Routes><Route path="/login" element={<LoginPage />} /><Route path="/*" element={<Workspace />} /></Routes></MemoryRouter>)
}

async function fillAndSubmit() {
  const browserUser = userEvent.setup()
  await browserUser.type(screen.getByLabelText('Email address'), 'staff@qdmcph.com')
  await browserUser.type(screen.getByLabelText('Password'), 'example-password')
  await browserUser.click(screen.getByRole('button', { name: 'Sign in' }))
  return browserUser
}

describe('Login design and transitions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.login.mockImplementation(storeSession)
  })

  test.each([
    ['user', '/employee/profile'],
    ['supervisor', '/supervisor/team'],
  ])('disassembles %s login and enters the workspace directly without a welcome screen', async (role, path) => {
    const session = { token: `token-${role}`, user: { role, firstName: 'Alex' } }
    let completeLogin
    authApi.login.mockImplementation(() => new Promise((resolve) => { completeLogin = resolve }))
    renderPage(path)
    await fillAndSubmit()
    expect(screen.getByRole('button', { name: 'Signing in...' })).toBeDisabled()
    expect(screen.getByLabelText('Email address')).toBeDisabled()
    fireEvent.submit(screen.getByRole('form', { name: 'Account sign in' }))
    expect(authApi.login).toHaveBeenCalledTimes(1)
    await act(async () => completeLogin(session))
    expect(await screen.findByRole('button', { name: 'Successful' })).toBeVisible()
    await waitFor(() => expect(document.querySelector('.login-page--exiting')).toBeInTheDocument())
    expect(screen.getByRole('form', { name: 'Account sign in' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Successful' })).toBeDisabled()
    expect(screen.queryByRole('heading', { name: 'Welcome, Alex.' })).not.toBeInTheDocument()
    expect(document.querySelector('.login-introduction')).not.toBeInTheDocument()
    expect(auth.login).not.toHaveBeenCalled()
    expect(await screen.findByRole('heading', { name: 'Workspace ready' }, { timeout: 4000 })).toBeVisible()
    expect(screen.getByTestId('location')).toHaveTextContent(path)
    await waitFor(() => expect(screen.getByTestId('entrance-flag')).toHaveTextContent('false'))
    expect(document.querySelector('.workspace-entrance')).toBeInTheDocument()
    expect(getStoredSession()).toEqual(session)
    expect(getStoredTestCredentials()).toEqual({ email: 'staff@qdmcph.com', password: 'example-password' })
  }, 15000)

  test('keeps login errors in toasts without disassembling the form or storing a session', async () => {
    authApi.login.mockRejectedValue(new Error('Invalid email or password.'))
    renderPage()
    await fillAndSubmit()
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Invalid email or password.'))
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled()
    expect(screen.queryByRole('heading', { name: /Welcome,/ })).not.toBeInTheDocument()
    expect(document.querySelector('.login-page--exiting')).not.toBeInTheDocument()
    expect(auth.login).not.toHaveBeenCalled()
    expect(getStoredSession()).toBeNull()
    expect(screen.queryByText(/Your session is protected|Testing only|test credentials/i)).not.toBeInTheDocument()
  }, 15000)

  test('restores remembered fields and lets the user clear them and toggle password visibility', async () => {
    storeTestCredentials({ email: 'remembered@qdmcph.com', password: 'saved-password' })
    renderPage()
    expect(screen.getByLabelText('Email address')).toHaveValue('remembered@qdmcph.com')
    expect(screen.getByLabelText('Password')).toHaveValue('saved-password')
    const browserUser = userEvent.setup()
    await browserUser.click(screen.getByRole('button', { name: 'Show password' }))
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text')
    await browserUser.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
    await browserUser.click(screen.getByRole('checkbox', { name: 'Remember credentials' }))
    expect(getStoredTestCredentials()).toBeNull()
  })

  test('does not replay the entrance on ordinary workspace navigation', () => {
    render(<MemoryRouter initialEntries={['/supervisor']}><Workspace /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'Workspace ready' })).toBeVisible()
    expect(document.querySelector('.workspace-entrance')).not.toBeInTheDocument()
    expect(screen.queryByText('Supervisor workspace')).not.toBeInTheDocument()
  })

  test('does not complete authentication after the login page unmounts', async () => {
    let completeLogin
    authApi.login.mockImplementation(() => new Promise((resolve) => { completeLogin = resolve }))
    const view = renderPage()
    await fillAndSubmit()
    view.unmount()
    await act(async () => completeLogin({ token: 'late', user: { role: 'user' } }))
    expect(auth.login).not.toHaveBeenCalled()
    expect(getStoredTestCredentials()).toBeNull()
  }, 15000)
})
