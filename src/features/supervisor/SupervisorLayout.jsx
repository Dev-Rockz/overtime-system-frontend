import { createElement, useEffect, useRef, useState } from 'react'
import {
  BadgeCheck,
  CalendarCheck2,
  CalendarPlus2,
  ChevronDown,
  FilePenLine,
  FileStack,
  LayoutDashboard,
  LogOut,
  Menu,
  TimerReset,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { BrandMark } from '../../components/shared/BrandMark.jsx'
import { useToast } from '../../components/shared/toast/useToast.js'
import { useAuth } from '../auth/useAuth.js'
import { NotificationMenu } from '../employee/components/notifications/NotificationMenu.jsx'
import './supervisor.css'

const supervisorNavigation = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/supervisor', end: true },
  { label: 'Department plans', icon: FileStack, to: '/supervisor/department-plans' },
  { label: 'Assign overtime', icon: CalendarPlus2, to: '/supervisor/assign-overtime' },
  { label: 'Department drafts', icon: FilePenLine, to: '/supervisor/department-drafts' },
  { label: 'Approvals', icon: BadgeCheck, to: '/supervisor/approvals' },
  { label: 'Overtime department plan', icon: CalendarCheck2, to: '/supervisor/overtime-department-plans' },
  { label: 'Actual overtime', icon: TimerReset, to: '/supervisor/actual-overtime' },
  { label: 'My team', icon: UsersRound, to: '/supervisor/team' },
]

const pageTitles = {
  '/supervisor': 'Dashboard',
  '/supervisor/actual-overtime': 'Actual overtime',
  '/supervisor/approvals': 'Approvals',
  '/supervisor/assign-overtime': 'Assign overtime',
  '/supervisor/department-plans': 'Department plans',
  '/supervisor/department-drafts': 'Department drafts',
  '/supervisor/overtime-department-plans': 'Overtime department plan',
  '/supervisor/notifications': 'Notifications',
  '/supervisor/profile': 'My profile',
  '/supervisor/team': 'My team',
}

function getUserName(user) {
  return user?.name
    || [user?.firstName, user?.lastName].filter(Boolean).join(' ')
    || 'Supervisor'
}

function getPageTitle(pathname) {
  if (pathname.startsWith('/supervisor/overtime-department-plans/')) return 'Overtime department plan'
  if (pathname.startsWith('/supervisor/department-plans/')) return 'Department plan details'
  if (pathname.startsWith('/supervisor/team/')) return 'Employee profile'
  return pageTitles[pathname] || 'Supervisor workspace'
}

export function SupervisorLayout() {
  const [isNavigationOpen, setIsNavigationOpen] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const profileMenuRef = useRef(null)
  const location = useLocation()
  const toast = useToast()
  const { logout, user } = useAuth()
  const userName = getUserName(user)

  function handleLogout() {
    setIsProfileMenuOpen(false)
    toast.success('Logged out successfully.')
    logout()
  }

  useEffect(() => {
    setIsNavigationOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!isNavigationOpen) return undefined

    function handleEscape(event) {
      if (event.key === 'Escape') setIsNavigationOpen(false)
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isNavigationOpen])

  useEffect(() => {
    if (!isProfileMenuOpen) return undefined

    function handlePointerDown(event) {
      if (!profileMenuRef.current?.contains(event.target)) {
        setIsProfileMenuOpen(false)
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') setIsProfileMenuOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isProfileMenuOpen])

  return (
    <div className="supervisor-shell">
      {isNavigationOpen ? (
        <button
          aria-label="Close navigation"
          className="supervisor-navigation-backdrop"
          onClick={() => setIsNavigationOpen(false)}
          type="button"
        />
      ) : null}

      <aside className={`supervisor-sidebar${isNavigationOpen ? ' supervisor-sidebar--open' : ''}`}>
        <div className="supervisor-brand">
          <BrandMark />
          <div>
            <strong>Overtime System</strong>
            <span>Supervisor</span>
          </div>
          <button
            aria-label="Close navigation"
            className="supervisor-sidebar__close"
            onClick={() => setIsNavigationOpen(false)}
            type="button"
          >
            <X size={19} aria-hidden="true" />
          </button>
        </div>

        <nav className="supervisor-nav" aria-label="Supervisor navigation">
          <span className="supervisor-nav__label">Workspace</span>
          {supervisorNavigation.map(({ end, icon, label, to }) => (
            <NavLink
              className={({ isActive }) => (
                isActive
                  ? 'supervisor-nav__item supervisor-nav__item--active'
                  : 'supervisor-nav__item'
              )}
              end={end}
              key={label}
              to={to}
            >
              {createElement(icon, { size: 18, strokeWidth: 1.9, 'aria-hidden': true })}
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="supervisor-sidebar__identity">
          <span className="supervisor-sidebar__avatar" aria-hidden="true">
            <UserRound size={18} />
          </span>
          <span>
            <strong>{userName}</strong>
            <small>Supervisor account</small>
          </span>
        </div>
      </aside>

      <div className="supervisor-workspace">
        <header className="supervisor-topbar">
          <div className="supervisor-topbar__title">
            <button
              aria-expanded={isNavigationOpen}
              aria-label="Open navigation"
              className="supervisor-mobile-nav"
              onClick={() => setIsNavigationOpen(true)}
              type="button"
            >
              <Menu size={20} aria-hidden="true" />
            </button>
            <div>
              <span>Supervisor portal</span>
              <strong>{getPageTitle(location.pathname)}</strong>
            </div>
          </div>

          <div className="supervisor-topbar__actions">
            <NotificationMenu portal="supervisor" />

            <div className="supervisor-profile-menu" ref={profileMenuRef}>
              <button
                aria-expanded={isProfileMenuOpen}
                aria-haspopup="menu"
                className="supervisor-profile-menu__trigger"
                onClick={() => setIsProfileMenuOpen((current) => !current)}
                type="button"
              >
                <span className="supervisor-profile-menu__avatar" aria-hidden="true">
                  <UserRound size={18} />
                </span>
                <span className="supervisor-profile-menu__copy">
                  <strong>{userName}</strong>
                  <small>Supervisor</small>
                </span>
                <ChevronDown
                  className={isProfileMenuOpen ? 'supervisor-profile-menu__chevron--open' : ''}
                  size={15}
                  aria-hidden="true"
                />
              </button>

              {isProfileMenuOpen ? (
                <div className="supervisor-profile-menu__popover" role="menu">
                  <Link
                    onClick={() => setIsProfileMenuOpen(false)}
                    role="menuitem"
                    to="/supervisor/profile"
                  >
                    <UserRound size={17} aria-hidden="true" />
                    <span>Profile</span>
                  </Link>
                  <button onClick={handleLogout} role="menuitem" type="button">
                    <LogOut size={17} aria-hidden="true" />
                    <span>Logout</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <Outlet />
      </div>
    </div>
  )
}
