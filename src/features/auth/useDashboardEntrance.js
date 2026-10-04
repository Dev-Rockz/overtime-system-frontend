import { useContext, useEffect, useState } from 'react'
import { WorkspaceEntranceContext } from './WorkspaceEntranceContext.js'

export function useDashboardEntrance(isReady) {
  const freshLogin = useContext(WorkspaceEntranceContext)
  const [enabled] = useState(freshLogin)
  const [complete, setComplete] = useState(false)

  useEffect(() => {
    if (!enabled || !isReady || complete) return undefined
    // Keep the initial entrance available until the real sections replace the skeleton.
    const timer = window.setTimeout(() => setComplete(true), 1200)
    return () => window.clearTimeout(timer)
  }, [complete, enabled, isReady])

  return enabled && !complete ? ' dashboard-assemble' : ''
}
