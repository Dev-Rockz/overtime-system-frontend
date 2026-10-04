import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AlertCircle,
  BadgeCheck,
  Eye,
  RefreshCw,
  Search,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { supervisorApi } from '../../../api/supervisorApi.js'
import './supervisorTeamPage.css'

function displayValue(value) {
  return value === null || value === undefined || value === ''
    ? 'Not provided'
    : String(value)
}

function displayLabel(value) {
  const normalized = displayValue(value)
  if (normalized === 'Not provided') return normalized

  return normalized
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function TeamSkeleton() {
  return (
    <div className="supervisor-team__skeleton" aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index}>
          <i />
          <span />
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  )
}

export function SupervisorTeamPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const teamQuery = useQuery({
    queryKey: ['supervisor', 'team'],
    queryFn: supervisorApi.listMyTeam,
  })
  const employees = teamQuery.data || []
  const normalizedSearch = searchTerm.trim().toLocaleLowerCase()
  const filteredEmployees = normalizedSearch
    ? employees.filter((employee) => (
        String(employee.fullName || '').toLocaleLowerCase().includes(normalizedSearch)
      ))
    : employees
  const employeeCountLabel = normalizedSearch
    ? `${filteredEmployees.length} of ${employees.length} employees`
    : `${employees.length} ${employees.length === 1 ? 'employee' : 'employees'}`

  return (
    <main className="supervisor-main supervisor-team-page">
      <header className="supervisor-page-heading">
        <div>
          <h1>My team</h1>
          <p>Employees assigned to your department supervision</p>
        </div>
      </header>

      <section className="supervisor-team" aria-labelledby="team-list-heading">
        <header className="supervisor-team__header">
          <div>
            <UsersRound size={18} aria-hidden="true" />
            <span>
              <h2 id="team-list-heading">Department employees</h2>
              <small>{employeeCountLabel}</small>
            </span>
          </div>
          <div className="supervisor-team__tools">
            <label className="supervisor-team__search">
              <Search size={15} aria-hidden="true" />
              <input
                aria-label="Search employees by name"
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search employee name"
                type="search"
                value={searchTerm}
              />
              {searchTerm ? (
                <button
                  aria-label="Clear employee search"
                  onClick={() => setSearchTerm('')}
                  title="Clear search"
                  type="button"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              ) : null}
            </label>
            <button
              aria-label="Refresh team"
              className="supervisor-team__refresh"
              disabled={teamQuery.isFetching}
              onClick={() => teamQuery.refetch()}
              title="Refresh team"
              type="button"
            >
              <RefreshCw
                className={teamQuery.isFetching ? 'supervisor-team__refresh--active' : ''}
                size={16}
                aria-hidden="true"
              />
            </button>
          </div>
        </header>

        {teamQuery.isLoading ? (
          <>
            <span className="supervisor-team__visually-hidden" role="status">
              Loading team employees...
            </span>
            <TeamSkeleton />
          </>
        ) : null}

        {teamQuery.isError ? (
          <div className="supervisor-team__state" role="alert">
            <AlertCircle size={24} aria-hidden="true" />
            <div>
              <strong>Unable to load your team</strong>
              <span>{teamQuery.error.message}</span>
            </div>
            <button onClick={() => teamQuery.refetch()} type="button">
              <RefreshCw size={16} aria-hidden="true" />
              Retry
            </button>
          </div>
        ) : null}

        {teamQuery.isSuccess && !employees.length ? (
          <div className="supervisor-team__state">
            <UsersRound size={25} aria-hidden="true" />
            <div>
              <strong>No assigned employees</strong>
              <span>No employee profiles are currently assigned to your supervision.</span>
            </div>
          </div>
        ) : null}

        {teamQuery.isSuccess && employees.length && !filteredEmployees.length ? (
          <div className="supervisor-team__state">
            <Search size={25} aria-hidden="true" />
            <div>
              <strong>No matching employee</strong>
              <span>No employee name matches &quot;{searchTerm.trim()}&quot;.</span>
            </div>
          </div>
        ) : null}

        {teamQuery.isSuccess && filteredEmployees.length ? (
          <div className="supervisor-team__table-wrap">
            <table className="supervisor-team__table">
              <thead>
                <tr>
                  <th scope="col">Employee</th>
                  <th scope="col">Employee no.</th>
                  <th scope="col">Department</th>
                  <th scope="col">Position</th>
                  <th scope="col">Shift</th>
                  <th scope="col">Employment</th>
                  <th scope="col">Status</th>
                  <th scope="col"><span className="supervisor-team__visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((employee) => (
                  <tr key={employee.employeeId}>
                    <td>
                      <div className="supervisor-team__employee">
                        <span aria-hidden="true"><UserRound size={17} /></span>
                        <span>
                          <strong>{displayValue(employee.fullName)}</strong>
                          <small>{displayValue(employee.email)}</small>
                        </span>
                      </div>
                    </td>
                    <td>{displayValue(employee.employeeNo)}</td>
                    <td>{displayValue(employee.departmentName)}</td>
                    <td>{displayValue(employee.position)}</td>
                    <td>{displayLabel(employee.shift)}</td>
                    <td>{displayLabel(employee.employmentType)}</td>
                    <td>
                      <span className={`supervisor-team__status supervisor-team__status--${employee.status || 'unknown'}`}>
                        <BadgeCheck size={14} aria-hidden="true" />
                        {displayLabel(employee.status)}
                      </span>
                    </td>
                    <td className="supervisor-team__actions">
                      <Link
                        aria-label={`View ${displayValue(employee.fullName)} profile`}
                        title="View profile"
                        to={`/supervisor/team/${encodeURIComponent(employee.employeeId)}`}
                      >
                        <Eye size={16} aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </main>
  )
}
