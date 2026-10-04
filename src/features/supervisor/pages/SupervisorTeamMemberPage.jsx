import { useQuery } from '@tanstack/react-query'
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  Building2,
  RefreshCw,
  UserRound,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { supervisorApi } from '../../../api/supervisorApi.js'
import '../../employee/pages/employeeProfile.css'
import './supervisorTeamMemberPage.css'

function displayValue(value) {
  if (value === null || value === undefined || value === '') return 'Not provided'
  return String(value)
}

function displayLabel(value) {
  const normalized = displayValue(value)
  if (normalized === 'Not provided') return normalized

  return normalized
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function displayDate(value) {
  if (!value) return 'Not provided'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return displayValue(value)

  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function ProfileField({ label, value }) {
  return (
    <div className="profile-field">
      <dt>{label}</dt>
      <dd>{displayValue(value)}</dd>
    </div>
  )
}

function TeamMemberSkeleton() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading employee profile"
      className="supervisor-main profile-page profile-skeleton-page"
    >
      <span className="profile-visually-hidden" role="status">Loading employee profile...</span>
      <div className="profile-skeleton__title">
        <span className="profile-skeleton profile-skeleton--eyebrow" />
        <span className="profile-skeleton profile-skeleton--heading" />
      </div>
      <section className="profile-summary profile-skeleton__summary" aria-hidden="true">
        <span className="profile-skeleton profile-skeleton--avatar" />
        <div className="profile-skeleton__identity">
          <span className="profile-skeleton profile-skeleton--name" />
          <span className="profile-skeleton profile-skeleton--position" />
          <span className="profile-skeleton profile-skeleton--employee-number" />
        </div>
        <span className="profile-skeleton profile-skeleton--status" />
      </section>
      {[0, 1].map((section) => (
        <section className="profile-section" key={section} aria-hidden="true">
          <div className="profile-skeleton__section-heading">
            <span className="profile-skeleton profile-skeleton--icon" />
            <span className="profile-skeleton profile-skeleton--section-title" />
          </div>
          <div className="profile-details profile-skeleton__fields">
            {Array.from({ length: 6 }, (_, index) => (
              <div className="profile-skeleton__field" key={index}>
                <span className="profile-skeleton profile-skeleton--label" />
                <span className="profile-skeleton profile-skeleton--value" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </main>
  )
}

export function SupervisorTeamMemberPage() {
  const { employeeId } = useParams()
  const employeeQuery = useQuery({
    queryKey: ['supervisor', 'team', employeeId],
    queryFn: () => supervisorApi.getTeamMember(employeeId),
  })

  if (employeeQuery.isLoading) return <TeamMemberSkeleton />

  if (employeeQuery.isError) {
    return (
      <main className="supervisor-main profile-page">
        <div className="profile-state profile-state--error" role="alert">
          <AlertCircle size={24} aria-hidden="true" />
          <div>
            <strong>Unable to load employee profile</strong>
            <span>{employeeQuery.error.message}</span>
          </div>
          <button onClick={() => employeeQuery.refetch()} type="button">
            <RefreshCw size={16} aria-hidden="true" />
            Retry
          </button>
        </div>
      </main>
    )
  }

  const employee = employeeQuery.data

  return (
    <main className="supervisor-main profile-page supervisor-team-profile">
      <div className="profile-page__heading supervisor-team-profile__heading">
        <div>
          <p>My team</p>
          <h1>Employee profile</h1>
        </div>
        <Link aria-label="Back to my team" title="Back to my team" to="/supervisor/team">
          <ArrowLeft size={17} aria-hidden="true" />
        </Link>
      </div>

      <section className="profile-summary" aria-labelledby="team-member-name">
        <div className="profile-silhouette" aria-hidden="true">
          <UserRound size={45} strokeWidth={1.6} />
        </div>
        <div className="profile-summary__identity">
          <h2 id="team-member-name">{displayValue(employee.fullName)}</h2>
          <p>{displayValue(employee.position)}</p>
          <span>{displayValue(employee.employeeNo)}</span>
        </div>
        <div className={`profile-status profile-status--${employee.status || 'unknown'}`}>
          <BadgeCheck size={16} aria-hidden="true" />
          {displayLabel(employee.status)}
        </div>
      </section>

      <section className="profile-section" aria-labelledby="team-member-personal-title">
        <div className="profile-section__heading">
          <UserRound size={19} aria-hidden="true" />
          <h2 id="team-member-personal-title">Personal information</h2>
        </div>
        <dl className="profile-details">
          <ProfileField label="First name" value={employee.firstName} />
          <ProfileField label="Middle name" value={employee.middleName} />
          <ProfileField label="Last name" value={employee.lastName} />
          <ProfileField label="Email address" value={employee.email} />
          <ProfileField label="Employee number" value={employee.employeeNo} />
          <ProfileField label="Employee ID" value={employee.employeeId} />
        </dl>
      </section>

      <section className="profile-section" aria-labelledby="team-member-employment-title">
        <div className="profile-section__heading">
          <Building2 size={19} aria-hidden="true" />
          <h2 id="team-member-employment-title">Employment information</h2>
        </div>
        <dl className="profile-details">
          <ProfileField label="Department" value={employee.departmentName} />
          <ProfileField label="Department ID" value={employee.departmentId} />
          <ProfileField label="Position" value={employee.position} />
          <ProfileField label="Supervisor" value={employee.supervisorName} />
          <ProfileField label="Shift" value={displayLabel(employee.shift)} />
          <ProfileField label="Employment type" value={displayLabel(employee.employmentType)} />
          <ProfileField label="Employee status" value={displayLabel(employee.status)} />
          <ProfileField label="Account status" value={displayLabel(employee.userStatus)} />
          <ProfileField label="Profile created" value={displayDate(employee.createdAt)} />
        </dl>
      </section>
    </main>
  )
}
