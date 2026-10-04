import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  Bell,
  CalendarClock,
  CheckCheck,
  Clock3,
  RefreshCw,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { notificationApi } from '../../../../api/notificationApi.js'
import { actualOvertimeApi } from '../../../../api/actualOvertimeApi.js'
import { overtimePlanApi } from '../../../../api/overtimePlanApi.js'
import { useToast } from '../../../../components/shared/toast/useToast.js'
import './notificationMenu.css'

function formatNotificationTime(value) {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(date)
}

function NotificationSkeleton() {
  return (
    <div className="notification-menu__skeleton" aria-hidden="true">
      {[0, 1, 2].map((item) => (
        <div key={item}>
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  )
}

export function NotificationMenu({ portal = 'employee' }) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const basePath = portal === 'supervisor' ? '/supervisor' : '/employee'
  const notificationsQueryKey = [portal, 'notifications']
  const notificationsQuery = useQuery({
    queryKey: notificationsQueryKey,
    queryFn: () => notificationApi.list({ limit: 20, offset: 0 }),
    refetchOnWindowFocus: false,
    refetchInterval: false,
  })

  const markReadMutation = useMutation({
    mutationFn: notificationApi.markRead,
  })
  const markAllMutation = useMutation({
    mutationFn: notificationApi.markAllRead,
  })

  const notifications = notificationsQuery.data?.notifications || []
  const unreadCount = notificationsQuery.data?.unreadCount || 0
  const visibleUnreadCount = unreadCount > 99 ? '99+' : String(unreadCount)

  useEffect(() => {
    if (!isOpen) return undefined

    function handlePointerDown(event) {
      if (!menuRef.current?.contains(event.target)) {
        setIsOpen(false)
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  function markCachedNotificationRead(notificationId) {
    queryClient.setQueryData(notificationsQueryKey, (current) => {
      if (!current) return current

      const notification = current.notifications.find(
        (item) => item.notificationId === notificationId,
      )
      const wasUnread = notification && !notification.readAt

      return {
        ...current,
        notifications: current.notifications.map((item) => (
          item.notificationId === notificationId
            ? { ...item, readAt: item.readAt || new Date().toISOString() }
            : item
        )),
        unreadCount: wasUnread
          ? Math.max(0, current.unreadCount - 1)
          : current.unreadCount,
      }
    })
  }

  function removeCachedNotification(notificationId) {
    queryClient.setQueryData(notificationsQueryKey, (current) => {
      if (!current) return current

      const notification = current.notifications.find((item) => (
        item.notificationId === notificationId
      ))

      return {
        ...current,
        notifications: current.notifications.filter((item) => (
          item.notificationId !== notificationId
        )),
        unreadCount: notification && !notification.readAt
          ? Math.max(0, current.unreadCount - 1)
          : current.unreadCount,
      }
    })
  }

  async function handleNotificationClick(notification) {
    if (!notification.readAt) {
      try {
        await markReadMutation.mutateAsync(notification.notificationId)
        markCachedNotificationRead(notification.notificationId)
      } catch (error) {
        if (error.status === 404) {
          removeCachedNotification(notification.notificationId)
          setIsOpen(false)
          toast.info('This overtime plan is no longer available.')
          return
        }

        toast.error(error.message)
        return
      }
    }

    if (notification.targetType === 'actual_overtime' && notification.actualPeriodId) {
      try {
        await queryClient.fetchQuery({
          queryKey: [
            portal,
            'actual-overtime',
            'period',
            notification.actualPeriodId,
          ],
          queryFn: () => actualOvertimeApi.getPeriod(notification.actualPeriodId),
          staleTime: 0,
        })
      } catch (error) {
        if (error.status === 404) {
          removeCachedNotification(notification.notificationId)
          setIsOpen(false)
          toast.info('This actual overtime record is no longer available.')
          return
        }

        toast.error(error.message)
        return
      }

      const searchParams = new URLSearchParams({ period: notification.actualPeriodId })
      if (notification.actualDate) searchParams.set('date', notification.actualDate)
      setIsOpen(false)
      navigate(`${basePath}/actual-overtime?${searchParams.toString()}`)
      return
    }

    try {
      await queryClient.fetchQuery({
        queryKey: [portal, 'overtime-plan', notification.planId],
        queryFn: () => overtimePlanApi.getPlan(notification.planId),
        staleTime: 0,
      })
    } catch (error) {
      if (error.status === 404) {
        removeCachedNotification(notification.notificationId)
        setIsOpen(false)
        toast.info('This overtime plan is no longer available.')
        return
      }

      toast.error(error.message)
      return
    }

    setIsOpen(false)
    const planCollection = portal === 'supervisor'
      ? notification.planScope === 'department' ? 'department-plans' : 'employee-plans'
      : 'plans'
    navigate(`${basePath}/${planCollection}/${encodeURIComponent(notification.planId)}#activity-history`)
  }

  async function handleMarkAllRead() {
    try {
      await markAllMutation.mutateAsync()
      queryClient.setQueryData(notificationsQueryKey, (current) => (
        current
          ? {
              ...current,
              notifications: current.notifications.map((notification) => ({
                ...notification,
                readAt: notification.readAt || new Date().toISOString(),
              })),
              unreadCount: 0,
            }
          : current
      ))
    } catch (error) {
      toast.error(error.message)
    }
  }

  return (
    <div className="notification-menu" ref={menuRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        className="notification-button"
        onClick={() => setIsOpen((current) => !current)}
        title="Notifications"
        type="button"
      >
        <Bell size={18} aria-hidden="true" />
        {unreadCount ? (
          <span className="notification-button__badge" aria-hidden="true">
            {visibleUnreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <section className="notification-menu__popover" aria-label="Notifications">
          <header className="notification-menu__header">
            <div>
              <strong>Notifications</strong>
              {unreadCount ? <span>{unreadCount} unread</span> : null}
            </div>
            <div className="notification-menu__tools">
              {unreadCount ? (
                <button
                  aria-label="Mark all notifications as read"
                  disabled={markAllMutation.isPending}
                  onClick={handleMarkAllRead}
                  title="Mark all as read"
                  type="button"
                >
                  <CheckCheck size={17} aria-hidden="true" />
                </button>
              ) : null}
              <button
                aria-label="Refresh notifications"
                disabled={notificationsQuery.isFetching}
                onClick={() => notificationsQuery.refetch()}
                title="Refresh notifications"
                type="button"
              >
                <RefreshCw
                  className={notificationsQuery.isFetching ? 'notification-menu__refresh--active' : ''}
                  size={16}
                  aria-hidden="true"
                />
              </button>
            </div>
          </header>

          <div className="notification-menu__content">
            {notificationsQuery.isLoading ? (
              <>
                <span className="notification-menu__visually-hidden" role="status">
                  Loading notifications...
                </span>
                <NotificationSkeleton />
              </>
            ) : null}

            {notificationsQuery.isError ? (
              <div className="notification-menu__state" role="alert">
                <Bell size={22} aria-hidden="true" />
                <strong>Unable to load notifications</strong>
                <span>{notificationsQuery.error.message}</span>
              </div>
            ) : null}

            {notificationsQuery.isSuccess && !notifications.length ? (
              <div className="notification-menu__state">
                <CheckCheck size={23} aria-hidden="true" />
                <strong>No notifications</strong>
                <span>New overtime activity will appear here.</span>
              </div>
            ) : null}

            {notificationsQuery.isSuccess && notifications.length ? (
              <ol className="notification-menu__list">
                {notifications.map((notification) => (
                  <li key={notification.notificationId}>
                    <button
                      className={notification.readAt ? '' : 'notification-menu__item--unread'}
                      onClick={() => handleNotificationClick(notification)}
                      type="button"
                    >
                      <span className="notification-menu__item-icon" aria-hidden="true">
                        {notification.targetType === 'actual_overtime'
                          ? <CalendarClock size={16} />
                          : <Clock3 size={16} />}
                      </span>
                      <span className="notification-menu__item-copy">
                        <strong>{notification.title}</strong>
                        <span>{notification.message}</span>
                        <small>
                          {notification.actorName || 'System'}
                          {notification.createdAt ? ` - ${formatNotificationTime(notification.createdAt)}` : ''}
                        </small>
                      </span>
                      {!notification.readAt ? (
                        <span className="notification-menu__unread-dot" aria-label="Unread" />
                      ) : null}
                    </button>
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
          <footer className="notification-menu__footer">
            <Link onClick={() => setIsOpen(false)} to={`${basePath}/notifications`}>
              <span>View all notifications</span>
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </footer>
        </section>
      ) : null}
    </div>
  )
}
