import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bell,
  CalendarClock,
  CheckCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileCheck2,
  MessageSquareText,
  RefreshCw,
  RotateCcw,
  Send,
  XCircle,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { notificationApi } from '../../../api/notificationApi.js'
import { actualOvertimeApi } from '../../../api/actualOvertimeApi.js'
import { overtimePlanApi } from '../../../api/overtimePlanApi.js'
import { useToast } from '../../../components/shared/toast/useToast.js'
import './employeeNotifications.css'

const PAGE_SIZE = 10
const NOTIFICATION_QUERY_KEY = ['employee', 'notifications']

function formatDateTime(value) {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function formatPeriod(startDate, endDate) {
  if (!startDate || !endDate) return ''

  const format = new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
  return `${format.format(new Date(`${startDate}T00:00:00`))} - ${format.format(new Date(`${endDate}T00:00:00`))}`
}

function getNotificationVisual(type = '') {
  if (type === 'actual_comment_added') {
    return { icon: MessageSquareText, tone: 'primary' }
  }
  if (type === 'actual_period_finalized') {
    return { icon: FileCheck2, tone: 'neutral' }
  }
  if (type === 'actual_hours_updated') {
    return { icon: CalendarClock, tone: 'primary' }
  }
  if (type.includes('returned') || type.includes('reset')) {
    return { icon: RotateCcw, tone: 'warning' }
  }
  if (type.includes('rejected')) {
    return { icon: XCircle, tone: 'danger' }
  }
  if (type.includes('approved') || type.includes('accepted')) {
    return { icon: CheckCircle2, tone: 'success' }
  }
  if (type.includes('signed')) {
    return { icon: FileCheck2, tone: 'success' }
  }
  if (type.includes('submitted')) {
    return { icon: Send, tone: 'primary' }
  }
  return { icon: Clock3, tone: 'neutral' }
}

function NotificationPageSkeleton() {
  return (
    <div className="notifications-page__skeleton" aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index}><i /><span /><span /><span /></div>
      ))}
    </div>
  )
}

