import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Circle,
  CircleDot,
  ClipboardCheck,
  Clock3,
  FileClock,
  History,
  PencilLine,
  RefreshCw,
  SendHorizontal,
  Trash2,
  TriangleAlert,
  Undo2,
  X,
} from 'lucide-react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { overtimePlanApi } from '../../../api/overtimePlanApi.js'
import { useToast } from '../../../components/shared/toast/useToast.js'
import './employeePlanDetail.css'

const EDITABLE_STATUSES = ['draft', 'supervisor_returned', 'returned_for_revision']
const DELETABLE_STATUSES = ['draft', 'rejected', 'supervisor_returned', 'returned_for_revision']

function formatDate(value) {
  if (!value) return 'Not provided'

  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function formatDateTime(value) {
  if (!value) return 'Not provided'

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

function formatLabel(value) {
  if (!value) return 'Not provided'
  return value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}

function DetailField({ label, value }) {
  return (
    <div className="plan-detail-field">
      <dt>{label}</dt>
      <dd>{value || 'Not provided'}</dd>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="plan-detail-skeleton" aria-hidden="true">
      <section><span /><span /><span /><span /></section>
      <section><span /><span /><span /><span /><span /></section>
      <section><span /><span /><span /></section>
    </div>
  )
}

function WorkflowProgress({ progress }) {
  if (!progress?.stages?.length) return null

  return (
    <section className="plan-detail-section plan-workflow" aria-labelledby="plan-workflow-title">
      <div className="plan-detail-section__heading">
        <ClipboardCheck size={19} aria-hidden="true" />
        <h2 id="plan-workflow-title">Workflow progress</h2>
      </div>
      <ol className="plan-workflow__steps">
        {progress.stages.map((stage) => {
          const StageIcon = stage.state === 'completed'
            ? CheckCircle2
            : stage.state === 'current'
              ? Clock3
              : stage.state === 'action_required'
                ? AlertCircle
                : Circle

          return (
            <li className={`plan-workflow__step plan-workflow__step--${stage.state}`} key={stage.key}>
              <span className="plan-workflow__icon" aria-hidden="true">
                <StageIcon size={17} />
              </span>
              <div>
                <strong>{stage.label}</strong>
                <p>{stage.detail}</p>
                {stage.completedAt ? <small>{formatDateTime(stage.completedAt)}</small> : null}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function useDialogLifecycle(isPending, onClose) {
  const confirmButtonRef = useRef(null)
  const closeRef = useRef(onClose)
  const pendingRef = useRef(isPending)
  closeRef.current = onClose
  pendingRef.current = isPending

  useEffect(() => {
    const previousActiveElement = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    confirmButtonRef.current?.focus()

    function handleEscape(event) {
      if (event.key === 'Escape' && !pendingRef.current) closeRef.current()
    }

    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = previousOverflow
      previousActiveElement?.focus?.()
    }
  }, [])

  return confirmButtonRef
}

function SubmitPlanDialog({ error, isSubmitting, onClose, onSubmit, plan }) {
  const [remarks, setRemarks] = useState('')
  const confirmButtonRef = useDialogLifecycle(isSubmitting, onClose)

  return (
    <div
      className="plan-submit-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose()
      }}
      role="presentation"
    >
      <section
        aria-describedby="plan-submit-description"
        aria-labelledby="plan-submit-title"
        aria-modal="true"
        className="plan-submit-dialog"
        role="dialog"
      >
        <header className="plan-submit-dialog__header">
          <span aria-hidden="true"><SendHorizontal size={20} /></span>
          <div>
            <h2 id="plan-submit-title">Sign and submit plan?</h2>
            <p id="plan-submit-description">Review the plan before confirming it with your saved signature.</p>
          </div>
          <button aria-label="Close submission confirmation" disabled={isSubmitting} onClick={onClose} type="button">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="plan-submit-dialog__summary">
          <div><small>Plan period</small><strong>{formatDate(plan.periodStartDate)} to {formatDate(plan.periodEndDate)}</strong></div>
          <div><small>Entries</small><strong>{plan.itemCount ?? plan.items?.length ?? 0}</strong></div>
          <div><small>Total hours</small><strong>{formatHours(plan.plannedHours)}</strong></div>
        </div>

        <div className="plan-submit-dialog__notice">
          <ClipboardCheck size={18} aria-hidden="true" />
          <p><strong>Your saved signature will be attached</strong><span>The signed plan will be sent to your supervisor and editing will be locked unless it is returned.</span></p>
        </div>

        <label className="plan-submit-dialog__remarks">
          <span>Submission remarks <small>Optional</small></span>
          <textarea
            disabled={isSubmitting}
            maxLength="1000"
            onChange={(event) => setRemarks(event.target.value)}
            placeholder="Add a note for your supervisor"
            rows="4"
            value={remarks}
          />
        </label>

        {error ? (
          <div className="plan-submit-dialog__error" role="alert">
            <AlertCircle size={16} aria-hidden="true" />
            <span>{error.message}</span>
          </div>
        ) : null}

        <footer className="plan-submit-dialog__footer">
          <button disabled={isSubmitting} onClick={onClose} type="button">Cancel</button>
          <button
            className="plan-submit-dialog__confirm"
            disabled={isSubmitting}
            onClick={() => onSubmit(remarks)}
            ref={confirmButtonRef}
            type="button"
          >
            {isSubmitting ? <RefreshCw className="plan-submit-spin" size={16} aria-hidden="true" /> : <SendHorizontal size={16} aria-hidden="true" />}
            {isSubmitting ? 'Signing and submitting...' : 'Sign and submit'}
          </button>
        </footer>
      </section>
    </div>
  )
}

function DeletePlanDialog({ error, isDeleting, onClose, onDelete, plan }) {
  const confirmButtonRef = useDialogLifecycle(isDeleting, onClose)

  return (
    <div
      className="plan-submit-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isDeleting) onClose()
      }}
      role="presentation"
    >
      <section
        aria-describedby="plan-delete-description"
        aria-labelledby="plan-delete-title"
        aria-modal="true"
        className="plan-submit-dialog plan-submit-dialog--delete"
        role="dialog"
      >
        <header className="plan-submit-dialog__header plan-submit-dialog__header--danger">
          <span aria-hidden="true"><Trash2 size={20} /></span>
          <div>
            <h2 id="plan-delete-title">Delete overtime plan?</h2>
            <p id="plan-delete-description">This permanently removes the plan and all of its entries.</p>
          </div>
          <button aria-label="Close deletion confirmation" disabled={isDeleting} onClick={onClose} type="button">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="plan-submit-dialog__summary">
          <div><small>Plan period</small><strong>{formatDate(plan.periodStartDate)} to {formatDate(plan.periodEndDate)}</strong></div>
          <div><small>Entries</small><strong>{plan.itemCount ?? plan.items?.length ?? 0}</strong></div>
          <div><small>Total hours</small><strong>{formatHours(plan.plannedHours)}</strong></div>
        </div>

        <div className="plan-submit-dialog__notice plan-submit-dialog__notice--danger">
          <TriangleAlert size={18} aria-hidden="true" />
          <p><strong>This action cannot be undone</strong><span>The plan, its overtime entries, and activity history will no longer be available.</span></p>
        </div>

        {error ? (
          <div className="plan-submit-dialog__error" role="alert">
            <AlertCircle size={16} aria-hidden="true" />
            <span>{error.message}</span>
          </div>
        ) : null}

        <footer className="plan-submit-dialog__footer">
          <button disabled={isDeleting} onClick={onClose} type="button">Cancel</button>
          <button
            className="plan-submit-dialog__confirm plan-submit-dialog__confirm--danger"
            disabled={isDeleting}
            onClick={onDelete}
            ref={confirmButtonRef}
            type="button"
          >
            {isDeleting ? <RefreshCw className="plan-submit-spin" size={16} aria-hidden="true" /> : <Trash2 size={16} aria-hidden="true" />}
            {isDeleting ? 'Deleting plan...' : 'Delete permanently'}
          </button>
        </footer>
      </section>
    </div>
  )
}

function WithdrawPlanDialog({ error, isWithdrawing, onClose, onWithdraw, plan }) {
  const [remarks, setRemarks] = useState('')
  const confirmButtonRef = useDialogLifecycle(isWithdrawing, onClose)
  const canConfirm = Boolean(remarks.trim()) && !isWithdrawing

  return (
    <div
      className="plan-submit-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isWithdrawing) onClose()
      }}
      role="presentation"
    >
      <section
        aria-describedby="plan-withdraw-description"
        aria-labelledby="plan-withdraw-title"
        aria-modal="true"
        className="plan-submit-dialog plan-submit-dialog--withdraw"
        role="dialog"
      >
        <header className="plan-submit-dialog__header plan-submit-dialog__header--warning">
          <span aria-hidden="true"><Undo2 size={20} /></span>
          <div>
            <h2 id="plan-withdraw-title">Withdraw submission?</h2>
            <p id="plan-withdraw-description">The plan will return to draft before your supervisor reviews it.</p>
          </div>
          <button aria-label="Close withdrawal confirmation" disabled={isWithdrawing} onClick={onClose} type="button">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="plan-submit-dialog__summary">
          <div><small>Plan period</small><strong>{formatDate(plan.periodStartDate)} to {formatDate(plan.periodEndDate)}</strong></div>
          <div><small>Entries</small><strong>{plan.itemCount ?? plan.items?.length ?? 0}</strong></div>
          <div><small>Total hours</small><strong>{formatHours(plan.plannedHours)}</strong></div>
        </div>

        <div className="plan-submit-dialog__notice plan-submit-dialog__notice--warning">
          <TriangleAlert size={18} aria-hidden="true" />
          <p><strong>Your submitted signature will be superseded</strong><span>You can edit and sign the plan again before resubmitting it.</span></p>
        </div>

        <label className="plan-submit-dialog__remarks">
          <span>Withdrawal reason <small>Required</small></span>
          <textarea
            disabled={isWithdrawing}
            maxLength="1000"
            onChange={(event) => setRemarks(event.target.value)}
            placeholder="Explain why this submission needs to be withdrawn"
            rows="4"
            value={remarks}
          />
        </label>

        {error ? (
          <div className="plan-submit-dialog__error" role="alert">
            <AlertCircle size={16} aria-hidden="true" />
            <span>{error.message}</span>
          </div>
        ) : null}

        <footer className="plan-submit-dialog__footer">
          <button disabled={isWithdrawing} onClick={onClose} type="button">Cancel</button>
          <button
            className="plan-submit-dialog__confirm plan-submit-dialog__confirm--warning"
            disabled={!canConfirm}
            onClick={() => onWithdraw(remarks)}
            ref={confirmButtonRef}
            type="button"
          >
            {isWithdrawing ? <RefreshCw className="plan-submit-spin" size={16} aria-hidden="true" /> : <Undo2 size={16} aria-hidden="true" />}
            {isWithdrawing ? 'Withdrawing...' : 'Withdraw submission'}
          </button>
        </footer>
      </section>
    </div>
  )
}

export function EmployeePlanDetailPage() {
  const { planId } = useParams()
  const location = useLocation()
  const planQuery = useQuery({
    queryKey: ['employee', 'overtime-plan', planId],
    queryFn: () => overtimePlanApi.getPlan(planId),
    enabled: Boolean(planId),
  })

  useEffect(() => {
    if (!planQuery.isSuccess || location.hash !== '#activity-history') return

    document.getElementById('activity-history')?.scrollIntoView?.({
      behavior: 'smooth',
      block: 'start',
    })
  }, [location.hash, planQuery.isSuccess])

  return (
    <main className="employee-main plan-detail-page">
      <Link className="plan-detail-back" to="/employee/plans">
        <ArrowLeft size={17} aria-hidden="true" />
        Back to overtime plans
      </Link>

      <div className="employee-welcome">
        <p>Employee portal</p>
        <h1>Overtime plan details</h1>
      </div>

      {planQuery.isLoading ? (
        <>
          <span className="plan-detail-visually-hidden" role="status">Loading overtime plan...</span>
          <DetailSkeleton />
        </>
      ) : null}

      {planQuery.isError ? (
        <div className="plan-detail-state" role="alert">
          <AlertCircle size={26} aria-hidden="true" />
          <div>
            <strong>Unable to load overtime plan</strong>
            <span>{planQuery.error.message}</span>
          </div>
          <button onClick={() => planQuery.refetch()} type="button">
            <RefreshCw size={16} aria-hidden="true" />
            Retry
          </button>
        </div>
      ) : null}

      {planQuery.isSuccess ? <PlanDetailContent plan={planQuery.data} /> : null}
    </main>
  )
}

function PlanDetailContent({ plan }) {
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isWithdrawDialogOpen, setIsWithdrawDialogOpen] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const items = plan.items || []
  const logs = plan.logs || []
  const isEditable = EDITABLE_STATUSES.includes(plan.status)
  const isDeletable = DELETABLE_STATUSES.includes(plan.status)
  const canSubmit = isEditable && (plan.planScope || 'employee') === 'employee'
  const canWithdraw = plan.status === 'submitted_to_supervisor'
  const submitMutation = useMutation({
    mutationFn: (remarks) => overtimePlanApi.submitAndSignPlan(plan.planId, remarks),
    onSuccess: (updatedPlan) => {
      queryClient.setQueryData(['employee', 'overtime-plan', plan.planId], updatedPlan)
      queryClient.invalidateQueries({ queryKey: ['employee', 'overtime-plans'] })
      queryClient.invalidateQueries({ queryKey: ['employee', 'notifications'] })
      setIsSubmitDialogOpen(false)
      toast.success('Overtime plan signed and submitted to your supervisor.')
    },
  })
  const deleteMutation = useMutation({
    mutationFn: () => overtimePlanApi.deletePlan(plan.planId),
    onSuccess: () => {
      queryClient.removeQueries({
        exact: true,
        queryKey: ['employee', 'overtime-plan', plan.planId],
      })
      queryClient.invalidateQueries({ queryKey: ['employee', 'overtime-plans'] })
      queryClient.invalidateQueries({ queryKey: ['employee', 'notifications'] })
      toast.success('Overtime plan deleted successfully.')
      navigate('/employee/plans', { replace: true })
    },
  })
  const withdrawMutation = useMutation({
    mutationFn: (remarks) => overtimePlanApi.withdrawPlan(plan.planId, remarks),
    onSuccess: (updatedPlan) => {
      queryClient.setQueryData(['employee', 'overtime-plan', plan.planId], updatedPlan)
      queryClient.invalidateQueries({
        exact: true,
        queryKey: ['employee', 'overtime-plan', plan.planId],
      })
      queryClient.invalidateQueries({ queryKey: ['employee', 'overtime-plans'] })
      queryClient.invalidateQueries({ queryKey: ['employee', 'notifications'] })
      setIsWithdrawDialogOpen(false)
      toast.success('Overtime plan withdrawn and returned to draft.')
    },
  })

  function openSubmitDialog() {
    submitMutation.reset()
    setIsSubmitDialogOpen(true)
  }

  function openDeleteDialog() {
    deleteMutation.reset()
    setIsDeleteDialogOpen(true)
  }

  function openWithdrawDialog() {
    withdrawMutation.reset()
    setIsWithdrawDialogOpen(true)
  }

  return (
    <>
      <section className="plan-detail-summary" aria-labelledby="plan-summary-title">
        <div className="plan-detail-summary__heading">
          <div>
            <CalendarDays size={20} aria-hidden="true" />
            <span>
              <small id="plan-summary-title">Plan period</small>
              <strong>{formatDate(plan.periodStartDate)} to {formatDate(plan.periodEndDate)}</strong>
            </span>
          </div>
          <div className="plan-detail-summary__actions">
            <span className={`plan-status plan-status--${plan.status}`}>
              <CircleDot size={13} strokeWidth={2.2} aria-hidden="true" />
              {formatLabel(plan.status)}
            </span>
            {isEditable ? (
              <Link className="plan-detail-edit" to={`/employee/plans/${plan.planId}/edit`}>
                <PencilLine size={15} aria-hidden="true" />
                Edit plan
              </Link>
            ) : null}
            {isDeletable ? (
              <button className="plan-detail-delete" onClick={openDeleteDialog} type="button">
                <Trash2 size={15} aria-hidden="true" />
                Delete plan
              </button>
            ) : null}
            {canWithdraw ? (
              <button className="plan-detail-withdraw" onClick={openWithdrawDialog} type="button">
                <Undo2 size={15} aria-hidden="true" />
                Withdraw
              </button>
            ) : null}
            {canSubmit ? (
              <button
                className="plan-detail-submit"
                disabled={!items.length}
                onClick={openSubmitDialog}
                title={items.length ? 'Submit plan to supervisor' : 'Add at least one overtime entry before submitting'}
                type="button"
              >
                <SendHorizontal size={15} aria-hidden="true" />
                Submit plan
              </button>
            ) : null}
          </div>
        </div>

        <dl className="plan-detail-summary__fields">
          <DetailField label="Plan ID" value={plan.planId} />
          <DetailField label="Department" value={plan.departmentName} />
          <DetailField label="Period type" value={formatLabel(plan.periodType)} />
          <DetailField label="Plan scope" value={formatLabel(plan.planScope)} />
          <DetailField label="Created by" value={plan.createdByName} />
          <DetailField label="Created" value={formatDateTime(plan.createdAt)} />
        </dl>

        <div className="plan-detail-totals">
          <div>
            <FileClock size={19} aria-hidden="true" />
            <span><small>Entries</small><strong>{plan.itemCount ?? items.length}</strong></span>
          </div>
          <div>
            <Clock3 size={19} aria-hidden="true" />
            <span><small>Planned hours</small><strong>{formatHours(plan.plannedHours)}</strong></span>
          </div>
        </div>
      </section>

      <WorkflowProgress progress={plan.workflowProgress} />

      {(plan.remarks || plan.rejectionReason) ? (
        <section className="plan-detail-notes" aria-labelledby="plan-notes-title">
          <h2 id="plan-notes-title">Plan notes</h2>
          {plan.remarks ? <p><strong>Remarks</strong><span>{plan.remarks}</span></p> : null}
          {plan.rejectionReason ? (
            <p className="plan-detail-notes__rejection">
              <strong>Rejection reason</strong><span>{plan.rejectionReason}</span>
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="plan-detail-section" aria-labelledby="plan-items-title">
        <div className="plan-detail-section__heading">
          <FileClock size={19} aria-hidden="true" />
          <h2 id="plan-items-title">Planned overtime entries</h2>
          <span>{items.length}</span>
        </div>

        {items.length ? (
          <div className="plan-items-table-shell">
            <table className="plan-items-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Hours</th>
                  <th scope="col">Reason</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.planItemId}>
                    <td>{formatDate(item.plannedDate)}</td>
                    <td>{formatHours(item.plannedHours)}</td>
                    <td>{item.reason || 'Not provided'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="plan-detail-empty">No overtime entries are included in this plan.</div>
        )}
      </section>

      <section
        className="plan-detail-section plan-detail-history"
        id="activity-history"
        aria-labelledby="plan-history-title"
      >
        <div className="plan-detail-section__heading">
          <History size={19} aria-hidden="true" />
          <h2 id="plan-history-title">Activity history</h2>
          <span>{logs.length}</span>
        </div>

        {logs.length ? (
          <ol className="plan-history">
            {logs.map((log) => (
              <li key={log.logId}>
                <span className="plan-history__marker" aria-hidden="true" />
                <div>
                  <strong>{formatLabel(log.action)}</strong>
                  <p>{log.remarks || 'No remarks provided.'}</p>
                  <small>{log.actionByName || 'System'} - {formatDateTime(log.actionAt)}</small>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="plan-detail-empty">No activity has been recorded for this plan.</div>
        )}
      </section>

      {isSubmitDialogOpen ? (
        <SubmitPlanDialog
          error={submitMutation.error}
          isSubmitting={submitMutation.isPending}
          onClose={() => setIsSubmitDialogOpen(false)}
          onSubmit={(remarks) => submitMutation.mutate(remarks)}
          plan={plan}
        />
      ) : null}

      {isDeleteDialogOpen ? (
        <DeletePlanDialog
          error={deleteMutation.error}
          isDeleting={deleteMutation.isPending}
          onClose={() => setIsDeleteDialogOpen(false)}
          onDelete={() => deleteMutation.mutate()}
          plan={plan}
        />
      ) : null}

      {isWithdrawDialogOpen ? (
        <WithdrawPlanDialog
          error={withdrawMutation.error}
          isWithdrawing={withdrawMutation.isPending}
          onClose={() => setIsWithdrawDialogOpen(false)}
          onWithdraw={(remarks) => withdrawMutation.mutate(remarks)}
          plan={plan}
        />
      ) : null}
    </>
  )
}
