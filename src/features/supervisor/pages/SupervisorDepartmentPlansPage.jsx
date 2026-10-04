import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  FilePenLine,
  LayoutList,
  LockKeyhole,
  RefreshCw,
  Table2,
  UsersRound,
  X,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { supervisorApi } from '../../../api/supervisorApi.js'
import { useToast } from '../../../components/shared/toast/useToast.js'
import { DepartmentPlanMatrix } from '../components/DepartmentPlanMatrix.jsx'
import { DepartmentPreparationWorkspace } from '../components/DepartmentPreparationWorkspace.jsx'
import {
  addDays,
  formatWeek,
  getWeekDays,
  getWeekPeriod,
  toDateValue,
} from '../utils/weekPeriod.js'
import './supervisorDepartmentPlansPage.css'

function getRowState(employee) {
  if (employee.submissionState === 'accepted_signed') return 'accepted'
  if (employee.submissionState === 'submitted_signed') return 'submitted'
  if (employee.submissionState === 'submitted_unsigned') return 'unsigned'
  if (employee.submissionState === 'returned') return 'returned'
  if (employee.submissionState === 'draft') return 'draft'
  return 'missing'
}

function getStatusLabel(employee) {
  if (employee.submissionState === 'accepted_signed') return 'Accepted'
  if (employee.submissionState === 'submitted_signed') return 'Ready for review'
  if (employee.submissionState === 'submitted_unsigned') return 'Signature missing'
  if (employee.submissionState === 'returned') return 'Returned'
  if (employee.submissionState === 'draft') return 'Draft only'
  return 'Not submitted'
}

function isEditableDepartmentDraft(status) {
  return ['draft', 'returned_for_revision'].includes(status)
}

function PreparationDialog({ dashboard, onClose, onConfirm, isPending }) {
  const eligibleEmployees = dashboard.employees.filter((employee) => (
    employee.eligibleForDepartmentPlan
  ))
  const notSubmittedEmployees = dashboard.employees.filter((employee) => (
    !employee.hasSignedSubmission
  ))
  const awaitingEmployees = dashboard.employees.filter((employee) => (
    employee.submissionState === 'submitted_signed'
  ))
  const includedHours = eligibleEmployees.reduce(
    (total, employee) => total + Number(employee.plan?.plannedHours || 0),
    0,
  )

  return (
    <div className="department-dialog__backdrop" role="presentation">
      <section
        aria-labelledby="prepare-department-plan-title"
        aria-modal="true"
        className="department-dialog"
        role="dialog"
      >
        <header>
          <div>
            <span>Draft creation summary</span>
            <h2 id="prepare-department-plan-title">Create department draft</h2>
          </div>
          <button aria-label="Close confirmation" onClick={onClose} type="button">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <dl className="department-dialog__summary">
          <div><dt>Employees included</dt><dd>{eligibleEmployees.length}</dd></div>
          <div><dt>Planned hours</dt><dd>{includedHours}h</dd></div>
          <div><dt>Awaiting your review</dt><dd>{awaitingEmployees.length}</dd></div>
          <div><dt>Not submitted</dt><dd>{notSubmittedEmployees.length}</dd></div>
        </dl>

        {notSubmittedEmployees.length ? (
          <div className="department-dialog__warning">
            <AlertCircle size={18} aria-hidden="true" />
            <div>
              <strong>Employees without a signed submission</strong>
              <p>{notSubmittedEmployees.map((employee) => employee.employeeName).join(', ')}</p>
            </div>
          </div>
        ) : null}

        {awaitingEmployees.length ? (
          <p className="department-dialog__note">
            Signed plans still awaiting acceptance will not be copied into this department plan.
          </p>
        ) : null}

        <footer>
          <button className="department-dialog__secondary" onClick={onClose} type="button">
            Cancel
          </button>
          <button
            disabled={isPending || !eligibleEmployees.length}
            onClick={onConfirm}
            type="button"
          >
            {isPending ? 'Creating draft...' : 'Create draft'}
          </button>
        </footer>
      </section>
    </div>
  )
}

