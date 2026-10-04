import { useMemo, useState } from 'react'
import {
  AlertCircle,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Eye,
  EyeOff,
  FileWarning,
  RotateCcw,
  Send,
  Signature,
  UsersRound,
  X,
} from 'lucide-react'
import './departmentPreparationWorkspace.css'

const FILTERS = [
  { id: 'all', label: 'All employees' },
  { id: 'review', label: 'Needs review' },
  { id: 'issues', label: 'Has issues' },
  { id: 'accepted', label: 'Accepted' },
]

function displayHours(value) {
  const hours = Number(value || 0)
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1)
}

function getIssues(employee) {
  const issues = []
  const items = employee.plan?.items || []

  if (employee.submissionState === 'not_submitted') {
    issues.push({ level: 'warning', text: 'No signed overtime plan submitted' })
  } else if (employee.submissionState === 'draft') {
    issues.push({ level: 'warning', text: 'Plan remains in draft' })
  } else if (employee.submissionState === 'returned') {
    issues.push({ level: 'warning', text: 'Returned plan still requires revision' })
  } else if (employee.submissionState === 'submitted_unsigned') {
    issues.push({ level: 'error', text: 'Submitted plan has no employee signature record' })
  } else if (employee.submissionState === 'submitted_signed') {
    issues.push({ level: 'review', text: 'Signed plan is awaiting supervisor review' })
  }

  if (employee.hasSignedSubmission && !items.length) {
    issues.push({ level: 'error', text: 'Signed plan does not contain overtime entries' })
  }

  const dates = new Set()
  items.forEach((item) => {
    if (!String(item.reason || '').trim()) {
      issues.push({ level: 'error', text: `Missing reason for ${item.plannedDate}` })
    }
    if (dates.has(item.plannedDate)) {
      issues.push({ level: 'warning', text: `Multiple entries exist for ${item.plannedDate}` })
    }
    dates.add(item.plannedDate)
  })

  return issues
}

function getStatusLabel(employee) {
  const labels = {
    accepted_signed: 'Accepted',
    draft: 'Draft only',
    not_submitted: 'Not submitted',
    returned: 'Returned',
    submitted_signed: 'Needs review',
    submitted_unsigned: 'Signature missing',
  }
  return labels[employee.submissionState] || 'Not submitted'
}

