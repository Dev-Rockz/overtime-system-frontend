import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import {
  AlertCircle,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileClock,
  MessageSquareText,
  RefreshCw,
  Send,
} from 'lucide-react'
import { actualOvertimeApi } from '../../../api/actualOvertimeApi.js'
import { useToast } from '../../../components/shared/toast/useToast.js'
import { useAuth } from '../../auth/useAuth.js'
import './actualOvertime.css'

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const ACTUAL_PERIODS_QUERY_KEY = ['employee', 'actual-overtime', 'periods']

function getPeriodQueryKey(actualPeriodId) {
  return ['employee', 'actual-overtime', 'period', actualPeriodId || '']
}

function parseDate(value) {
  return new Date(`${value}T00:00:00`)
}

function toDateValue(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(date, numberOfDays) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + numberOfDays)
  return nextDate
}

function getMonthCalendarDays(dateValue, selectedWeekEnd) {
  const monthDate = parseDate(dateValue)
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
  const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)
  const gridStart = addDays(monthStart, -monthStart.getDay())
  let gridEnd = addDays(monthEnd, 6 - monthEnd.getDay())
  const weekEnd = parseDate(selectedWeekEnd)
  const requiredGridEnd = addDays(weekEnd, 6 - weekEnd.getDay())
  const days = []

  if (requiredGridEnd > gridEnd) gridEnd = requiredGridEnd

  for (let date = gridStart; date <= gridEnd; date = addDays(date, 1)) {
    days.push(date)
  }

  return days
}

function formatMonth(value) {
  return new Intl.DateTimeFormat('en', {
    month: 'long',
    year: 'numeric',
  }).format(parseDate(value))
}

function formatDate(value, options = {}) {
  if (!value) return ''
  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: options.short ? 'short' : 'long',
    weekday: options.weekday ? 'short' : undefined,
    year: 'numeric',
  }).format(parseDate(value))
}

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

function formatHours(value) {
  return new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(Number(value) || 0)
}

function formatVariance(value) {
  const variance = Number(value) || 0
  if (variance === 0) return '0'
  return `${variance > 0 ? '+' : ''}${formatHours(variance)}`
}

function getVarianceTone(variance) {
  if (variance > 0) return 'higher'
  if (variance < 0) return 'lower'
  return 'matched'
}

function isUntouchedOpenEntry(entry, periodStatus) {
  return periodStatus === 'open' && !entry.lastUpdatedAt
}

function isPendingEntry(entry, periodStatus, todayValue) {
  return isUntouchedOpenEntry(entry, periodStatus)
    && entry.actualDate >= todayValue
}

function getDisplayedActualHours(entry, periodStatus, todayValue) {
  if (isPendingEntry(entry, periodStatus, todayValue)) return 0
  if (isUntouchedOpenEntry(entry, periodStatus) && entry.actualDate < todayValue) {
    return Number(entry.plannedHours) || 0
  }
  return Number(entry.actualHours) || 0
}

function ActualOvertimeSkeleton() {
  return (
    <div className="actual-overtime-skeleton" aria-hidden="true">
      <section className="actual-overtime-skeleton__toolbar">
        <i /><span /><span /><span /><i />
      </section>
      <section className="actual-overtime-skeleton__summary">
        {Array.from({ length: 4 }, (_, index) => <span key={index}><i /><b /></span>)}
      </section>
      <section className="actual-overtime-skeleton__calendar">
        <header><i /><span /></header>
        <div>
          {Array.from({ length: 7 }, (_, index) => <b key={`weekday-${index}`} />)}
          {Array.from({ length: 35 }, (_, index) => <i key={`day-${index}`} />)}
        </div>
        <footer />
      </section>
      <section className="actual-overtime-skeleton__detail">
        <header><i /><span /></header>
        <div><span /><span /></div>
      </section>
    </div>
  )
}

function EmptyActualOvertime({ error, onRetry }) {
  return (
    <section className="actual-overtime-state" role={error ? 'alert' : undefined}>
      {error ? <AlertCircle size={27} aria-hidden="true" /> : <FileClock size={28} aria-hidden="true" />}
      <strong>{error ? 'Unable to load actual overtime' : 'No actual overtime available'}</strong>
      <span>{error?.message || 'Your latest approved overtime period will appear here.'}</span>
      {error ? (
        <button onClick={onRetry} type="button"><RefreshCw size={15} aria-hidden="true" />Retry</button>
      ) : null}
    </section>
  )
}

