import { useQuery } from '@tanstack/react-query'
import {
  AlertCircle,
  BadgeCheck,
  Building2,
  FileSignature,
  RefreshCw,
  UserRound,
} from 'lucide-react'
import { employeeApi } from '../../../api/employeeApi.js'
import './employeeProfile.css'

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

function ProfileSkeletonFields({ count }) {
  return (
    <div className="profile-details profile-skeleton__fields">
      {Array.from({ length: count }, (_, index) => (
        <div className="profile-skeleton__field" key={index}>
          <span className="profile-skeleton profile-skeleton--label" />
          <span className="profile-skeleton profile-skeleton--value" />
        </div>
      ))}
    </div>
  )
}

export function EmployeeProfilePage({
  mainClassName = 'employee-main',
  portalLabel = 'Employee portal',
  queryScope = 'employee',
}) {
  const profileQuery = useQuery({
    queryKey: [queryScope, 'profile'],
    queryFn: async () => {
      const [employee, signature] = await Promise.all([
        employeeApi.getMyProfile(),
        employeeApi.getMySignature(),
      ])

      return { employee, signature }
    },
  })

  if (profileQuery.isLoading) {
    return (
      <main
        aria-busy="true"
        aria-label={`Loading ${portalLabel.toLowerCase()} profile`}
        className={`${mainClassName} profile-page profile-skeleton-page`}
      >
        <span className="profile-visually-hidden" role="status">
          Loading profile...
        </span>

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

        <section className="profile-section" aria-hidden="true">
          <div className="profile-skeleton__section-heading">
            <span className="profile-skeleton profile-skeleton--icon" />
            <span className="profile-skeleton profile-skeleton--section-title" />
          </div>
          <ProfileSkeletonFields count={6} />
        </section>

        <section className="profile-section" aria-hidden="true">
          <div className="profile-skeleton__section-heading">
            <span className="profile-skeleton profile-skeleton--icon" />
            <span className="profile-skeleton profile-skeleton--section-title" />
          </div>
          <ProfileSkeletonFields count={9} />
        </section>

        <section className="profile-section" aria-hidden="true">
          <div className="profile-skeleton__section-heading">
            <span className="profile-skeleton profile-skeleton--icon" />
            <span className="profile-skeleton profile-skeleton--section-title" />
          </div>
          <span className="profile-skeleton profile-skeleton--signature" />
        </section>
      </main>
    )
  }

  if (profileQuery.isError) {
    return (
      <main className={`${mainClassName} profile-page`}>
        <div className="profile-state profile-state--error" role="alert">
          <AlertCircle size={24} aria-hidden="true" />
          <div>
            <strong>Unable to load profile</strong>
            <span>{profileQuery.error.message}</span>
          </div>
          <button onClick={() => profileQuery.refetch()} type="button">
            <RefreshCw size={16} aria-hidden="true" />
            Retry
          </button>
        </div>
      </main>
    )
  }

  const { employee, signature } = profileQuery.data

  return (
    <main className={`${mainClassName} profile-page`}>
      <div className="profile-page__heading">
        <p>{portalLabel}</p>
        <h1>My profile</h1>
      </div>

      <section className="profile-summary" aria-labelledby="profile-name">
        <div className="profile-silhouette" aria-hidden="true">
          <UserRound size={45} strokeWidth={1.6} />
        </div>
        <div className="profile-summary__identity">
          <h2 id="profile-name">{employee.fullName}</h2>
          <p>{displayValue(employee.position)}</p>
          <span>{displayValue(employee.employeeNo)}</span>
        </div>
        <div className={`profile-status profile-status--${employee.status || 'unknown'}`}>
          <BadgeCheck size={16} aria-hidden="true" />
          {displayLabel(employee.status)}
        </div>
      </section>

      <section className="profile-section" aria-labelledby="personal-information-title">
        <div className="profile-section__heading">
          <UserRound size={19} aria-hidden="true" />
          <h2 id="personal-information-title">Personal information</h2>
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

      <section className="profile-section" aria-labelledby="employment-information-title">
        <div className="profile-section__heading">
          <Building2 size={19} aria-hidden="true" />
          <h2 id="employment-information-title">Employment information</h2>
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

      <section className="profile-section" aria-labelledby="signature-title">
        <div className="profile-section__heading">
          <FileSignature size={19} aria-hidden="true" />
          <h2 id="signature-title">Saved signature</h2>
        </div>

        {signature ? (
          <div className="signature-content">
            <div className="signature-preview">
              <img src={signature.signedUrl} alt={`${employee.fullName}'s saved signature`} />
            </div>
            <dl className="signature-details">
              <ProfileField label="Signature ID" value={signature.signatureId} />
              <ProfileField label="File type" value={signature.mimeType} />
              <ProfileField label="Status" value={displayLabel(signature.status)} />
              <ProfileField label="Last updated" value={displayDate(signature.updatedAt)} />
            </dl>
          </div>
        ) : (
          <div className="signature-empty">
            <FileSignature size={30} strokeWidth={1.5} aria-hidden="true" />
            <div>
              <strong>No saved signature</strong>
              <span>Your signature has not been registered yet.</span>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}