function ReviewPanel({ employee, isPending, isReadOnly, onAccept, onClose, onReturn }) {
  const [remarks, setRemarks] = useState('')
  const items = employee.plan?.items || []
  const canReview = employee.submissionState === 'submitted_signed'
  const canRevealSignature = employee.eligibleForDepartmentPlan
    || employee.submissionState === 'accepted_signed'

  return (
    <div className="preparation-review__backdrop" role="presentation">
      <aside
        aria-labelledby="employee-plan-review-title"
        aria-modal="true"
        className="preparation-review"
        role="dialog"
      >
        <header>
          <div>
            <span>Employee plan review</span>
            <h2 id="employee-plan-review-title">{employee.employeeName}</h2>
            <p>{employee.employeeNo || 'No employee number'} · {getStatusLabel(employee)}</p>
          </div>
          <button aria-label="Close employee plan review" onClick={onClose} type="button">
            <X size={19} aria-hidden="true" />
          </button>
        </header>

        <div className="preparation-review__summary">
          <div><span>Entries</span><strong>{items.length}</strong></div>
          <div><span>Planned hours</span><strong>{displayHours(employee.plan?.plannedHours)}h</strong></div>
          <div>
            <span>Signature</span>
            <strong>{employee.plan?.signature ? (canRevealSignature ? 'Verified' : 'Protected') : 'Missing'}</strong>
          </div>
        </div>

        <section className="preparation-review__entries" aria-labelledby="review-entry-title">
          <div className="preparation-review__section-title">
            <CalendarClock size={16} aria-hidden="true" />
            <h3 id="review-entry-title">Overtime entries</h3>
          </div>
          {items.length ? (
            <div className="preparation-review__entry-list">
              {items.map((item) => (
                <article key={item.planItemId || `${item.plannedDate}-${item.reason}`}>
                  <time dateTime={item.plannedDate}>{item.plannedDate}</time>
                  <strong>{displayHours(item.plannedHours)}h</strong>
                  <p>{item.reason || 'No reason provided'}</p>
                </article>
              ))}
            </div>
          ) : <p className="preparation-review__empty">No overtime entries are available.</p>}
        </section>

        <section className="preparation-review__signature" aria-labelledby="review-signature-title">
          <div className="preparation-review__section-title">
            <Signature size={16} aria-hidden="true" />
            <h3 id="review-signature-title">Employee signature</h3>
          </div>
          {employee.plan?.signature && !canRevealSignature ? (
            <span className="preparation-review__locked-signature">
              <EyeOff size={15} aria-hidden="true" /> Available after approval
            </span>
          ) : employee.plan?.signature?.signedUrl ? (
            <>
              <img alt={`${employee.employeeName} signature`} src={employee.plan.signature.signedUrl} />
              {employee.plan.signature.confirmationMethod === 'supervisor_on_behalf' ? (
                <small>Applied by supervisor on behalf of the employee</small>
              ) : null}
            </>
          ) : employee.plan?.signature ? (
            <span><BadgeCheck size={15} aria-hidden="true" /> Signature verified</span>
          ) : (
            <span className="preparation-review__missing-signature">
              <FileWarning size={15} aria-hidden="true" /> No signature record found
            </span>
          )}
        </section>

        {employee.plan?.remarks ? (
          <section className="preparation-review__plan-note">
            <span>Employee remarks</span>
            <p>{employee.plan.remarks}</p>
          </section>
        ) : null}

        {canReview && !isReadOnly ? (
          <label className="preparation-review__remarks">
            <span>Return remarks</span>
            <textarea
              maxLength={500}
              onChange={(event) => setRemarks(event.target.value)}
              placeholder="Required only when returning this plan"
              rows={3}
              value={remarks}
            />
          </label>
        ) : null}

        <footer>
          <button className="preparation-review__secondary" onClick={onClose} type="button">
            Close
          </button>
          {canReview && !isReadOnly ? (
            <>
              <button
                className="preparation-review__return"
                disabled={isPending || !remarks.trim()}
                onClick={() => onReturn(remarks)}
                type="button"
              >
                <RotateCcw size={14} aria-hidden="true" />
                Return
              </button>
              <button disabled={isPending} onClick={onAccept} type="button">
                <CheckCircle2 size={14} aria-hidden="true" />
                Accept plan
              </button>
            </>
          ) : null}
        </footer>
      </aside>
    </div>
  )
}