export function ActualOvertimePage() {
  const [selectedEntryId, setSelectedEntryId] = useState('')
  const [comment, setComment] = useState('')
  const [commentError, setCommentError] = useState('')
  const commentsRef = useRef(null)
  const queryClient = useQueryClient()
  const toast = useToast()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedPeriodId = searchParams.get('period')?.trim() || ''
  const requestedDate = searchParams.get('date')?.trim() || ''
  const periodsQuery = useQuery({
    queryKey: ACTUAL_PERIODS_QUERY_KEY,
    queryFn: () => actualOvertimeApi.listMyPeriods(),
  })
  const weeklyPeriods = useMemo(() => (
    (periodsQuery.data || [])
      .filter((period) => period.periodType === 'weekly')
      .sort((left, right) => right.periodStartDate.localeCompare(left.periodStartDate))
  ), [periodsQuery.data])
  const recentPeriod = weeklyPeriods.find((period) => (
    period.actualPeriodId === requestedPeriodId
  )) || weeklyPeriods[0] || null
  const selectedPeriodIndex = weeklyPeriods.findIndex((period) => (
    period.actualPeriodId === recentPeriod?.actualPeriodId
  ))
  const previousWeek = selectedPeriodIndex >= 0
    ? weeklyPeriods[selectedPeriodIndex + 1] || null
    : null
  const nextWeek = selectedPeriodIndex > 0
    ? weeklyPeriods[selectedPeriodIndex - 1] || null
    : null
  const calendarMonth = recentPeriod?.periodStartDate || ''
  const calendarDays = useMemo(() => (
    recentPeriod
      ? getMonthCalendarDays(calendarMonth, recentPeriod.periodEndDate)
      : []
  ), [calendarMonth, recentPeriod])
  const calendarStart = calendarDays.length ? toDateValue(calendarDays[0]) : ''
  const calendarEnd = calendarDays.length ? toDateValue(calendarDays[calendarDays.length - 1]) : ''
  const visiblePeriods = useMemo(() => weeklyPeriods.filter((period) => (
    period.periodEndDate >= calendarStart && period.periodStartDate <= calendarEnd
  )), [calendarEnd, calendarStart, weeklyPeriods])
  const periodQueries = useQueries({
    queries: visiblePeriods.map((period) => ({
      queryKey: getPeriodQueryKey(period.actualPeriodId),
      queryFn: () => actualOvertimeApi.getPeriod(period.actualPeriodId),
    })),
  })
  const selectedPeriodQueryIndex = visiblePeriods.findIndex((period) => (
    period.actualPeriodId === recentPeriod?.actualPeriodId
  ))
  const periodQuery = selectedPeriodQueryIndex >= 0
    ? periodQueries[selectedPeriodQueryIndex]
    : null
  const actualPeriod = periodQuery?.data || null
  const visibleActualPeriods = periodQueries.map((queryResult) => queryResult.data).filter(Boolean)
  const periodQueryKey = getPeriodQueryKey(recentPeriod?.actualPeriodId)
  const entries = useMemo(() => actualPeriod?.entries || [], [actualPeriod?.entries])
  const weeklyEntries = useMemo(() => entries.filter((entry) => (
    entry.actualDate >= (actualPeriod?.periodStartDate || '')
      && entry.actualDate <= (actualPeriod?.periodEndDate || '')
  )), [actualPeriod?.periodEndDate, actualPeriod?.periodStartDate, entries])
  const todayValue = toDateValue(new Date())
  const requestedEntryId = weeklyEntries.find((entry) => entry.actualDate === requestedDate)
    ?.actualEntryId || ''
  const selectedEntry = weeklyEntries.find((entry) => entry.actualEntryId === selectedEntryId)
    || weeklyEntries.find((entry) => entry.actualDate === requestedDate)
    || weeklyEntries.find((entry) => entry.actualDate === todayValue)
    || weeklyEntries[0]
    || null
  const calendarEntries = useMemo(() => visibleActualPeriods.flatMap((period) => (
    (period.entries || []).map((entry) => ({
      ...entry,
      periodStatus: entry.periodStatus || period.status,
    }))
  )), [visibleActualPeriods])
  const entriesByDate = useMemo(() => {
    const byDate = new Map()

    calendarEntries.forEach((entry) => {
      const dateEntries = byDate.get(entry.actualDate) || []
      dateEntries.push(entry)
      byDate.set(entry.actualDate, dateEntries)
    })

    return byDate
  }, [calendarEntries])
  const displayedActualHours = weeklyEntries.reduce((sum, entry) => (
    sum + getDisplayedActualHours(entry, actualPeriod?.status, todayValue)
  ), 0)
  const displayedPlannedHours = weeklyEntries.reduce(
    (sum, entry) => sum + (Number(entry.plannedHours) || 0),
    0,
  )
  const totalVariance = weeklyEntries.reduce((sum, entry) => (
    isPendingEntry(entry, actualPeriod?.status, todayValue)
      ? sum
      : sum + getDisplayedActualHours(entry, actualPeriod?.status, todayValue)
        - (Number(entry.plannedHours) || 0)
  ), 0)
  const selectedIsPending = selectedEntry
    ? isPendingEntry(selectedEntry, actualPeriod?.status, todayValue)
    : false
  const selectedActualHours = selectedEntry
    ? getDisplayedActualHours(selectedEntry, actualPeriod?.status, todayValue)
    : 0
  const selectedVariance = selectedEntry && !selectedIsPending
    ? selectedActualHours - (Number(selectedEntry.plannedHours) || 0)
    : 0
  const commentMutation = useMutation({
    mutationFn: ({ actualEntryId, remarks }) => (
      actualOvertimeApi.addComment(actualEntryId, remarks)
    ),
    onSuccess: (savedComment, variables) => {
      queryClient.setQueryData(periodQueryKey, (current) => (
        current
          ? {
              ...current,
              entries: current.entries.map((entry) => (
                entry.actualEntryId === variables.actualEntryId
                  ? { ...entry, comments: [...(entry.comments || []), savedComment] }
                  : entry
              )),
            }
          : current
      ))
      setComment('')
      setCommentError('')
      toast.success('Comment added to actual overtime.')
    },
    onError: (error) => {
      setCommentError(error.message)
      toast.error(error.message)
    },
  })

  useEffect(() => {
    setSelectedEntryId(requestedEntryId)
    setComment('')
    setCommentError('')
  }, [periodQuery?.data?.actualPeriodId, requestedDate, requestedEntryId])

  useEffect(() => {
    if (!commentsRef.current) return
    commentsRef.current.scrollTop = commentsRef.current.scrollHeight
  }, [selectedEntry?.actualEntryId, selectedEntry?.comments?.length])

  function selectDate(dateEntries) {
    if (!dateEntries.length) return
    const entry = dateEntries[0]
    setSelectedEntryId(entry.actualEntryId)
    setSearchParams({ period: entry.actualPeriodId, date: entry.actualDate })
    setCommentError('')
  }

  function selectWeek(period) {
    if (!period) return
    setSelectedEntryId('')
    setSearchParams({ period: period.actualPeriodId })
  }

  function handleCommentSubmit(event) {
    event.preventDefault()
    const remarks = comment.trim()

    if (!remarks) {
      setCommentError('Enter a comment before sending.')
      return
    }

    commentMutation.mutate({ actualEntryId: selectedEntry.actualEntryId, remarks })
  }

  async function refreshActualOvertime() {
    const result = await periodsQuery.refetch()
    const refreshedWeeks = (result.data || []).filter((period) => (
      period.periodType === 'weekly'
    ))
    const refreshedPeriod = refreshedWeeks.find((period) => (
      period.actualPeriodId === requestedPeriodId
    )) || refreshedWeeks[0]
    const latestId = refreshedPeriod?.actualPeriodId

    const detailQueries = periodQueries.filter((queryResult) => queryResult.refetch)
    await Promise.all(detailQueries.map((queryResult) => queryResult.refetch()))

    if (latestId && !detailQueries.length) {
      await queryClient.fetchQuery({
        queryKey: getPeriodQueryKey(latestId),
        queryFn: () => actualOvertimeApi.getPeriod(latestId),
      })
    }
  }

  const visiblePeriodsLoading = periodQueries.some((queryResult) => queryResult.isLoading)
  const visiblePeriodsFetching = periodQueries.some((queryResult) => queryResult.isFetching)
  const failedPeriodQuery = periodQueries.find((queryResult) => queryResult.isError)

  if (periodsQuery.isLoading || (recentPeriod && visiblePeriodsLoading)) {
    return (
      <main className="employee-main actual-overtime-page">
        <span className="actual-overtime-visually-hidden" role="status">Loading recent actual overtime...</span>
        <ActualOvertimeSkeleton />
      </main>
    )
  }

  if (periodsQuery.isError) {
    return (
      <main className="employee-main actual-overtime-page">
        <EmptyActualOvertime error={periodsQuery.error} onRetry={() => periodsQuery.refetch()} />
      </main>
    )
  }

  if (!recentPeriod) {
    return (
      <main className="employee-main actual-overtime-page">
        <EmptyActualOvertime />
      </main>
    )
  }

  if (failedPeriodQuery) {
    return (
      <main className="employee-main actual-overtime-page">
        <EmptyActualOvertime
          error={failedPeriodQuery.error}
          onRetry={() => periodQueries.forEach((queryResult) => queryResult.refetch())}
        />
      </main>
    )
  }

  return (
    <main className="employee-main actual-overtime-page">
      <section className="actual-period-toolbar" aria-label="Weekly actual overtime period">
        <div>
          <button
            aria-label="Previous actual overtime week"
            disabled={!previousWeek}
            onClick={() => selectWeek(previousWeek)}
            title="Previous week"
            type="button"
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <CalendarCheck2 size={18} aria-hidden="true" />
          <span><small>Selected week</small><strong>{formatDate(actualPeriod.periodStartDate, { short: true })} - {formatDate(actualPeriod.periodEndDate, { short: true })}</strong></span>
          <button
            aria-label="Next actual overtime week"
            disabled={!nextWeek}
            onClick={() => selectWeek(nextWeek)}
            title="Next week"
            type="button"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
        <dl>
          <div><dt>Department</dt><dd>{actualPeriod.departmentName || actualPeriod.departmentId}</dd></div>
          <div><dt>Period</dt><dd>{actualPeriod.periodType}</dd></div>
          <div><dt>Status</dt><dd><span className={`actual-period-status actual-period-status--${actualPeriod.status}`}>{actualPeriod.status}</span></dd></div>
        </dl>
        <button
          aria-label="Refresh actual overtime"
          disabled={periodsQuery.isFetching || visiblePeriodsFetching}
          onClick={refreshActualOvertime}
          title="Refresh"
          type="button"
        >
          <RefreshCw className={periodsQuery.isFetching || visiblePeriodsFetching ? 'actual-overtime-spin' : ''} size={16} aria-hidden="true" />
        </button>
      </section>

      <section className="actual-overtime-summary" aria-label="Actual overtime totals">
        <div><CalendarDays size={17} aria-hidden="true" /><span><small>Week entries</small><strong>{weeklyEntries.length}</strong></span></div>
        <div><Clock3 size={17} aria-hidden="true" /><span><small>Planned hours</small><strong>{formatHours(displayedPlannedHours)}</strong></span></div>
        <div><CheckCircle2 size={17} aria-hidden="true" /><span><small>Actual hours</small><strong>{formatHours(displayedActualHours)}</strong></span></div>
        <div className={`actual-overtime-summary__variance actual-overtime-summary__variance--${getVarianceTone(totalVariance)}`}><FileClock size={17} aria-hidden="true" /><span><small>Variance</small><strong>{formatVariance(totalVariance)}</strong></span></div>
      </section>

      <div className="actual-overtime-layout">
        <section className="actual-calendar" aria-labelledby="actual-calendar-heading">
          <header>
            <div className="actual-calendar__title">
              <span className="actual-calendar__title-icon"><CalendarDays size={20} aria-hidden="true" /></span>
              <span className="actual-calendar__title-copy">
                <small className="actual-calendar__eyebrow">Actual schedule</small>
                <h1 id="actual-calendar-heading">{formatMonth(calendarMonth)}</h1>
                <small>{calendarEntries.length} entries across {visibleActualPeriods.length} weekly Actual OT {visibleActualPeriods.length === 1 ? 'period' : 'periods'}</small>
              </span>
            </div>
          </header>

          <div className="actual-calendar__scroll">
            <div className="actual-calendar__grid">
              {WEEK_DAYS.map((day) => <span className="actual-calendar__weekday" key={day}>{day}</span>)}
              {calendarDays.map((date) => {
                const dateValue = toDateValue(date)
                const dateEntries = entriesByDate.get(dateValue) || []
                const plannedHours = dateEntries.reduce(
                  (sum, entry) => sum + (Number(entry.plannedHours) || 0),
                  0,
                )
                const actualHours = dateEntries.reduce((sum, entry) => (
                  sum + getDisplayedActualHours(entry, entry.periodStatus, todayValue)
                ), 0)
                const hasPendingEntry = dateEntries.some((entry) => (
                  isPendingEntry(entry, entry.periodStatus, todayValue)
                ))
                const variance = hasPendingEntry ? 0 : actualHours - plannedHours
                const outsideMonth = date.getMonth() !== parseDate(calendarMonth).getMonth()
                const outsidePeriod = !visiblePeriods.some((period) => (
                  dateValue >= period.periodStartDate && dateValue <= period.periodEndDate
                ))
                const isSelectedWeek = dateValue >= actualPeriod.periodStartDate
                  && dateValue <= actualPeriod.periodEndDate
                const isToday = dateValue === todayValue
                const isSelected = dateEntries.some((entry) => entry.actualEntryId === selectedEntry?.actualEntryId)

                return (
                  <button
                    aria-label={dateEntries.length
                      ? `${formatDate(dateValue, { weekday: true, short: true })}: ${hasPendingEntry ? 'actual overtime pending' : `${formatHours(actualHours)} actual hours`}, ${formatHours(plannedHours)} planned hours`
                      : formatDate(dateValue, { weekday: true, short: true })}
                    className={[
                      'actual-calendar__day',
                      outsideMonth ? 'actual-calendar__day--outside-month' : '',
                      outsidePeriod ? 'actual-calendar__day--outside-period' : '',
                      dateEntries.length ? 'actual-calendar__day--has-entry' : '',
                      hasPendingEntry ? 'actual-calendar__day--pending' : '',
                      isSelectedWeek ? 'actual-calendar__day--selected-week' : '',
                      isToday ? 'actual-calendar__day--today' : '',
                      isSelected ? 'actual-calendar__day--selected' : '',
                    ].filter(Boolean).join(' ')}
                    disabled={!dateEntries.length}
                    key={dateValue}
                    onClick={() => selectDate(dateEntries)}
                    type="button"
                  >
                    <span className="actual-calendar__date-row">
                      <span className="actual-calendar__date">{date.getDate()}</span>
                      {isToday ? <span className="actual-calendar__today-label">Today</span> : null}
                    </span>
                    {dateEntries.length ? (
                      <span className="actual-calendar__hours">
                        <strong>{hasPendingEntry ? 'Awaiting actual' : `${formatHours(actualHours)}h actual`}</strong>
                        <small>{formatHours(plannedHours)}h planned</small>
                        <i className={hasPendingEntry ? 'is-pending' : `is-${getVarianceTone(variance)}`}>
                          {hasPendingEntry ? 'Pending' : `${formatVariance(variance)}h`}
                        </i>
                      </span>
                    ) : isToday ? (
                      <span className="actual-calendar__hours actual-calendar__hours--empty">
                        <strong>0h actual</strong>
                        <small>No OT entry</small>
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>

          <footer className="actual-calendar__legend" aria-label="Actual overtime calendar legend">
            <span className="actual-calendar__legend-item actual-calendar__legend-item--today">Today</span>
            <span className="actual-calendar__legend-item actual-calendar__legend-item--selected-week">Selected week</span>
            <span className="actual-calendar__legend-item actual-calendar__legend-item--entry">Other Actual OT</span>
            <span className="actual-calendar__legend-item actual-calendar__legend-item--outside">No Actual OT period</span>
          </footer>
        </section>

        <section className="actual-entry-detail" aria-label="Selected actual overtime entry">
          {selectedEntry ? (
            <>
              <header>
                <div>
                  <CalendarCheck2 size={17} aria-hidden="true" />
                  <span><small>Selected date</small><strong>{formatDate(selectedEntry.actualDate, { weekday: true, short: true })}</strong></span>
                </div>
                <span className={`actual-entry-detail__variance actual-entry-detail__variance--${getVarianceTone(selectedVariance)}`}>{selectedIsPending ? 'Pending' : `${formatVariance(selectedVariance)}h`}</span>
              </header>
              <div className="actual-entry-detail__body">
                <section className="actual-entry-overview" aria-label="Actual overtime details">
                  <dl>
                    <div><dt>Planned hours</dt><dd>{formatHours(selectedEntry.plannedHours)}h</dd></div>
                    <div><dt>Actual hours</dt><dd>{selectedIsPending ? 'Pending' : `${formatHours(selectedActualHours)}h`}</dd></div>
                  </dl>
                  <div className="actual-entry-detail__reason">
                    <small>Planned reason</small>
                    <p>{selectedEntry.plannedReason}</p>
                  </div>
                  {selectedEntry.lastAdjustmentRemarks ? (
                    <div className="actual-entry-detail__adjustment">
                      <small>Latest adjustment</small>
                      <p>{selectedEntry.lastAdjustmentRemarks}</p>
                      <span>{selectedEntry.lastUpdatedByName}{selectedEntry.lastUpdatedAt ? ` - ${formatDateTime(selectedEntry.lastUpdatedAt)}` : ''}</span>
                    </div>
                  ) : (
                    <div className="actual-entry-detail__adjustment actual-entry-detail__adjustment--empty">
                      <small>Latest adjustment</small>
                      <p>No adjustment has been recorded.</p>
                    </div>
                  )}
                </section>

                <section className="actual-entry-conversation" aria-label="Actual overtime comments">
                  <header>
                    <div><MessageSquareText size={16} aria-hidden="true" /><strong>Conversation</strong></div>
                    <span>{selectedEntry.comments?.length || 0}</span>
                  </header>
                  <div className="actual-entry-comments" ref={commentsRef}>
                    {selectedEntry.comments?.length ? (
                      <ol aria-live="polite">
                        {selectedEntry.comments.map((entryComment) => {
                          const isOwnComment = entryComment.userId === user?.id

                          return (
                            <li className={isOwnComment ? 'actual-entry-comments__message--own' : ''} key={entryComment.commentId}>
                              <div>
                                <p>{entryComment.remarks}</p>
                                <span>{isOwnComment ? 'You' : entryComment.userName || 'User'} · {formatDateTime(entryComment.createdAt)}</span>
                              </div>
                            </li>
                          )
                        })}
                      </ol>
                    ) : (
                      <div className="actual-entry-comments__empty">
                        <MessageSquareText size={20} aria-hidden="true" />
                        <span>No comments for this entry.</span>
                      </div>
                    )}
                  </div>
                  {actualPeriod.status === 'open' ? (
                    <form className="actual-entry-comment-form" onSubmit={handleCommentSubmit}>
                      <label>
                        <span className="actual-overtime-visually-hidden">Add comment</span>
                        <textarea
                          aria-invalid={Boolean(commentError)}
                          maxLength="1000"
                          onChange={(event) => {
                            setComment(event.target.value)
                            setCommentError('')
                          }}
                          placeholder="Write a comment"
                          rows="2"
                          value={comment}
                        />
                      </label>
                      <button
                        aria-label={commentMutation.isPending ? 'Sending comment' : 'Send comment'}
                        disabled={commentMutation.isPending || !comment.trim()}
                        title="Send comment"
                        type="submit"
                      >
                        {commentMutation.isPending ? <RefreshCw className="actual-overtime-spin" size={16} aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
                      </button>
                      {commentError ? <span className="actual-entry-comment-form__error" role="alert">{commentError}</span> : null}
                    </form>
                  ) : (
                    <div className="actual-entry-detail__finalized"><CheckCircle2 size={14} aria-hidden="true" />Finalized period · conversation is read-only</div>
                  )}
                </section>
              </div>
            </>
          ) : (
            <div className="actual-entry-detail__empty"><CalendarDays size={24} aria-hidden="true" /><strong>No entries in this period</strong></div>
          )}
        </section>
      </div>
    </main>
  )
}