export function SupervisorDepartmentPlansPage() {
  const today = toDateValue(new Date())
  const [anchorDate, setAnchorDate] = useState(today)
  const [activeView, setActiveView] = useState('matrix')
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const toast = useToast()
  const period = getWeekPeriod(anchorDate)
  const days = getWeekDays(period.periodStartDate)
  const queryKey = ['supervisor', 'department-preparation', period]
  const dashboardQuery = useQuery({
    queryKey,
    queryFn: () => supervisorApi.getDepartmentPreparation({
      periodType: 'weekly',
      ...period,
    }),
  })
  const acceptMutation = useMutation({
    mutationFn: ({ planId }) => supervisorApi.acceptEmployeePlan(
      planId,
      'Accepted for department overtime planning.',
    ),
    onSuccess: async () => {
      toast.success('Employee overtime plan accepted.')
      await queryClient.invalidateQueries({ queryKey })
    },
    onError: (error) => toast.error(error.message),
  })
  const returnMutation = useMutation({
    mutationFn: ({ planId, remarks }) => supervisorApi.returnEmployeePlan(planId, remarks),
    onSuccess: async () => {
      toast.success('Employee overtime plan returned for revision.')
      await queryClient.invalidateQueries({ queryKey })
    },
    onError: (error) => toast.error(error.message),
  })
  const createMutation = useMutation({
    mutationFn: () => supervisorApi.createDepartmentPlan({
      periodType: 'weekly',
      ...period,
      remarks: `Department weekly OT plan for ${formatWeek(period.periodStartDate, period.periodEndDate)}`,
    }),
    onSuccess: (plan) => {
      setIsConfirmationOpen(false)
      toast.success('Department draft created.')
      navigate(`/supervisor/department-plans/${encodeURIComponent(plan.planId)}`)
    },
    onError: (error) => toast.error(error.message),
  })

  const dashboard = dashboardQuery.data
  const isDepartmentPlanReadOnly = Boolean(
    dashboard?.departmentPlan
    && !isEditableDepartmentDraft(dashboard.departmentPlan.status),
  )
  const rows = (dashboard?.employees || []).map((employee) => ({
    ...employee,
    canAccept: !isDepartmentPlanReadOnly && employee.submissionState === 'submitted_signed',
    matrixItems: employee.hasSignedSubmission ? employee.plan?.items || [] : [],
    planId: employee.plan?.planId || '',
    rowState: getRowState(employee),
    signature: employee.plan?.signature || null,
    statusLabel: getStatusLabel(employee),
  }))

  function moveWeek(offset) {
    setAnchorDate(toDateValue(addDays(period.periodStartDate, offset * 7)))
  }

  return (
    <main className="supervisor-main department-prep-page">
      <header className="department-prep__header">
        <div>
          <h1>Department plans</h1>
          <p>Weekly employee overtime submission matrix</p>
        </div>
        <div className="department-prep__period-controls">
          <button aria-label="Previous week" onClick={() => moveWeek(-1)} title="Previous week" type="button">
            <ChevronLeft size={17} aria-hidden="true" />
          </button>
          <label>
            <CalendarDays size={15} aria-hidden="true" />
            <input
              aria-label="Select department plan week"
              onChange={(event) => setAnchorDate(event.target.value)}
              type="date"
              value={anchorDate}
            />
          </label>
          <button aria-label="Next week" onClick={() => moveWeek(1)} title="Next week" type="button">
            <ChevronRight size={17} aria-hidden="true" />
          </button>
          <button
            className="department-prep__today"
            disabled={anchorDate === today}
            onClick={() => setAnchorDate(today)}
            type="button"
          >
            This week
          </button>
          <button
            aria-label="Refresh department preparation"
            disabled={dashboardQuery.isFetching}
            onClick={() => dashboardQuery.refetch()}
            title="Refresh"
            type="button"
          >
            <RefreshCw className={dashboardQuery.isFetching ? 'department-prep__spin' : ''} size={16} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="department-prep__period">
        <span>Selected week</span>
        <strong>{formatWeek(period.periodStartDate, period.periodEndDate)}</strong>
      </div>

      {dashboard ? (
        <dl className="department-prep__summary" aria-label="Weekly submission summary">
          <div><dt><UsersRound size={16} aria-hidden="true" /> Team employees</dt><dd>{dashboard.totalEmployees}</dd></div>
          <div><dt>Signed submissions</dt><dd>{dashboard.signedSubmissionCount}</dd></div>
          <div><dt>Accepted for plan</dt><dd>{dashboard.eligibleEmployeeCount}</dd></div>
          <div className={dashboard.notSubmittedCount ? 'department-prep__summary--warning' : ''}>
            <dt>Not submitted</dt><dd>{dashboard.notSubmittedCount}</dd>
          </div>
          <div><dt>Submitted hours</dt><dd>{dashboard.includedPlannedHours}h</dd></div>
        </dl>
      ) : null}

      {dashboard?.departmentPlan ? (
        <section
          aria-label="Prepared department plan"
          className={`department-prep__draft department-prep__draft--${dashboard.departmentPlan.status}`}
        >
          <div className="department-prep__draft-icon">
            <FilePenLine size={20} aria-hidden="true" />
          </div>
          <div className="department-prep__draft-copy">
            <span>
              {dashboard.departmentPlan.status === 'returned_for_revision'
                ? 'Revision draft'
                : dashboard.departmentPlan.status === 'draft'
                  ? 'Draft ready'
                  : 'Department plan'}
            </span>
            <strong>{formatWeek(period.periodStartDate, period.periodEndDate)}</strong>
            <small>
              {isEditableDepartmentDraft(dashboard.departmentPlan.status)
                ? 'Continue reviewing this draft. Submission happens inside the draft page.'
                : `Current status: ${dashboard.departmentPlan.status.replaceAll('_', ' ')}`}
            </small>
          </div>
          <span className="department-prep__draft-status">
            {dashboard.departmentPlan.status.replaceAll('_', ' ')}
          </span>
          <Link to={`/supervisor/department-plans/${encodeURIComponent(dashboard.departmentPlan.planId)}`}>
            {isEditableDepartmentDraft(dashboard.departmentPlan.status) ? 'Continue draft' : 'View plan'}
            <ChevronRight size={15} aria-hidden="true" />
          </Link>
        </section>
      ) : null}

      {isDepartmentPlanReadOnly ? (
        <section className="department-prep__read-only" role="status">
          <span><LockKeyhole size={17} aria-hidden="true" /></span>
          <div>
            <strong>This week is read-only</strong>
            <small>The department plan has been submitted. Select another week to prepare a new plan.</small>
          </div>
          <Link to="/supervisor/approvals">
            Track approval
            <ChevronRight size={15} aria-hidden="true" />
          </Link>
        </section>
      ) : null}

      {dashboardQuery.isLoading ? (
        <div className="department-prep__state" role="status">
          <RefreshCw className="department-prep__spin" size={22} aria-hidden="true" />
          <span>Loading weekly employee submissions...</span>
        </div>
      ) : null}

      {dashboardQuery.isError ? (
        <div className="department-prep__state department-prep__state--error" role="alert">
          <AlertCircle size={23} aria-hidden="true" />
          <div><strong>Unable to load department preparation</strong><span>{dashboardQuery.error.message}</span></div>
          <button onClick={() => dashboardQuery.refetch()} type="button">Retry</button>
        </div>
      ) : null}

      {dashboardQuery.isSuccess && !rows.length ? (
        <div className="department-prep__state">
          <UsersRound size={24} aria-hidden="true" />
          <span>No employees are assigned to your supervision.</span>
        </div>
      ) : null}

      {rows.length ? (
        <>
          <div aria-label="Department plan views" className="department-prep__tabs" role="tablist">
            <button
              aria-controls="department-matrix-panel"
              aria-selected={activeView === 'matrix'}
              id="department-matrix-tab"
              onClick={() => setActiveView('matrix')}
              role="tab"
              type="button"
            >
              <Table2 size={15} aria-hidden="true" />
              Weekly matrix
            </button>
            <button
              aria-controls="department-workspace-panel"
              aria-selected={activeView === 'workspace'}
              id="department-workspace-tab"
              onClick={() => setActiveView('workspace')}
              role="tab"
              type="button"
            >
              <LayoutList size={15} aria-hidden="true" />
              Preparation workspace
              {dashboard.signedSubmissionCount ? <span>{dashboard.signedSubmissionCount}</span> : null}
            </button>
          </div>

          <section
            aria-labelledby="department-matrix-tab"
            className={isDepartmentPlanReadOnly ? 'department-prep__readonly-panel' : ''}
            hidden={activeView !== 'matrix'}
            id="department-matrix-panel"
            role="tabpanel"
          >
            <DepartmentPlanMatrix
              days={days}
              rows={rows}
            />
          </section>

          <section
            aria-labelledby="department-workspace-tab"
            className={isDepartmentPlanReadOnly ? 'department-prep__readonly-panel' : ''}
            hidden={activeView !== 'workspace'}
            id="department-workspace-panel"
            role="tabpanel"
          >
            <DepartmentPreparationWorkspace
              days={days}
              employees={dashboard.employees}
              isReadOnly={isDepartmentPlanReadOnly}
              isReviewing={acceptMutation.isPending || returnMutation.isPending}
              onAccept={(employee) => acceptMutation.mutate({ planId: employee.plan.planId })}
              onReturn={(employee, remarks) => returnMutation.mutate({
                planId: employee.plan.planId,
                remarks,
              })}
            />
          </section>
        </>
      ) : null}

      {dashboard && !dashboard.departmentPlan ? (
        <footer className="department-prep__footer">
          <div>
            <FileCheck2 size={20} aria-hidden="true" />
            <span>
              <strong>Create a department draft for this week</strong>
              <small>This copies accepted, employee-signed plans into one editable draft. It does not submit the draft.</small>
            </span>
          </div>
          <button
            disabled={!dashboard.eligibleEmployeeCount}
            onClick={() => setIsConfirmationOpen(true)}
            type="button"
          >
            Create department draft
          </button>
        </footer>
      ) : null}

      {isConfirmationOpen && dashboard ? (
        <PreparationDialog
          dashboard={dashboard}
          isPending={createMutation.isPending}
          onClose={() => setIsConfirmationOpen(false)}
          onConfirm={() => createMutation.mutate()}
        />
      ) : null}
    </main>
  )
}