export function DepartmentPreparationWorkspace({
  days,
  employees,
  isReadOnly = false,
  isReviewing = false,
  onAccept,
  onReturn,
}) {
  const [activeFilter, setActiveFilter] = useState('all')
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const preparedEmployees = useMemo(() => employees.map((employee) => ({
    ...employee,
    issues: getIssues(employee),
  })), [employees])
  const reviewQueue = preparedEmployees.filter((employee) => (
    employee.submissionState === 'submitted_signed'
  ))
  const issueEmployees = preparedEmployees.filter((employee) => employee.issues.length)
  const acceptedEmployees = preparedEmployees.filter((employee) => employee.eligibleForDepartmentPlan)
  const readiness = employees.length
    ? Math.round((acceptedEmployees.length / employees.length) * 100)
    : 0
  const dailyTotals = days.map((day) => ({
    ...day,
    hours: preparedEmployees.reduce((total, employee) => (
      total + (employee.hasSignedSubmission ? employee.plan?.items || [] : [])
        .filter((item) => item.plannedDate === day.date)
        .reduce((dayTotal, item) => dayTotal + Number(item.plannedHours || 0), 0)
    ), 0),
  }))
  const filteredEmployees = preparedEmployees.filter((employee) => {
    if (activeFilter === 'review') return employee.submissionState === 'submitted_signed'
    if (activeFilter === 'issues') return employee.issues.length > 0
    if (activeFilter === 'accepted') return employee.eligibleForDepartmentPlan
    return true
  })

  function inspectNextSubmission() {
    if (reviewQueue[0]) setSelectedEmployee(reviewQueue[0])
  }

  return (
    <div className="preparation-workspace">
      <section className="preparation-workspace__readiness" aria-labelledby="readiness-title">
        <div className="preparation-workspace__readiness-score">
          <span style={{ '--readiness': `${readiness * 3.6}deg` }}>
            <strong>{readiness}%</strong>
            <small>ready</small>
          </span>
          <div>
            <h2 id="readiness-title">Department readiness</h2>
            <p>{acceptedEmployees.length} of {employees.length} employees are accepted for preparation.</p>
          </div>
        </div>
        <dl>
          <div><dt><ClipboardCheck size={15} aria-hidden="true" /> Needs review</dt><dd>{reviewQueue.length}</dd></div>
          <div><dt><AlertCircle size={15} aria-hidden="true" /> With issues</dt><dd>{issueEmployees.length}</dd></div>
          <div><dt><BadgeCheck size={15} aria-hidden="true" /> Accepted</dt><dd>{acceptedEmployees.length}</dd></div>
        </dl>
        <button disabled={!reviewQueue.length || isReadOnly} onClick={inspectNextSubmission} type="button">
          <Eye size={15} aria-hidden="true" />
          {isReadOnly ? 'Review locked' : 'Review next submission'}
        </button>
      </section>

      <section className="preparation-workspace__daily" aria-labelledby="daily-hours-title">
        <header>
          <div>
            <h2 id="daily-hours-title">Submitted hours by day</h2>
            <p>Signed employee plans for the selected week</p>
          </div>
          <CalendarClock size={19} aria-hidden="true" />
        </header>
        <div className="preparation-workspace__daily-grid">
          {dailyTotals.map((day) => (
            <div key={day.date}>
              <span>{day.dayLabel}</span>
              <strong>{displayHours(day.hours)}h</strong>
              <small>{day.dateLabel}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="preparation-workspace__queue" aria-labelledby="review-queue-title">
        <header>
          <div>
            <h2 id="review-queue-title">Employee review queue</h2>
            <p>Inspect readiness and resolve submissions before preparing the department plan.</p>
          </div>
          <div className="preparation-workspace__filters" role="group" aria-label="Filter employee review queue">
            {FILTERS.map((filter) => (
              <button
                aria-pressed={activeFilter === filter.id}
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                type="button"
              >
                {filter.label}
              </button>
            ))}
          </div>
        </header>

        <div className="preparation-workspace__employee-list">
          {filteredEmployees.map((employee) => (
            <article key={employee.employeeId}>
              <span className={`preparation-workspace__employee-state preparation-workspace__employee-state--${employee.submissionState}`} aria-hidden="true" />
              <div className="preparation-workspace__employee-name">
                <strong>{employee.employeeName}</strong>
                <span>{employee.employeeNo || 'No employee number'}</span>
              </div>
              <div className="preparation-workspace__employee-plan">
                <strong>{employee.plan ? `${displayHours(employee.plan.plannedHours)}h` : '-'}</strong>
                <span>{employee.plan ? `${employee.plan.itemCount || employee.plan.items?.length || 0} entries` : 'No plan'}</span>
              </div>
              <div className="preparation-workspace__employee-issues">
                {employee.issues.length ? (
                  <>
                    <AlertCircle size={14} aria-hidden="true" />
                    <span>{employee.issues[0].text}{employee.issues.length > 1 ? ` +${employee.issues.length - 1}` : ''}</span>
                  </>
                ) : (
                  <><CheckCircle2 size={14} aria-hidden="true" /><span>Ready for department plan</span></>
                )}
              </div>
              <span className={`preparation-workspace__employee-status preparation-workspace__employee-status--${employee.submissionState}`}>
                {getStatusLabel(employee)}
              </span>
              <button
                aria-label={`Inspect ${employee.employeeName} overtime plan`}
                disabled={!employee.plan}
                onClick={() => setSelectedEmployee(employee)}
                title="Inspect plan"
                type="button"
              >
                <ChevronRight size={17} aria-hidden="true" />
              </button>
            </article>
          ))}
          {!filteredEmployees.length ? (
            <div className="preparation-workspace__empty">
              <UsersRound size={21} aria-hidden="true" />
              <span>No employees match this review filter.</span>
            </div>
          ) : null}
        </div>
      </section>

      <div className="preparation-workspace__checks" role="note">
        <Send size={17} aria-hidden="true" />
        <p><strong>Preparation rule</strong> Only accepted plans with an active employee signature record are copied into the Department OT Plan.</p>
      </div>

      {selectedEmployee ? (
        <ReviewPanel
          employee={selectedEmployee}
          isPending={isReviewing}
          isReadOnly={isReadOnly}
          onAccept={() => {
            onAccept(selectedEmployee)
            setSelectedEmployee(null)
          }}
          onClose={() => setSelectedEmployee(null)}
          onReturn={(remarks) => {
            onReturn(selectedEmployee, remarks)
            setSelectedEmployee(null)
          }}
        />
      ) : null}
    </div>
  )
}
