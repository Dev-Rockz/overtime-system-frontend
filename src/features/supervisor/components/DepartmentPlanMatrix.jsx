import { useState } from 'react'
import {
  BadgeCheck,
  CircleAlert,
  Clock3,
  EyeOff,
  FileWarning,
  RotateCcw,
  Signature,
  X,
} from 'lucide-react'
import './departmentPlanMatrix.css'

function displayHours(value) {
  const hours = Number(value || 0)
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1)
}

function getDayEntry(items, date) {
  const matches = (items || []).filter((item) => item.plannedDate === date)
  if (!matches.length) return null

  return {
    hours: matches.reduce((total, item) => total + Number(item.plannedHours || 0), 0),
    reasons: matches.map((item) => item.reason).filter(Boolean),
  }
}

function getDayTotal(rows, date) {
  return rows.reduce((total, row) => {
    const entry = getDayEntry(row.matrixItems, date)
    return total + Number(entry?.hours || 0)
  }, 0)
}

function getInitials(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'E'
}

function StatusContent({ row }) {
  if (row.rowState === 'accepted' || row.rowState === 'included') {
    return <><BadgeCheck size={13} aria-hidden="true" /> {row.statusLabel}</>
  }
  if (row.rowState === 'submitted') {
    return <><Clock3 size={13} aria-hidden="true" /> Ready for review</>
  }
  if (row.rowState === 'unsigned') {
    return <><FileWarning size={13} aria-hidden="true" /> Signature missing</>
  }
  if (row.rowState === 'returned') {
    return <><RotateCcw size={13} aria-hidden="true" /> Returned</>
  }
  return <><CircleAlert size={13} aria-hidden="true" /> {row.statusLabel}</>
}

function SignaturePreview({ onClose, row }) {
  const signedOnBehalf = row.signature?.confirmationMethod === 'supervisor_on_behalf'

  return (
    <div className="matrix-signature-preview__backdrop" role="presentation">
      <section
        aria-labelledby="matrix-signature-preview-title"
        aria-modal="true"
        className="matrix-signature-preview"
        role="dialog"
      >
        <header>
          <div>
            <span>Employee confirmation</span>
            <h2 id="matrix-signature-preview-title">{row.employeeName} signature</h2>
          </div>
          <button aria-label="Close signature preview" onClick={onClose} type="button">
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="matrix-signature-preview__image">
          <img alt={`${row.employeeName} signature preview`} src={row.signature.signedUrl} />
        </div>
        <footer>
          <BadgeCheck size={15} aria-hidden="true" />
          <span>
            <strong>Verified employee signature</strong>
            <small>{signedOnBehalf ? 'Applied by the supervisor on behalf of the employee' : 'Attached when the employee submitted this plan'}</small>
          </span>
        </footer>
      </section>
    </div>
  )
}

export function DepartmentPlanMatrix({
  days,
  rows,
  showDailyTotals = false,
}) {
  const [signatureRow, setSignatureRow] = useState(null)
  const periodTotal = days.reduce((total, day) => total + getDayTotal(rows, day.date), 0)

  return (
    <>
      <div className="department-matrix__wrap">
        <table
          className="department-matrix"
          style={{ minWidth: `${Math.max(930, 377 + (days.length * 82))}px` }}
        >
          <thead>
            <tr>
              <th scope="col">Employee</th>
              {days.map((day) => (
                <th key={day.date} scope="col">
                  <strong>{day.dayLabel}</strong>
                  <span>{day.dateLabel}</span>
                </th>
              ))}
              <th className="department-matrix__signature-heading" scope="col">Signature</th>
              <th className="department-matrix__status-heading" scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className={`department-matrix__row--${row.rowState}`} key={row.employeeId}>
                <th className="department-matrix__employee-cell" scope="row">
                  <span className="department-matrix__employee-avatar" aria-hidden="true">
                    {getInitials(row.employeeName)}
                  </span>
                  <span className="department-matrix__employee-copy">
                    <strong>{row.employeeName}</strong>
                    <small>{row.employeeNo || 'No employee number'}</small>
                  </span>
                </th>
                {days.map((day) => {
                  const entry = getDayEntry(row.matrixItems, day.date)
                  return (
                    <td
                      className={entry ? 'department-matrix__hours' : 'department-matrix__empty-day'}
                      key={day.date}
                      title={entry?.reasons.join('; ') || ''}
                    >
                      {entry ? (
                        <span className="department-matrix__entry">
                          <strong>{displayHours(entry.hours)}h</strong>
                          <small>{entry.reasons[0] || 'Planned overtime'}</small>
                        </span>
                      ) : <span aria-label="No planned overtime">-</span>}
                    </td>
                  )
                })}
                <td className="department-matrix__signature">
                  {row.signature && !['accepted', 'included'].includes(row.rowState) ? (
                    <span
                      className="department-matrix__signature-state department-matrix__signature-state--locked"
                      title="Signature becomes available after supervisor approval"
                    >
                      <EyeOff size={13} aria-hidden="true" /> Pending approval
                    </span>
                  ) : row.signature?.signedUrl ? (
                    <button
                      aria-label={`Preview ${row.employeeName} signature`}
                      onClick={() => setSignatureRow(row)}
                      title="Preview signature"
                      type="button"
                    >
                      <img alt={`${row.employeeName} signature`} src={row.signature.signedUrl} />
                      <span><BadgeCheck size={11} aria-hidden="true" /> Verified</span>
                    </button>
                  ) : row.signature ? (
                    <span className="department-matrix__signature-state department-matrix__signature-state--signed">
                      <Signature size={14} aria-hidden="true" /> Signed
                    </span>
                  ) : (
                    <span className="department-matrix__signature-state">
                      <Signature size={14} aria-hidden="true" /> Awaiting
                    </span>
                  )}
                </td>
                <td className="department-matrix__status-cell">
                  <span className={`department-matrix__status department-matrix__status--${row.rowState}`}>
                    <StatusContent row={row} />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          {showDailyTotals ? (
            <tfoot>
              <tr>
                <th scope="row">Total hours</th>
                {days.map((day) => (
                  <td key={day.date}>
                    <strong>{displayHours(getDayTotal(rows, day.date))}h</strong>
                  </td>
                ))}
                <td className="department-matrix__period-total" colSpan={2}>
                  <span>{displayHours(periodTotal)}h period</span>
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      {signatureRow ? <SignaturePreview onClose={() => setSignatureRow(null)} row={signatureRow} /> : null}
    </>
  )
}
