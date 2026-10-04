import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  AlertCircle,
  CalendarCheck2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  FileClock,
  RefreshCw,
  RotateCcw,
  UsersRound,
} from 'lucide-react'
import { actualOvertimeApi } from '../../../api/actualOvertimeApi.js'
import { supervisorApi } from '../../../api/supervisorApi.js'
import { useToast } from '../../../components/shared/toast/useToast.js'
import { useAuth } from '../../auth/useAuth.js'
import { SupervisorActualEntryWorkspace } from '../components/SupervisorActualEntryWorkspace.jsx'
import { SupervisorActualRecordsList } from '../components/SupervisorActualRecordsList.jsx'
import { SupervisorActualWeekMatrix } from '../components/SupervisorActualWeekMatrix.jsx'
import {
  formatDateTime,
  formatHours,
  formatPeriod,
  formatVariance,
  getVarianceTone,
} from '../utils/actualOvertimeView.js'
import { getPeriodDays, toDateValue } from '../utils/weekPeriod.js'
import './supervisorActualOvertimePage.css'

const PERIODS_QUERY_KEY = ['supervisor', 'actual-overtime', 'periods']

function triggerDocumentDownload(finalDocument) {
  const objectUrl = URL.createObjectURL(finalDocument.blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = finalDocument.fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(objectUrl)
}

function ActualOvertimeLoading() {
  return (
    <div className="supervisor-actual-loading" aria-label="Loading actual overtime" role="status">
      <i /><span /><span /><span />
    </div>
  )
}

export function SupervisorActualOvertimePage() {
  const todayValue = useMemo(() => toDateValue(new Date()), [])
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedPeriodId, setSelectedPeriodId] = useState('')
  const [selectedEntryId, setSelectedEntryId] = useState('')
  const [weekIndex, setWeekIndex] = useState(0)
  const toast = useToast()
  const { user } = useAuth()
  const periodsQuery = useQuery({
    queryKey: PERIODS_QUERY_KEY,
    queryFn: () => actualOvertimeApi.listMyPeriods(),
  })
  const periods = useMemo(() => (
    [...(periodsQuery.data || [])].sort((left, right) => (
      right.periodStartDate.localeCompare(left.periodStartDate)
    ))
  ), [periodsQuery.data])
  const ongoingPeriod = periods.find((period) => (
    period.status === 'open'
      && period.periodStartDate <= todayValue
      && period.periodEndDate >= todayValue
  )) || null
  const recordPeriods = useMemo(() => periods.filter((period) => (
    period.actualPeriodId !== ongoingPeriod?.actualPeriodId
  )), [ongoingPeriod?.actualPeriodId, periods])
  const filteredRecordPeriods = useMemo(() => (
    statusFilter === 'all'
      ? recordPeriods
      : recordPeriods.filter((period) => period.status === statusFilter)
  ), [recordPeriods, statusFilter])

  useEffect(() => {
    if (!periods.some((period) => period.actualPeriodId === selectedPeriodId)) {
      setSelectedPeriodId(ongoingPeriod?.actualPeriodId || periods[0]?.actualPeriodId || '')
    }
  }, [ongoingPeriod?.actualPeriodId, periods, selectedPeriodId])

  const periodQueryKey = ['supervisor', 'actual-overtime', 'period', selectedPeriodId]
  const periodQuery = useQuery({
    queryKey: periodQueryKey,
    queryFn: () => actualOvertimeApi.getPeriod(selectedPeriodId),
    enabled: Boolean(selectedPeriodId),
  })
  const period = periodQuery.data
  const entries = useMemo(() => period?.entries || [], [period?.entries])
  const periodDays = useMemo(() => (
    period ? getPeriodDays(period.periodStartDate, period.periodEndDate) : []
  ), [period])
  const weekCount = Math.max(1, Math.ceil(periodDays.length / 7))
  const visibleDays = useMemo(() => (
    periodDays.slice(weekIndex * 7, (weekIndex + 1) * 7)
  ), [periodDays, weekIndex])
  const visibleEntries = useMemo(() => {
    if (!visibleDays.length) return []
    return entries.filter((entry) => (
      entry.actualDate >= visibleDays[0].date
        && entry.actualDate <= visibleDays[visibleDays.length - 1].date
    ))
  }, [entries, visibleDays])

  useEffect(() => {
    if (!periodDays.length) return
    const todayIndex = periodDays.findIndex((day) => day.date === todayValue)
    setWeekIndex(todayIndex >= 0 ? Math.floor(todayIndex / 7) : 0)
  }, [period?.actualPeriodId, periodDays, todayValue])

  useEffect(() => {
    if (!visibleEntries.some((entry) => entry.actualEntryId === selectedEntryId)) {
      setSelectedEntryId(visibleEntries[0]?.actualEntryId || '')
    }
  }, [selectedEntryId, visibleEntries])

  const selectedEntry = visibleEntries.find((entry) => entry.actualEntryId === selectedEntryId) || null
  const signatureQuery = useQuery({
    queryKey: ['supervisor', 'actual-overtime', 'signatures', selectedPeriodId],
    queryFn: () => supervisorApi.getDepartmentPreparation({
      periodType: period.periodType,
      periodStartDate: period.periodStartDate,
      periodEndDate: period.periodEndDate,
    }),
    enabled: Boolean(period),
  })
  const signaturesByEmployee = useMemo(() => new Map(
    (signatureQuery.data?.employees || []).map((employee) => [
      employee.employeeId,
      employee.plan?.signature || null,
    ]),
  ), [signatureQuery.data?.employees])
  const employeeCount = new Set(entries.map((entry) => entry.employeeId)).size
  const plannedHours = entries.reduce((total, entry) => total + Number(entry.plannedHours || 0), 0)
  const actualHours = entries.reduce((total, entry) => total + Number(entry.actualHours || 0), 0)
  const variance = actualHours - plannedHours
  const pendingEntries = entries.filter((entry) => entry.isPending).length
  const downloadMutation = useMutation({
    mutationFn: () => actualOvertimeApi.getFinalDocument(period.actualPeriodId),
    onSuccess: (finalDocument) => {
      triggerDocumentDownload(finalDocument)
      toast.success('Final Actual OT document download started.')
    },
    onError: (error) => toast.error(error.message),
  })

  function selectPeriod(actualPeriodId) {
    setSelectedPeriodId(actualPeriodId)
    setSelectedEntryId('')
    setWeekIndex(0)
  }

  async function refreshWorkspace() {
    const requests = [periodsQuery.refetch()]
    if (selectedPeriodId) requests.push(periodQuery.refetch())
    if (period) requests.push(signatureQuery.refetch())
    await Promise.all(requests)
  }

  if (periodsQuery.isLoading) {
    return <main className="supervisor-main supervisor-actual-page"><ActualOvertimeLoading /></main>
  }

  if (periodsQuery.isError) {
    return (
      <main className="supervisor-main supervisor-actual-page">
        <section className="supervisor-actual-state" role="alert">
          <AlertCircle size={25} aria-hidden="true" />
          <div><strong>Unable to load actual overtime</strong><span>{periodsQuery.error.message}</span></div>
          <button onClick={() => periodsQuery.refetch()} type="button">Retry</button>
        </section>
      </main>
    )
  }

  return (
    <main className="supervisor-main supervisor-actual-page">
      <header className="supervisor-actual-page__header">
        <div><span>Department review</span><h1>Actual overtime</h1><p>Weekly employee actual hours, adjustments, and comments</p></div>
        <button aria-label="Refresh actual overtime" disabled={periodsQuery.isFetching || periodQuery.isFetching} onClick={refreshWorkspace} title="Refresh" type="button">
          <RefreshCw className={periodsQuery.isFetching || periodQuery.isFetching ? 'is-spinning' : ''} size={16} aria-hidden="true" />
        </button>
      </header>

      {!periods.length ? (
        <section className="supervisor-actual-state"><FileClock size={26} aria-hidden="true" /><div><strong>No Actual OT periods available</strong><span>Periods appear after a department overtime plan receives final approval.</span></div></section>
      ) : (
        <>
          <section className={`supervisor-actual-ongoing${ongoingPeriod ? '' : ' supervisor-actual-ongoing--empty'}`} aria-label="Ongoing actual overtime today">
            <div className="supervisor-actual-ongoing__icon"><CalendarCheck2 size={18} aria-hidden="true" /></div>
            {ongoingPeriod ? (
              <>
                <div className="supervisor-actual-ongoing__copy"><span>Ongoing today</span><strong>{formatPeriod(ongoingPeriod)}</strong><small>{ongoingPeriod.departmentName || ongoingPeriod.departmentId}</small></div>
                <dl><div><dt>Entries</dt><dd>{ongoingPeriod.entryCount}</dd></div><div><dt>Planned</dt><dd>{formatHours(ongoingPeriod.plannedHours)}h</dd></div><div><dt>Actual</dt><dd>{formatHours(ongoingPeriod.actualHours)}h</dd></div></dl>
                <button disabled={selectedPeriodId === ongoingPeriod.actualPeriodId} onClick={() => selectPeriod(ongoingPeriod.actualPeriodId)} type="button">
                  {selectedPeriodId === ongoingPeriod.actualPeriodId ? 'Workspace open' : 'Open workspace'}
                </button>
              </>
            ) : (
              <div className="supervisor-actual-ongoing__copy"><span>Ongoing today</span><strong>No active Actual OT period today</strong><small>Use the records below to open another period.</small></div>
            )}
          </section>

          <section className="supervisor-actual-detail" aria-label="Selected actual overtime period">
            {selectedPeriodId && periodQuery.isLoading ? <div className="supervisor-actual-detail__loading" aria-label="Loading actual overtime period" role="status"><i /><span /><span /><span /></div> : null}
            {selectedPeriodId && periodQuery.isError ? (
              <div className="supervisor-actual-state" role="alert"><AlertCircle size={23} aria-hidden="true" /><div><strong>Unable to open this period</strong><span>{periodQuery.error.message}</span></div><button onClick={() => periodQuery.refetch()} type="button">Retry</button></div>
            ) : null}

            {period ? (
              <>
                <header className="supervisor-actual-detail__header">
                  <div><span>Selected actual period</span><h2>{formatPeriod(period)}</h2><p>{period.departmentName || period.departmentId}</p></div>
                  <div>
                    <span className={`supervisor-actual-status supervisor-actual-status--${period.status}`}>{period.status === 'finalized' ? <CheckCircle2 size={14} aria-hidden="true" /> : <Clock3 size={14} aria-hidden="true" />}{period.status}</span>
                    {ongoingPeriod && selectedPeriodId !== ongoingPeriod.actualPeriodId ? <button className="supervisor-actual-current" onClick={() => selectPeriod(ongoingPeriod.actualPeriodId)} type="button"><RotateCcw size={13} aria-hidden="true" />Return to ongoing</button> : null}
                    {period.status === 'finalized' ? <button className="supervisor-actual-download" disabled={downloadMutation.isPending} onClick={() => downloadMutation.mutate()} type="button"><Download size={14} aria-hidden="true" />{downloadMutation.isPending ? 'Preparing...' : 'Download final document'}</button> : null}
                  </div>
                </header>

                {period.status === 'finalized' ? <div className="supervisor-actual-finalized"><CheckCircle2 size={16} aria-hidden="true" /><span><strong>Finalized by {period.finalizedByName || 'Admin/HR'}</strong><small>{formatDateTime(period.finalizedAt)}{period.finalizationRemarks ? ` - ${period.finalizationRemarks}` : ''}</small></span></div> : null}

                <dl className="supervisor-actual-summary" aria-label="Actual overtime period totals">
                  <div><dt><UsersRound size={14} aria-hidden="true" /> Employees</dt><dd>{employeeCount}</dd></div>
                  <div><dt><FileClock size={14} aria-hidden="true" /> Entries</dt><dd>{entries.length}</dd></div>
                  <div><dt>Planned hours</dt><dd>{formatHours(plannedHours)}h</dd></div>
                  <div><dt>Actual hours</dt><dd>{formatHours(actualHours)}h</dd></div>
                  <div className={`is-${getVarianceTone(variance)}`}><dt>Variance</dt><dd>{formatVariance(variance)}h</dd></div>
                  <div><dt>Pending entries</dt><dd>{pendingEntries}</dd></div>
                </dl>

                <div className="supervisor-actual-workspace">
                  <section className="supervisor-actual-calendar" aria-labelledby="supervisor-actual-calendar-title">
                    <header>
                      <div><CalendarCheck2 size={16} aria-hidden="true" /><span><strong id="supervisor-actual-calendar-title">Employee weekly actual hours</strong><small>{visibleDays.length ? `${visibleDays[0].date} - ${visibleDays[visibleDays.length - 1].date}` : 'No week available'}</small></span></div>
                      <div>
                        <span>Week {weekIndex + 1} of {weekCount}</span>
                        <button aria-label="Previous week" disabled={weekIndex === 0} onClick={() => setWeekIndex((current) => current - 1)} type="button"><ChevronLeft size={14} aria-hidden="true" /></button>
                        <button aria-label="Next week" disabled={weekIndex >= weekCount - 1} onClick={() => setWeekIndex((current) => current + 1)} type="button"><ChevronRight size={14} aria-hidden="true" /></button>
                      </div>
                    </header>
                    {visibleEntries.length ? (
                      <SupervisorActualWeekMatrix days={visibleDays} entries={visibleEntries} onSelectEntry={setSelectedEntryId} selectedEntryId={selectedEntryId} signaturesByEmployee={signaturesByEmployee} />
                    ) : <div className="supervisor-actual-calendar__empty">No employee Actual OT entries in this week.</div>}
                    {signatureQuery.isError ? <p className="supervisor-actual-calendar__signature-error">Employee signatures could not be loaded. Refresh to retry.</p> : null}
                  </section>

                  <aside className="supervisor-actual-entry-panel" aria-label="Selected entry comments and adjustment">
                    {selectedEntry ? <SupervisorActualEntryWorkspace entry={selectedEntry} period={period} userId={user?.id} /> : <div className="supervisor-actual-detail__empty"><FileClock size={21} aria-hidden="true" /><span>Select an employee day to review and comment.</span></div>}
                  </aside>
                </div>
              </>
            ) : null}
          </section>

          <SupervisorActualRecordsList
            activeFilter={statusFilter}
            allPeriods={recordPeriods}
            onFilterChange={setStatusFilter}
            onSelect={selectPeriod}
            periods={filteredRecordPeriods}
            selectedPeriodId={selectedPeriodId}
          />
        </>
      )}
    </main>
  )
}
