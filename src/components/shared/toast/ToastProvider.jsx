import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { ToastContext } from './ToastContext.js'
import './toast.css'

const toastIcons = {
  error: AlertCircle,
  info: Info,
  success: CheckCircle2,
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())

  const dismiss = useCallback((id) => {
    const timer = timers.current.get(id)
    if (timer) window.clearTimeout(timer)
    timers.current.delete(id)
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const show = useCallback((message, options = {}) => {
    const id = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`
    const duration = options.duration ?? 3500
    const tone = options.tone || 'info'

    setToasts((current) => [...current, { id, message, tone }])
    timers.current.set(id, window.setTimeout(() => dismiss(id), duration))

    return id
  }, [dismiss])

  useEffect(() => () => {
    timers.current.forEach((timer) => window.clearTimeout(timer))
    timers.current.clear()
  }, [])

  const value = useMemo(() => ({
    dismiss,
    error: (message, options) => show(message, { ...options, tone: 'error' }),
    info: (message, options) => show(message, { ...options, tone: 'info' }),
    success: (message, options) => show(message, { ...options, tone: 'success' }),
  }), [dismiss, show])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" aria-label="Notifications">
        {toasts.map((toast) => {
          const Icon = toastIcons[toast.tone] || Info

          return (
            <div
              className={`toast toast--${toast.tone}`}
              key={toast.id}
              role={toast.tone === 'error' ? 'alert' : 'status'}
            >
              <Icon className="toast__icon" size={19} aria-hidden="true" />
              <span className="toast__message">{toast.message}</span>
              <button
                aria-label="Dismiss notification"
                className="toast__dismiss"
                onClick={() => dismiss(toast.id)}
                type="button"
              >
                <X size={16} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