export function EmployeeNotificationsPage() {
  const [filter, setFilter] = useState('all')
  const [offset, setOffset] = useState(0)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const notificationsQuery = useQuery({
    queryKey: [...NOTIFICATION_QUERY_KEY, 'page', { filter, offset }],
    queryFn: () => notificationApi.list({
      limit: PAGE_SIZE,
      offset,
      unreadOnly: filter === 'unread' ? true : undefined,
    }),
  })
  const markAllMutation = useMutation({ mutationFn: notificationApi.markAllRead })
  const markPlanMutation = useMutation({ mutationFn: notificationApi.markPlanRead })
  const markActualPeriodMutation = useMutation({ mutationFn: notificationApi.markActualPeriodRead })

  const notifications = notificationsQuery.data?.notifications || []
  const unreadCount = notificationsQuery.data?.unreadCount || 0
  const total = filter === 'unread'
    ? unreadCount
    : notificationsQuery.data?.pagination?.total || 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.min(pageCount, Math.floor(offset / PAGE_SIZE) + 1)
  const firstItem = total ? offset + 1 : 0
  const lastItem = Math.min(offset + notifications.length, total)

  useEffect(() => {
    if (offset > 0 && offset >= total && !notificationsQuery.isFetching) {
      setOffset(Math.max(0, (pageCount - 1) * PAGE_SIZE))
    }
  }, [notificationsQuery.isFetching, offset, pageCount, total])

  function changeFilter(nextFilter) {
    setFilter(nextFilter)
    setOffset(0)
  }

  async function handleMarkAllRead() {
    try {
      await markAllMutation.mutateAsync()
      setOffset(0)
      await queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEY })
      toast.success('All notifications marked as read.')
    } catch (error) {
      toast.error(error.message)
    }
  }

  async function handleNotificationClick(notification) {
    try {
      if (notification.targetType === 'actual_overtime' && notification.actualPeriodId) {
        await markActualPeriodMutation.mutateAsync(notification.actualPeriodId)
        await queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEY })
        await queryClient.fetchQuery({
          queryKey: [
            'employee',
            'actual-overtime',
            'period',
            notification.actualPeriodId,
          ],
          queryFn: () => actualOvertimeApi.getPeriod(notification.actualPeriodId),
          staleTime: 0,
        })
        const searchParams = new URLSearchParams({ period: notification.actualPeriodId })
        if (notification.actualDate) searchParams.set('date', notification.actualDate)
        navigate(`/employee/actual-overtime?${searchParams.toString()}`)
        return
      }

      await markPlanMutation.mutateAsync(notification.planId)
      await queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEY })
      await queryClient.fetchQuery({
        queryKey: ['employee', 'overtime-plan', notification.planId],
        queryFn: () => overtimePlanApi.getPlan(notification.planId),
        staleTime: 0,
      })
      navigate(`/employee/plans/${encodeURIComponent(notification.planId)}#activity-history`)
    } catch (error) {
      if (error.status === 404) {
        await queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEY })
        toast.info(notification.targetType === 'actual_overtime'
          ? 'This actual overtime record is no longer available.'
          : 'This overtime plan is no longer available.')
        return
      }
      toast.error(error.message)
    }
  }

  return (
    <main className="employee-main notifications-page">
      <section className="notifications-toolbar" aria-label="Notification controls">
        <div className="notifications-filter" aria-label="Notification filter" role="group">
          <button aria-pressed={filter === 'all'} onClick={() => changeFilter('all')} type="button">
            All
          </button>
          <button aria-pressed={filter === 'unread'} onClick={() => changeFilter('unread')} type="button">
            Unread
            {unreadCount ? <span>{unreadCount > 99 ? '99+' : unreadCount}</span> : null}
          </button>
        </div>
        <div className="notifications-toolbar__summary" aria-live="polite">
          <strong>{total.toLocaleString('en')}</strong>
          <span>{filter === 'unread' ? 'unread' : 'notifications'}</span>
        </div>
        <div className="notifications-toolbar__actions">
          <button
            aria-label="Mark all notifications as read"
            disabled={!unreadCount || markAllMutation.isPending}
            onClick={handleMarkAllRead}
            title="Mark all as read"
            type="button"
          >
            <CheckCheck size={17} aria-hidden="true" />
          </button>
          <button
            aria-label="Refresh notifications"
            disabled={notificationsQuery.isFetching}
            onClick={() => notificationsQuery.refetch()}
            title="Refresh notifications"
            type="button"
          >
            <RefreshCw className={notificationsQuery.isFetching ? 'notifications-page__spin' : ''} size={16} aria-hidden="true" />
          </button>
        </div>
      </section>

      <section className="notifications-history" aria-labelledby="notification-history-heading">
        <header>
          <div>
            <Bell size={18} aria-hidden="true" />
            <span>
              <h1 id="notification-history-heading">Notification history</h1>
              <small>{total ? `Showing ${firstItem}-${lastItem} of ${total}` : 'No matching activity'}</small>
            </span>
          </div>
        </header>

        {notificationsQuery.isLoading ? (
          <>
            <span className="notifications-page__visually-hidden" role="status">Loading notifications...</span>
            <NotificationPageSkeleton />
          </>
        ) : null}

        {notificationsQuery.isError ? (
          <div className="notifications-page__state" role="alert">
            <Bell size={24} aria-hidden="true" />
            <strong>Unable to load notifications</strong>
            <span>{notificationsQuery.error.message}</span>
            <button onClick={() => notificationsQuery.refetch()} type="button">
              <RefreshCw size={15} aria-hidden="true" />Retry
            </button>
          </div>
        ) : null}

        {notificationsQuery.isSuccess && !notifications.length ? (
          <div className="notifications-page__state">
            <CheckCheck size={25} aria-hidden="true" />
            <strong>{filter === 'unread' ? 'You are all caught up' : 'No notifications yet'}</strong>
            <span>{filter === 'unread' ? 'There are no unread notifications.' : 'Overtime plan activity will appear here.'}</span>
          </div>
        ) : null}

        {notificationsQuery.isSuccess && notifications.length ? (
          <ol className="notifications-history__list">
            {notifications.map((notification) => {
              const visual = getNotificationVisual(notification.type)
              const Icon = visual.icon
              return (
                <li className={notification.readAt ? '' : 'notifications-history__item--unread'} key={notification.notificationId}>
                  <button onClick={() => handleNotificationClick(notification)} type="button">
                    <span className={`notifications-history__icon notifications-history__icon--${visual.tone}`} aria-hidden="true">
                      <Icon size={17} />
                    </span>
                    <span className="notifications-history__copy">
                      <span className="notifications-history__title">
                        <strong>{notification.title}</strong>
                        {!notification.readAt ? <i>Unread</i> : null}
                      </span>
                      <span>{notification.message}</span>
                      <small>{notification.actorName || 'System'}{notification.createdAt ? ` - ${formatDateTime(notification.createdAt)}` : ''}</small>
                    </span>
                    <span className="notifications-history__period">
                      <small>{notification.targetType === 'actual_overtime' ? 'Actual OT period' : 'Plan period'}</small>
                      <strong>{formatPeriod(notification.periodStartDate, notification.periodEndDate) || (notification.targetType === 'actual_overtime' ? 'View actual overtime' : 'View overtime plan')}</strong>
                    </span>
                    <ChevronRight size={17} aria-hidden="true" />
                  </button>
                </li>
              )
            })}
          </ol>
        ) : null}

        <footer className="notifications-pagination">
          <span>Page {currentPage} of {pageCount}</span>
          <div>
            <button
              aria-label="Previous notification page"
              disabled={offset === 0 || notificationsQuery.isFetching}
              onClick={() => setOffset((current) => Math.max(0, current - PAGE_SIZE))}
              title="Previous page"
              type="button"
            >
              <ChevronLeft size={17} aria-hidden="true" />
            </button>
            <strong>{currentPage}</strong>
            <button
              aria-label="Next notification page"
              disabled={offset + PAGE_SIZE >= total || notificationsQuery.isFetching}
              onClick={() => setOffset((current) => current + PAGE_SIZE)}
              title="Next page"
              type="button"
            >
              <ChevronRight size={17} aria-hidden="true" />
            </button>
          </div>
        </footer>
      </section>
    </main>
  )
}
