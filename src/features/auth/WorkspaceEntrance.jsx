import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { WorkspaceEntranceContext } from './WorkspaceEntranceContext.js'
import './workspaceMotion.css'

export function WorkspaceEntrance({ children, onEntered }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [animate, setAnimate] = useState(Boolean(location.state?.loginEntrance))

  useEffect(() => {
    if (!animate) return undefined
    const timer = window.setTimeout(() => setAnimate(false), 1200)
    return () => window.clearTimeout(timer)
  }, [animate])

  useEffect(() => {
    if (!location.state?.loginEntrance) return
    onEntered?.()
    const state = { ...location.state }
    delete state.loginEntrance
    // Consume the transition flag so refreshing or going back does not replay it.
    navigate(`${location.pathname}${location.search}${location.hash}`, { replace: true, state })
  }, [location, navigate, onEntered])

  return (
    <WorkspaceEntranceContext.Provider value={animate}>
      <div className={animate ? 'workspace-entrance' : undefined}>{children}</div>
    </WorkspaceEntranceContext.Provider>
  )
}
