import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Check, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from 'lucide-react'
import { authApi } from '../../api/authApi.js'
import loginBackground from '../../assets/images/ot-background.png'
import { useToast } from '../../components/shared/toast/useToast.js'
import { appConfig } from '../../config/appConfig.js'
import { useAuth } from './useAuth.js'
import { getPostLoginPath, isSupportedAppRole } from './roleRoutes.js'
import { clearTestCredentials, getStoredTestCredentials, storeTestCredentials } from './testCredentials.js'
import './login.css'

export function LoginPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { login, logout } = useAuth()
  const toast = useToast()
  const [savedCredentials] = useState(() => appConfig.rememberTestCredentials ? getStoredTestCredentials() : null)
  const [email, setEmail] = useState(savedCredentials?.email || '')
  const [password, setPassword] = useState(savedCredentials?.password || '')
  const [rememberCredentials, setRememberCredentials] = useState(appConfig.rememberTestCredentials)
  const [showPassword, setShowPassword] = useState(false)
  const [submitState, setSubmitState] = useState('idle')
  const [pendingSession, setPendingSession] = useState(null)
  const mounted = useRef(false)
  const inFlight = useRef(false)
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    if (!pendingSession || !['success', 'exiting'].includes(submitState)) return undefined
    const timer = window.setTimeout(() => {
      if (submitState === 'success') {
        setSubmitState('exiting')
      } else {
        const destination = getPostLoginPath(pendingSession.user.role, location.state?.from)
        login(pendingSession, { redirectTo: destination })
        navigate(destination, {
          replace: true, state: { loginEntrance: true },
        })
      }
    }, submitState === 'success' ? (reducedMotion ? 80 : 350) : (reducedMotion ? 0 : 640))
    return () => window.clearTimeout(timer)
  }, [login, location.state?.from, navigate, pendingSession, reducedMotion, submitState])

  async function handleSubmit(event) {
    event.preventDefault()
    if (inFlight.current) return
    inFlight.current = true
    setSubmitState('loading')
    try {
      const session = await authApi.login({ email: email.trim(), password })
      if (!mounted.current) return
      if (!isSupportedAppRole(session.user.role)) {
        logout()
        throw new Error('This account role does not have access to this portal yet.')
      }
      if (rememberCredentials) storeTestCredentials({ email: email.trim(), password })
      else clearTestCredentials()
      setPendingSession(session)
      setSubmitState('success')
    } catch (loginError) {
      if (!mounted.current) return
      inFlight.current = false
      setSubmitState('idle')
      toast.error(loginError.message)
    }
  }

  const busy = submitState !== 'idle'
  const buttonState = submitState === 'exiting' ? 'success' : submitState

  return (
    <main className={`login-page${submitState === 'exiting' ? ' login-page--exiting' : ''}`}>
        <div className="login-container">
          <section className="login-brand" aria-label="Quest Dental">
            <img alt="Quest Dental Material Corporation overtime system" className="login-brand__image" src={loginBackground} fetchPriority="high" />
          </section>
          <section className="login-form-area" aria-labelledby="login-title">
            <header className="login-form-area__brand"><strong>Quest Dental</strong><span>Overtime System</span></header>
            <form className="login-form" onSubmit={handleSubmit} aria-label="Account sign in" aria-busy={submitState === 'loading'}>
              <div className="login-form__heading"><span>Account access</span><h1 id="login-title">Welcome back</h1></div>
              <fieldset disabled={busy}>
                <label className="form-field"><span>Email address</span><span className="login-input"><Mail size={18} aria-hidden="true" /><input autoComplete="username" autoCapitalize="none" spellCheck={false} name="email" onChange={(event) => setEmail(event.target.value)} placeholder="name@qdmcph.com" required type="email" value={email} /></span></label>
                <label className="form-field"><span>Password</span><span className="login-input password-input"><LockKeyhole size={18} aria-hidden="true" /><input autoComplete="current-password" name="password" onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required type={showPassword ? 'text' : 'password'} value={password} /><button aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((current) => !current)} title={showPassword ? 'Hide password' : 'Show password'} type="button">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>
                {appConfig.rememberTestCredentials && <label className="login-remember" title="Stores your email and password on this device."><input checked={rememberCredentials} onChange={(event) => { setRememberCredentials(event.target.checked); if (!event.target.checked) clearTestCredentials() }} type="checkbox" /><span>Remember credentials</span></label>}
              </fieldset>
              <button className={`login-button login-button--${buttonState}`} disabled={busy} type="submit">
                <span className="login-button__content" key={buttonState}>
                  {buttonState === 'loading' ? <><LoaderCircle className="login-button__spinner" size={19} aria-hidden="true" /><span>Signing in...</span></> : buttonState === 'success' ? <><Check className="login-button__check" size={20} aria-hidden="true" /><span>Successful</span></> : <><span>Sign in</span><ArrowRight size={18} aria-hidden="true" /></>}
                </span>
              </button>
              {busy && <span className="login-sr-only" role="status">{submitState === 'loading' ? 'Signing in to your account.' : 'Sign in successful.'}</span>}
            </form>
            <footer className="login-footer"><span>Quest Dental Material Corporation</span><span>{new Date().getFullYear()}</span></footer>
          </section>
        </div>
    </main>
  )
}
