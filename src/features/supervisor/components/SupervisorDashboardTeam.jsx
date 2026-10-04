import { useState } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight, Search, UsersRound, X } from 'lucide-react'
import { Link } from 'react-router-dom'

const STATES = {
  accepted_signed: ['Accepted', 'accepted'],
  draft: ['Draft', 'draft'],
  not_submitted: ['No submission', 'missing'],
  returned: ['Revision required', 'returned'],
  submitted_signed: ['Awaiting review', 'review'],
  submitted_unsigned: ['Signature missing', 'warning'],
}
const PAGE_SIZE = 6
const hours = (value) => new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(value)

export function SupervisorDashboardTeam({ employees, filter, onFilterChange }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const filtered = employees.filter((employee) => (
    employee.employeeName.toLowerCase().includes(search.trim().toLowerCase())
    && (filter === 'all'
      || (filter === 'gaps' && employee.coverageGap)
      || (filter === 'review' && employee.plans.some((plan) => plan.status === 'submitted_to_supervisor' && plan.signature))
      || (filter === 'returned' && employee.plans.some((plan) => ['supervisor_returned', 'returned_for_revision'].includes(plan.status)))
      || (filter === 'unsigned' && employee.plans.some((plan) => ['submitted_to_supervisor', 'supervisor_accepted'].includes(plan.status) && !plan.signature)))
  ))
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount - 1)

  return (
    <section className="supervisor-dashboard__team" id="dashboard-team" aria-labelledby="dashboard-team-title">
      <header className="supervisor-dashboard__section-heading">
        <div><UsersRound size={18} aria-hidden="true" /><h2 id="dashboard-team-title">Team overview <small>{employees.length} employees</small></h2></div>
        <Link to="/supervisor/team">View team <ArrowRight size={15} aria-hidden="true" /></Link>
      </header>
      <div className="supervisor-dashboard__team-tools">
        <label className="supervisor-dashboard__search">
          <Search size={16} aria-hidden="true" />
          <input aria-label="Search dashboard employees" placeholder="Search employee name" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} />
          {search && <button type="button" aria-label="Clear employee search" title="Clear search" onClick={() => { setSearch(''); setPage(0) }}><X size={14} /></button>}
        </label>
        <select aria-label="Team submission status" value={filter} onChange={(event) => { onFilterChange(event.target.value); setPage(0) }}>
          <option value="all">All employees</option><option value="review">Awaiting review</option>
          <option value="returned">Revision required</option><option value="gaps">Coverage gaps</option><option value="unsigned">Signature missing</option>
        </select>
      </div>
      <div className="supervisor-dashboard__table-scroll">
        <table>
          <thead><tr><th>Employee</th><th>Signed weeks</th><th>Planned hours</th><th>Submission status</th><th><span className="dashboard-sr-only">Profile</span></th></tr></thead>
          <tbody>{filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE).map((employee) => {
            const [label, tone] = STATES[employee.submissionState] || STATES.not_submitted
            return (
              <tr key={employee.employeeId}>
                <th scope="row"><span className="supervisor-dashboard__employee"><i aria-hidden="true"><UsersRound size={16} /></i><span><strong>{employee.employeeName}</strong><small>{employee.employeeNo || 'Employee'}</small></span></span></th>
                <td><span className="supervisor-dashboard__coverage-count">{employee.coveredWeeks} <small>/ {employee.totalWeeks}</small></span></td>
                <td>{hours(employee.plannedHours)}<small className="supervisor-dashboard__unit">h</small></td>
                <td><span className={`supervisor-dashboard__status is-${tone}`}>{label}</span></td>
                <td><Link className="supervisor-dashboard__icon-button" aria-label={`View ${employee.employeeName} profile`} title="View profile" to={`/supervisor/team/${encodeURIComponent(employee.employeeId)}`}><ArrowRight size={16} /></Link></td>
              </tr>
            )
          })}</tbody>
        </table>
      </div>
      {!filtered.length && <p className="supervisor-dashboard__empty">No employees match this selection.</p>}
      <footer className="supervisor-dashboard__pagination">
        <span role="status">{filtered.length ? `${currentPage * PAGE_SIZE + 1}-${Math.min((currentPage + 1) * PAGE_SIZE, filtered.length)} of ${filtered.length} employees` : '0 employees'}</span>
        <div><button className="supervisor-dashboard__icon-button" disabled={!currentPage} aria-label="Previous employees" title="Previous employees" onClick={() => setPage(currentPage - 1)} type="button"><ChevronLeft size={16} /></button><span>{currentPage + 1} / {pageCount}</span><button className="supervisor-dashboard__icon-button" disabled={currentPage === pageCount - 1} aria-label="Next employees" title="Next employees" onClick={() => setPage(currentPage + 1)} type="button"><ChevronRight size={16} /></button></div>
      </footer>
    </section>
  )
}
