import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AlertCircle,
  ArrowUpRight,
  BadgeCheck,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock3,
  FileCheck2,
  GitBranch,
  RefreshCw,
  RotateCcw,
  Signature,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { supervisorApi } from '../../../api/supervisorApi.js'
import { formatWeek } from '../utils/weekPeriod.js'
import './supervisorApprovalsPage.css'

const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'returned_for_revision', label: 'Returned' },
  { id: 'approved', label: 'Final approved' },
  { id: 'closed', label: 'Closed' },
]

const HISTORY_PAGE_SIZE = 8

function historyStatusFilter(status) {
  if (status === 'all') return 'returned_for_revision,approved,closed'
  return status
}

function displayStatus(value) {
  const labels = {
    approved: 'Final approved',
    closed: 'Closed',
    pending_approval: 'In review',
    returned_for_revision: 'Returned for revision',
  }
  return labels[value] || String(value || 'Unknown').replaceAll('_', ' ')
}

function displayRole(value) {
  const labels = {
    admin: 'Admin',
    hr: 'HR',
    japanese_management: 'Japanese Management',
    supervisor: 'Supervisor',
  }
  return labels[value] || String(value || '').replaceAll('_', ' ')
}

function formatDateTime(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatCompactDate(value) {
  if (!value) return 'Not recorded'
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function getPlanResolution(plan) {
  if (plan.status === 'returned_for_revision') {
    return {
      actor: plan.rejectedByName,
      date: plan.rejectedAt || plan.updatedAt,
      label: 'Returned',
    }
  }
  if (plan.status === 'closed') {
    return {
      actor: plan.closedByName,
      date: plan.closedAt || plan.updatedAt,
      label: 'Closed',
    }
  }
  return {
    actor: plan.approvedByName,
    date: plan.approvedAt || plan.updatedAt,
    label: 'Approved',
  }
}

function displayHours(value) {
  const hours = Number(value || 0)
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1)
}

function getStepState(step) {
  if (step.status === 'approved') return 'complete'
  if (step.status === 'pending') return 'current'
  if (step.status === 'rejected') return 'returned'
  if (step.status === 'skipped') return 'skipped'
  return 'waiting'
}

function ApprovalStep({ hideRemarks = false, step, isLast }) {
  const state = getStepState(step)
  const StepIcon = state === 'complete'
    ? Check
    : state === 'returned'
      ? RotateCcw
      : state === 'current'
        ? Clock3
        : CircleDot

  return (
    <li className={`approval-timeline__step approval-timeline__step--${state}`}>
      <div className="approval-timeline__rail" aria-hidden="true">
        <span><StepIcon size={14} /></span>
        {!isLast ? <i /> : null}
      </div>
      <div className="approval-timeline__content">
        <div className="approval-timeline__step-heading">
          <div>
            <span>Step {step.stepOrder}</span>
            <strong>{step.stepName || displayRole(step.approverRole)}</strong>
          </div>
          <span className="approval-timeline__step-status">{step.status}</span>
        </div>
        <div className="approval-timeline__meta">
          <span>{step.actedByName || displayRole(step.approverRole)}</span>
          {step.actedAt ? <time dateTime={step.actedAt}>{formatDateTime(step.actedAt)}</time> : null}
        </div>
        {step.signatureFilePath ? (
          <span className="approval-timeline__signature">
            <Signature size={13} aria-hidden="true" /> Signature recorded
          </span>
        ) : null}
        {step.remarks && !hideRemarks ? <p>{step.remarks}</p> : null}
      </div>
    </li>
  )
}

function OngoingApprovalSpotlight({
  detail,
  error,
  index,
  isExpanded,
  isLoading,
  onNext,
  onOpen,
  onPrevious,
  onRetry,
  plan,
  total,
}) {
  const routeListRef = useRef(null)
  const steps = useMemo(() => detail?.approvals || [], [detail?.approvals])
  const completedSteps = steps.filter((step) => step.status === 'approved').length

  useEffect(() => {
    if (isLoading || error) return
    const currentStep = routeListRef.current?.querySelector('.ongoing-approval__route-step--current')
    currentStep?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [error, isLoading, plan?.planId, steps])

  if (!plan) return null

  return (
    <section className="ongoing-approval" aria-labelledby="ongoing-approval-title">
      <div className="ongoing-approval__identity">
        <span className="ongoing-approval__icon"><GitBranch size={18} aria-hidden="true" /></span>
        <div>
          <span id="ongoing-approval-title">Ongoing approval</span>
          <strong>{formatWeek(plan.periodStartDate, plan.periodEndDate)}</strong>
          <small>{plan.departmentName || plan.departmentId} - {displayHours(plan.plannedHours)}h planned</small>
        </div>
      </div>

      <div className={`ongoing-approval__route${isLoading ? ' ongoing-approval__route--loading' : ''}`}>
        <div className="ongoing-approval__route-heading">
          <span>Approval route</span>
          <small>{isLoading ? 'Loading progress' : `${completedSteps} of ${steps.length} completed`}</small>
        </div>
        {isLoading ? (
          <div className="ongoing-approval__route-skeleton"><span /><span /><span /></div>
        ) : error ? (
          <div className="ongoing-approval__route-state" role="alert">
            <AlertCircle size={15} aria-hidden="true" />
            <span>Approval progress could not be loaded.</span>
            <button onClick={onRetry} type="button">Retry</button>
          </div>
        ) : !steps.length ? (
          <div className="ongoing-approval__route-state" role="status">
            <AlertCircle size={15} aria-hidden="true" />
            <span>No approval route is configured for this department plan.</span>
          </div>
        ) : (
          <ol ref={routeListRef}>
            {steps.map((step) => {
              const state = getStepState(step)
              return (
                <li className={`ongoing-approval__route-step ongoing-approval__route-step--${state}`} key={step.approvalId}>
                  <span aria-hidden="true">{state === 'complete' ? <Check size={11} /> : <CircleDot size={11} />}</span>
                  <small>{step.stepName || displayRole(step.approverRole)}</small>
                </li>
              )
            })}
          </ol>
        )}
      </div>

      <div className="ongoing-approval__current">
        <span>Waiting for</span>
        <strong>{displayRole(detail?.currentApproverRole || plan.currentApproverRole) || 'Approver assignment unavailable'}</strong>
        <button onClick={onOpen} type="button">
          {isExpanded ? 'Hide tracking' : 'Open tracking'}
          <ArrowUpRight size={13} aria-hidden="true" />
        </button>
      </div>

      <div className="ongoing-approval__navigation" aria-label="Browse ongoing approvals">
        <span>{index + 1} / {total}</span>
        <div>
          <button
            aria-label="Previous ongoing approval"
            disabled={total < 2}
            onClick={onPrevious}
            title="Previous approval"
            type="button"
          >
            <ChevronLeft size={15} aria-hidden="true" />
          </button>
          <button
            aria-label="Next ongoing approval"
            disabled={total < 2}
            onClick={onNext}
            title="Next approval"
            type="button"
          >
            <ChevronRight size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  )
}

function ApprovalDetail({ detail, isLoading }) {
  if (isLoading) {
    return (
      <section className="approval-detail approval-detail--loading" aria-label="Loading approval details">
        <span /><span /><span /><span />
      </section>
    )
  }

  if (!detail) {
    return (
      <section className="approval-detail approval-detail--empty">
        <FileCheck2 size={25} aria-hidden="true" />
        <strong>Select a department plan</strong>
      </section>
    )
  }

  const totalHours = detail.plannedHours ?? detail.items?.reduce(
    (total, item) => total + Number(item.plannedHours || 0),
    0,
  ) ?? 0
  const approvals = detail.approvals || []
  const returnedStep = [...approvals].reverse().find((step) => step.status === 'rejected')
  const returnDetails = detail.status === 'returned_for_revision'
    ? {
        actor: returnedStep?.actedByName || detail.rejectedByName || 'Approver not recorded',
        date: returnedStep?.actedAt || detail.rejectedAt,
        remarks: returnedStep?.remarks || detail.rejectionReason || detail.remarks || 'No return remarks were provided.',
      }
    : null

  return (
    <section className="approval-detail" aria-label={`Approval progress for ${formatWeek(detail.periodStartDate, detail.periodEndDate)}`}>
      <header>
        <div>
          <span>Approval progress</span>
          <h2>{formatWeek(detail.periodStartDate, detail.periodEndDate)}</h2>
          <p>{detail.departmentName || detail.departmentId}</p>
        </div>
        <span className={`approval-status approval-status--${detail.status}`}>
          {detail.status === 'approved' || detail.status === 'closed'
            ? <BadgeCheck size={14} aria-hidden="true" />
            : detail.status === 'returned_for_revision'
              ? <RotateCcw size={14} aria-hidden="true" />
              : <Clock3 size={14} aria-hidden="true" />}
          {displayStatus(detail.status)}
        </span>
      </header>

      <dl className="approval-detail__summary">
        <div><dt>Entries</dt><dd>{detail.itemCount ?? detail.items?.length ?? 0}</dd></div>
        <div><dt>Planned hours</dt><dd>{displayHours(totalHours)}h</dd></div>
        <div><dt>Submitted</dt><dd>{detail.departmentSubmittedAt ? formatDateTime(detail.departmentSubmittedAt) : '-'}</dd></div>
      </dl>

      {detail.status === 'pending_approval' ? (
        <div className={`approval-detail__current${detail.currentApproverRole ? '' : ' approval-detail__current--warning'}`}>
          <Clock3 size={16} aria-hidden="true" />
          <span>
            <small>Currently waiting for</small>
            <strong>{displayRole(detail.currentApproverRole) || 'Approver assignment unavailable'}</strong>
          </span>
        </div>
      ) : null}

      {returnDetails ? (
        <div className="approval-detail__returned" role="note">
          <RotateCcw size={17} aria-hidden="true" />
          <div>
            <span>Returned by {returnDetails.actor}{returnDetails.date ? ` on ${formatCompactDate(returnDetails.date)}` : ''}</span>
            <p>{returnDetails.remarks}</p>
          </div>
        </div>
      ) : null}

      <div className="approval-detail__timeline-heading">
        <span>Workflow</span>
        <small>{approvals.filter((step) => step.status === 'approved').length} of {approvals.length} completed</small>
      </div>
      {approvals.length ? (
        <ol className="approval-timeline">
          {approvals.map((step, index) => (
            <ApprovalStep
              hideRemarks={Boolean(returnedStep && step.approvalId === returnedStep.approvalId)}
              isLast={index === approvals.length - 1}
              key={step.approvalId}
              step={step}
            />
          ))}
        </ol>
      ) : (
        <div className="approval-detail__workflow-empty" role="status">
          <AlertCircle size={17} aria-hidden="true" />
          <span>Approval workflow information is unavailable for this plan.</span>
        </div>
      )}

      <Link to={`/supervisor/department-plans/${encodeURIComponent(detail.planId)}`}>
        View department plan
        <ArrowUpRight size={15} aria-hidden="true" />
      </Link>
    </section>
  )
}

export function SupervisorApprovalsPage() {
  const [activeStatus, setActiveStatus] = useState('all')
  const [historyPage, setHistoryPage] = useState(0)
  const [isOngoingDetailOpen, setIsOngoingDetailOpen] = useState(false)
  const [ongoingIndex, setOngoingIndex] = useState(0)
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const ongoingPlansQuery = useQuery({
    queryKey: ['supervisor', 'department-approval-plans', 'ongoing'],
    queryFn: () => supervisorApi.listDepartmentApprovalPlans({
      limit: 100,
      status: 'pending_approval',
    }),
  })
  const ongoingPlans = useMemo(
    () => (ongoingPlansQuery.data || []).filter((plan) => plan.status === 'pending_approval'),
    [ongoingPlansQuery.data],
  )
  const visibleOngoingIndex = Math.min(ongoingIndex, Math.max(ongoingPlans.length - 1, 0))
  const ongoingPlan = ongoingPlans[visibleOngoingIndex]
  const ongoingDetailQuery = useQuery({
    queryKey: ['supervisor', 'department-approval', ongoingPlan?.planId || ''],
    queryFn: () => supervisorApi.getDepartmentApprovalDetails(ongoingPlan.planId),
    enabled: Boolean(ongoingPlan),
  })
  const historyQuery = useQuery({
    queryKey: ['supervisor', 'department-approval-plans', 'history', activeStatus, historyPage],
    queryFn: async () => {
      const plans = await supervisorApi.listDepartmentApprovalPlans({
        limit: HISTORY_PAGE_SIZE + 1,
        offset: historyPage * HISTORY_PAGE_SIZE,
        status: historyStatusFilter(activeStatus),
      })
      const historyPlans = plans.filter((plan) => plan.status !== 'pending_approval')
      return {
        hasNextPage: historyPlans.length > HISTORY_PAGE_SIZE,
        plans: historyPlans.slice(0, HISTORY_PAGE_SIZE),
      }
    },
  })
  const historyPlans = useMemo(() => historyQuery.data?.plans || [], [historyQuery.data])

  useEffect(() => {
    if (!historyPlans.some((plan) => plan.planId === selectedPlanId)) {
      setSelectedPlanId(historyPlans[0]?.planId || '')
    }
  }, [historyPlans, selectedPlanId])

  const detailQuery = useQuery({
    queryKey: ['supervisor', 'department-approval', selectedPlanId],
    queryFn: () => supervisorApi.getDepartmentApprovalDetails(selectedPlanId),
    enabled: Boolean(selectedPlanId),
  })
  const isRefreshing = ongoingPlansQuery.isFetching
    || ongoingDetailQuery.isFetching
    || historyQuery.isFetching
    || detailQuery.isFetching

  async function refreshApprovals() {
    const requests = [ongoingPlansQuery.refetch(), historyQuery.refetch()]
    if (selectedPlanId) requests.push(detailQuery.refetch())
    if (ongoingPlan) requests.push(ongoingDetailQuery.refetch())
    await Promise.all(requests)
  }

  function moveOngoing(direction) {
    setOngoingIndex((current) => {
      if (ongoingPlans.length < 2) return 0
      return (current + direction + ongoingPlans.length) % ongoingPlans.length
    })
  }

  function openOngoingTracking() {
    setIsOngoingDetailOpen((current) => !current)
  }

  function selectStatus(status) {
    setActiveStatus(status)
    setHistoryPage(0)
    setSelectedPlanId('')
  }

  function changeHistoryPage(nextPage) {
    setHistoryPage(nextPage)
    setSelectedPlanId('')
  }

  return (
    <main className="supervisor-main supervisor-approvals-page">
      <header className="supervisor-approvals__header">
        <div>
          <h1>Approvals</h1>
          <p>Submitted department overtime plans</p>
        </div>
        <button
          aria-label="Refresh approval tracking"
          disabled={isRefreshing}
          onClick={refreshApprovals}
          title="Refresh"
          type="button"
        >
          <RefreshCw className={isRefreshing ? 'supervisor-approvals__spin' : ''} size={16} aria-hidden="true" />
        </button>
      </header>

      {ongoingPlansQuery.isLoading ? (
        <section className="ongoing-approval ongoing-approval--loading" aria-label="Loading ongoing approvals">
          <span /><span /><span />
        </section>
      ) : ongoingPlansQuery.isError ? (
        <section className="ongoing-approval ongoing-approval--message" role="alert">
          <AlertCircle size={20} aria-hidden="true" />
          <div><strong>Unable to load ongoing approvals</strong><span>{ongoingPlansQuery.error.message}</span></div>
          <button onClick={() => ongoingPlansQuery.refetch()} type="button">Retry</button>
        </section>
      ) : ongoingPlan ? (
        <OngoingApprovalSpotlight
          detail={ongoingDetailQuery.data}
          error={ongoingDetailQuery.error}
          index={visibleOngoingIndex}
          isExpanded={isOngoingDetailOpen}
          isLoading={ongoingDetailQuery.isLoading}
          key={ongoingPlan.planId}
          onNext={() => moveOngoing(1)}
          onOpen={openOngoingTracking}
          onPrevious={() => moveOngoing(-1)}
          onRetry={() => ongoingDetailQuery.refetch()}
          plan={ongoingPlan}
          total={ongoingPlans.length}
        />
      ) : (
        <section className="ongoing-approval ongoing-approval--message" aria-label="Ongoing approvals">
          <BadgeCheck size={20} aria-hidden="true" />
          <div><strong>No department plans currently in review</strong><span>New submissions will appear here automatically after refresh.</span></div>
        </section>
      )}

      {ongoingPlan && isOngoingDetailOpen ? (
        <div className="ongoing-approval__expanded">
          {ongoingDetailQuery.isError ? (
            <section className="approval-detail approval-detail--empty" role="alert">
              <AlertCircle size={24} aria-hidden="true" />
              <strong>Unable to load ongoing approval details</strong>
              <button onClick={() => ongoingDetailQuery.refetch()} type="button">Retry</button>
            </section>
          ) : (
            <ApprovalDetail detail={ongoingDetailQuery.data} isLoading={ongoingDetailQuery.isLoading} />
          )}
        </div>
      ) : null}

      <div className="supervisor-approvals__history-toolbar">
        <div>
          <strong>Approval history</strong>
          <span>Completed and returned department plans</span>
        </div>
        <div className="supervisor-approvals__filters" role="group" aria-label="Filter approval history">
          {STATUS_FILTERS.map((filter) => (
            <button
              aria-pressed={activeStatus === filter.id}
              key={filter.id}
              onClick={() => selectStatus(filter.id)}
              type="button"
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {historyQuery.isError ? (
        <div className="supervisor-approvals__state supervisor-approvals__state--error" role="alert">
          <AlertCircle size={22} aria-hidden="true" />
          <div><strong>Unable to load approval history</strong><span>{historyQuery.error.message}</span></div>
          <button onClick={() => historyQuery.refetch()} type="button">Retry</button>
        </div>
      ) : null}

      {historyQuery.isLoading ? (
        <div className="supervisor-approvals__layout" aria-label="Loading submitted plans">
          <div className="approval-list approval-list--loading"><span /><span /><span /></div>
          <ApprovalDetail isLoading />
        </div>
      ) : null}

      {historyQuery.isSuccess && !historyPlans.length ? (
        <div className="supervisor-approvals__state">
          <FileCheck2 size={25} aria-hidden="true" />
          <strong>No approval history in this status</strong>
        </div>
      ) : null}

      {historyPlans.length ? (
        <div className="supervisor-approvals__layout">
          <section className="approval-list" aria-label="Department approval history">
            <header>
              <span>Approval history</span>
              <strong>{historyPlans.length}</strong>
            </header>
            <div>
              {historyPlans.map((plan) => {
                const resolution = getPlanResolution(plan)
                return (
                  <button
                    aria-pressed={selectedPlanId === plan.planId}
                    key={plan.planId}
                    onClick={() => setSelectedPlanId(plan.planId)}
                    type="button"
                  >
                    <span className={`approval-list__icon approval-list__icon--${plan.status}`}>
                      {plan.status === 'approved' || plan.status === 'closed'
                        ? <BadgeCheck size={16} aria-hidden="true" />
                        : plan.status === 'returned_for_revision'
                          ? <RotateCcw size={16} aria-hidden="true" />
                          : <CalendarDays size={16} aria-hidden="true" />}
                    </span>
                    <span className="approval-list__copy">
                      <strong>{formatWeek(plan.periodStartDate, plan.periodEndDate)}</strong>
                      <small>{plan.departmentName || plan.departmentId}</small>
                      <small>{plan.employeeCount || 0} employees - {plan.itemCount || 0} entries</small>
                    </span>
                    <span className="approval-list__numbers">
                      <strong>{displayHours(plan.plannedHours)}h</strong>
                      <small>{displayStatus(plan.status)}</small>
                    </span>
                    <span className="approval-list__activity">
                      <small>Submitted {formatCompactDate(plan.departmentSubmittedAt || plan.submittedAt)}</small>
                      <small title={resolution.actor || undefined}>
                        {resolution.label} {formatCompactDate(resolution.date)}{resolution.actor ? ` by ${resolution.actor}` : ''}
                      </small>
                    </span>
                  </button>
                )
              })}
            </div>
            <footer className="approval-list__pagination" aria-label="Approval history pages">
              <span>Page {historyPage + 1}</span>
              <div>
                <button
                  aria-label="Previous approval history page"
                  disabled={historyPage === 0 || historyQuery.isFetching}
                  onClick={() => changeHistoryPage(historyPage - 1)}
                  type="button"
                >
                  <ChevronLeft size={15} aria-hidden="true" />
                </button>
                <button
                  aria-label="Next approval history page"
                  disabled={!historyQuery.data?.hasNextPage || historyQuery.isFetching}
                  onClick={() => changeHistoryPage(historyPage + 1)}
                  type="button"
                >
                  <ChevronRight size={15} aria-hidden="true" />
                </button>
              </div>
            </footer>
          </section>

          {detailQuery.isError ? (
            <section className="approval-detail approval-detail--empty" role="alert">
              <AlertCircle size={24} aria-hidden="true" />
              <strong>Unable to load approval details</strong>
              <button onClick={() => detailQuery.refetch()} type="button">Retry</button>
            </section>
          ) : (
            <ApprovalDetail detail={detailQuery.data} isLoading={detailQuery.isLoading} />
          )}
        </div>
      ) : null}
    </main>
  )
}
