import { createElement, useEffect, useRef, useState } from 'react'
import {
  CalendarDays,
  CalendarPlus,
  ChevronDown,
  FileClock,
  Home,
  LogOut,
  Menu,
  UserRound,
  X,
} from 'lucide-react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { BrandMark } from '../../components/shared/BrandMark.jsx'
import { useToast } from '../../components/shared/toast/useToast.js'
import { useAuth } from '../auth/useAuth.js'
import { NotificationMenu } from './components/notifications/NotificationMenu.jsx'
import './employee.css'

const employeeNavigation = [
  { label: 'Home', icon: Home, to: '/employee', end: true },
  { label: 'Overtime plan', icon: CalendarDays, to: '/employee/plans', end: true },
  { label: 'Create OT plan', icon: CalendarPlus, to: '/employee/plans/new', end: true },
  { label: 'Actual overtime', icon: FileClock, to: '/employee/actual-overtime' },
]

const pageTitles = {
  '/employee': 'Home',
  '/employee/plans': 'Overtime plan',
  '/employee/plans/new': 'Create OT plan',
  '/employee/actual-overtime': 'Actual overtime',
  '/employee/notifications': 'Notifications',
  '/employee/profile': 'My profile',
}

function getUserName(user) {
  return user?.name
    || [user?.firstName, user?.lastName].filter(Boolean).join(' ')
    || 'Employee'
}

export function EmployeeLayout() {
  const [isNavigationOpen, setIsNavigationOpen] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const profileMenuRef = useRef(null)
  const { logout, user } = useAuth()
  const toast = useToast()
  const location = useLocation()
  const pageTitle = location.pathname.endsWith('/edit')
    ? 'Edit OT plan'
    : location.pathname.startsWith('/employee/plans/')
      ? pageTitles[location.pathname] || 'Overtime plan details'
      : pageTitles[location.pathname] || 'Employee portal'

  function handleLogout() {
    setIsProfileMenuOpen(false)
    toast.success('Logged out successfully.')
    logout()
  }

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
    <div className="employee-shell">
      {isNavigationOpen ? (
        <button
          aria-label="Close navigation"
          className="navigation-backdrop"
          onClick={() => setIsNavigationOpen(false)}
          type="button"
        />
      ) : null}

      <aside className={`employee-sidebar${isNavigationOpen ? ' employee-sidebar--open' : ''}`}>
        <div className="employee-brand">
          <BrandMark />
          <span>Overtime System</span>
          <button
            aria-label="Close navigation"
            className="sidebar-close-button"
            onClick={() => setIsNavigationOpen(false)}
            type="button"
          >
            <X size={19} />
          </button>
        </div>

        <nav className="employee-nav" aria-label="Employee navigation">
          <p>Employee workspace</p>
          {employeeNavigation.map(({ label, icon, to, end }) => (
            <NavLink
              className={({ isActive }) => (
                isActive
                  ? 'employee-nav__item employee-nav__item--active'
                  : 'employee-nav__item'
              )}
              end={end}
              key={label}
              onClick={() => setIsNavigationOpen(false)}
              to={to}
            >
              {createElement(icon, {
                size: 18,
                strokeWidth: 2,
                'aria-hidden': true,
              })}
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

      </aside>

      <div className="employee-workspace">
        <header className="employee-topbar">
          <button
            aria-expanded={isNavigationOpen}
            aria-label="Open navigation"
            className="mobile-nav-button"
            onClick={() => setIsNavigationOpen(true)}
            type="button"
          >
            <Menu size={20} />
          </button>
          <span className="employee-topbar__section">{pageTitle}</span>

          <div className="employee-topbar__actions">
            <NotificationMenu />

            <div className="profile-menu" ref={profileMenuRef}>
              <button
                aria-expanded={isProfileMenuOpen}
                aria-haspopup="menu"
                className="profile-menu__trigger"
                onClick={() => setIsProfileMenuOpen((current) => !current)}
                type="button"
              >
                <span className="employee-avatar" aria-hidden="true">
                  <UserRound size={18} strokeWidth={1.8} />
                </span>
                <span className="profile-menu__name">{getUserName(user)}</span>
                <ChevronDown
                  className={isProfileMenuOpen ? 'profile-menu__chevron profile-menu__chevron--open' : 'profile-menu__chevron'}
                  size={15}
                  aria-hidden="true"
                />
              </button>

              {isProfileMenuOpen ? (
                <div className="profile-menu__popover" role="menu">
                  <Link
                    onClick={() => setIsProfileMenuOpen(false)}
                    role="menuitem"
                    to="/employee/profile"
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
