import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  FileCheck2,
  RefreshCw,
  Send,
  X,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { supervisorApi } from '../../../api/supervisorApi.js'
import { useToast } from '../../../components/shared/toast/useToast.js'
import { DepartmentPlanMatrix } from '../components/DepartmentPlanMatrix.jsx'
import { formatWeek, getWeekDays } from '../utils/weekPeriod.js'
import './supervisorDepartmentPlanDetailPage.css'

function displayStatus(value) {
  return String(value || 'unknown')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function SubmissionDialog({ dashboard, plan, onClose, onSubmit, isPending }) {
  const [remarks, setRemarks] = useState(plan.remarks || '')
  const includedEmployeeIds = new Set(plan.items.map((item) => item.employeeId))
  const missingEmployees = dashboard.employees.filter((employee) => !employee.hasSignedSubmission)
  const excludedSignedEmployees = dashboard.employees.filter((employee) => (
    employee.hasSignedSubmission && !includedEmployeeIds.has(employee.employeeId)
  ))
  const totalHours = plan.items.reduce(
    (total, item) => total + Number(item.plannedHours || 0),
    0,
  )

  return (
    <div className="department-dialog__backdrop" role="presentation">
      <section
        aria-labelledby="submit-department-plan-title"
        aria-modal="true"
        className="department-dialog"
        role="dialog"
      >
        <header>
          <div>
            <span>Final confirmation</span>
            <h2 id="submit-department-plan-title">Submit department plan</h2>
          </div>
          <button aria-label="Close submission confirmation" onClick={onClose} type="button">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <dl className="department-dialog__summary">
          <div><dt>Employees included</dt><dd>{includedEmployeeIds.size}</dd></div>
          <div><dt>OT entries</dt><dd>{plan.items.length}</dd></div>
          <div><dt>Planned hours</dt><dd>{totalHours}h</dd></div>
          <div><dt>Not submitted</dt><dd>{missingEmployees.length}</dd></div>
        </dl>

        {missingEmployees.length ? (
          <div className="department-dialog__warning">
            <AlertCircle size={18} aria-hidden="true" />
            <div>
              <strong>Employees without a signed weekly plan</strong>
              <p>{missingEmployees.map((employee) => employee.employeeName).join(', ')}</p>
            </div>
          </div>
        ) : null}

        {excludedSignedEmployees.length ? (
          <p className="department-dialog__note">
            Signed but not included: {excludedSignedEmployees.map((employee) => employee.employeeName).join(', ')}.
          </p>
        ) : null}

        <label className="department-submit__remarks">
          <span>Submission remarks</span>
          <textarea
            maxLength={500}
            onChange={(event) => setRemarks(event.target.value)}
            placeholder="Add remarks for the approval route"
            rows={3}
            value={remarks}
          />
        </label>

        <div className="department-submit__signature-note">
          <BadgeCheck size={17} aria-hidden="true" />
          <div>
            <strong>Your saved signature will be applied automatically</strong>
            <span>The supervisor step is completed on submission, then the plan advances to Japanese Management.</span>
          </div>
        </div>

        <footer>
          <button className="department-dialog__secondary" onClick={onClose} type="button">Cancel</button>
          <button disabled={isPending} onClick={() => onSubmit(remarks)} type="button">
            {isPending ? 'Submitting and signing...' : 'Submit and sign'}
          </button>
        </footer>
      </section>
    </div>
  )
}

export function SupervisorDepartmentPlanDetailPage() {
  const { planId } = useParams()
  const [isSubmissionOpen, setIsSubmissionOpen] = useState(false)
  const queryClient = useQueryClient()
  const toast = useToast()
  const planQueryKey = ['supervisor', 'department-plan', planId]
  const planQuery = useQuery({
    queryKey: planQueryKey,
    queryFn: () => supervisorApi.getDepartmentPlan(planId),
  })
  const plan = planQuery.data
  const dashboardQuery = useQuery({
    queryKey: ['supervisor', 'department-preparation', plan?.periodStartDate, plan?.periodEndDate],
    queryFn: () => supervisorApi.getDepartmentPreparation({
      periodType: plan.periodType,
      periodStartDate: plan.periodStartDate,
      periodEndDate: plan.periodEndDate,
    }),
    enabled: Boolean(plan),
  })
  const submitMutation = useMutation({
    mutationFn: (remarks) => supervisorApi.submitDepartmentPlan(planId, remarks),
    onSuccess: async () => {
      setIsSubmissionOpen(false)
      toast.success('Department plan submitted and signed successfully.')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: planQueryKey }),
        queryClient.invalidateQueries({ queryKey: ['supervisor', 'department-preparation'] }),
        queryClient.invalidateQueries({ queryKey: ['supervisor', 'department-drafts'] }),
        queryClient.invalidateQueries({ queryKey: ['supervisor', 'department-approval-plans'] }),
      ])
    },
    onError: (error) => toast.error(error.message),
  })

  if (planQuery.isLoading) {
    return (
      <main className="supervisor-main department-detail__state" role="status">
        <RefreshCw className="department-detail__spin" size={22} aria-hidden="true" />
        <span>Loading department plan...</span>
      </main>
    )
  }

  if (planQuery.isError) {
    return (
      <main className="supervisor-main department-detail__state department-detail__state--error" role="alert">
        <AlertCircle size={24} aria-hidden="true" />
        <div><strong>Unable to load department plan</strong><span>{planQuery.error.message}</span></div>
        <button onClick={() => planQuery.refetch()} type="button">Retry</button>
      </main>
    )
  }

  const dashboard = dashboardQuery.data
  const days = getWeekDays(plan.periodStartDate)
  const itemsByEmployee = new Map()
  plan.items.forEach((item) => {
    const items = itemsByEmployee.get(item.employeeId) || []
    items.push(item)
    itemsByEmployee.set(item.employeeId, items)
  })
  const rows = (dashboard?.employees || []).map((employee) => {
    const matrixItems = itemsByEmployee.get(employee.employeeId) || []
    const isIncluded = matrixItems.length > 0
    return {
      ...employee,
      matrixItems,
      rowState: isIncluded ? 'included' : employee.hasSignedSubmission ? 'submitted' : 'missing',
      signature: employee.plan?.signature || null,
      statusLabel: isIncluded ? 'Included' : employee.hasSignedSubmission ? 'Not included' : 'Not submitted',
    }
  })
  const includedEmployeeCount = new Set(plan.items.map((item) => item.employeeId)).size
  const totalHours = plan.items.reduce((total, item) => total + Number(item.plannedHours || 0), 0)
  const canSubmit = ['draft', 'returned_for_revision'].includes(plan.status)

  return (
    <main className="supervisor-main department-detail-page">
      <header className="department-detail__header">
        <div>
          <span>Department overtime plan</span>
          <h1>{formatWeek(plan.periodStartDate, plan.periodEndDate)}</h1>
          <p>{plan.departmentName || plan.departmentId}</p>
        </div>
        <div>
          <span className={`department-detail__status department-detail__status--${plan.status}`}>
            <BadgeCheck size={15} aria-hidden="true" />
            {displayStatus(plan.status)}
          </span>
          <Link aria-label="Back to department plans" title="Back to department plans" to="/supervisor/department-plans">
            <ArrowLeft size={17} aria-hidden="true" />
          </Link>
        </div>
      </header>

      <dl className="department-prep__summary" aria-label="Department plan summary">
        <div><dt>Employees included</dt><dd>{includedEmployeeCount}</dd></div>
        <div><dt>OT entries</dt><dd>{plan.items.length}</dd></div>
        <div><dt>Planned hours</dt><dd>{totalHours}h</dd></div>
        <div><dt>Not submitted</dt><dd>{dashboard?.notSubmittedCount || 0}</dd></div>
        <div><dt>Plan status</dt><dd className="department-detail__summary-status">{displayStatus(plan.status)}</dd></div>
      </dl>

      {dashboardQuery.isLoading ? (
        <div className="department-detail__state" role="status">Loading employee submission summary...</div>
      ) : null}
      {dashboardQuery.isError ? (
        <div className="department-detail__state department-detail__state--error" role="alert">
          <AlertCircle size={20} aria-hidden="true" />
          <span>{dashboardQuery.error.message}</span>
        </div>
      ) : null}
      {rows.length ? <DepartmentPlanMatrix days={days} rows={rows} /> : null}

      <footer className="department-prep__footer">
        <div>
          <FileCheck2 size={20} aria-hidden="true" />
          <span>
            <strong>{canSubmit ? 'Review the summary before submission' : 'Department plan workflow started'}</strong>
            <small>{canSubmit ? 'Missing employee submissions will be shown again for confirmation.' : `Current status: ${displayStatus(plan.status)}`}</small>
          </span>
        </div>
        {canSubmit ? (
          <button onClick={() => setIsSubmissionOpen(true)} type="button">
            <Send size={14} aria-hidden="true" />
            Review and submit
          </button>
        ) : null}
      </footer>

      {isSubmissionOpen && dashboard ? (
        <SubmissionDialog
          dashboard={dashboard}
          isPending={submitMutation.isPending}
          onClose={() => setIsSubmissionOpen(false)}
          onSubmit={(remarks) => submitMutation.mutate(remarks)}
          plan={plan}
        />
      ) : null}
    </main>
  )
}
