import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { WorkspaceEntrance } from '../WorkspaceEntrance.jsx'
import { useDashboardEntrance } from '../useDashboardEntrance.js'

function Dashboard({ ready }) {
  const entranceClass = useDashboardEntrance(ready)
  return <main data-testid="dashboard" className={`employee-dashboard${entranceClass}`}><section>{ready ? 'Overtime data' : 'Loading'}</section></main>
}

function Scene({ ready, freshLogin = true }) {
  return <MemoryRouter initialEntries={[{ pathname: '/employee', state: freshLogin ? { loginEntrance: true } : null }]}><WorkspaceEntrance><Dashboard ready={ready} /></WorkspaceEntrance></MemoryRouter>
}

describe('Dashboard assembly', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  test('waits for data even after the shell entrance has finished', () => {
    const view = render(<Scene ready={false} />)
    expect(document.querySelector('.workspace-entrance')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(3000))
    expect(document.querySelector('.workspace-entrance')).not.toBeInTheDocument()
    expect(screen.getByTestId('dashboard')).toHaveClass('dashboard-assemble')
    view.rerender(<Scene ready />)
    expect(screen.getByText('Overtime data')).toBeVisible()
    act(() => vi.advanceTimersByTime(1199))
    expect(screen.getByTestId('dashboard')).toHaveClass('dashboard-assemble')
    act(() => vi.advanceTimersByTime(1))
    expect(screen.getByTestId('dashboard')).not.toHaveClass('dashboard-assemble')
    view.rerender(<Scene ready={false} />)
    view.rerender(<Scene ready />)
    expect(screen.getByTestId('dashboard')).not.toHaveClass('dashboard-assemble')
  })

  test('does not animate a restored session as a new sign-in', () => {
    render(<Scene ready freshLogin={false} />)
    expect(document.querySelector('.workspace-entrance')).not.toBeInTheDocument()
    expect(screen.getByTestId('dashboard')).not.toHaveClass('dashboard-assemble')
  })

  test('cleans up outstanding animation timers on unmount', () => {
    const view = render(<Scene ready />)
    view.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
