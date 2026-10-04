import { useMemo, useState } from 'react'
import { BadgeCheck, Signature, X } from 'lucide-react'
import { formatHours, formatVariance, getVarianceTone } from '../utils/actualOvertimeView.js'
import './supervisorActualWeekMatrix.css'

function getInitials(name) {
  return String(name || 'Employee')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function groupEntries(entries) {
  const employees = new Map()
  entries.forEach((entry) => {
    const employee = employees.get(entry.employeeId) || {
      employeeId: entry.employeeId,
      employeeName: entry.employeeName,
      employeeNo: entry.employeeNo,
      entries: [],
    }
    employee.entries.push(entry)
    employees.set(entry.employeeId, employee)
  })
  return [...employees.values()]
}

function getCellEntries(entries, date) {
  return entries.filter((entry) => entry.actualDate === date)
}

function sumHours(entries, field) {
  return entries.reduce((total, entry) => total + Number(entry[field] || 0), 0)
}

function SignatureDialog({ employee, onClose, signature }) {
  return (
    <div className="supervisor-actual-signature-dialog__backdrop" role="presentation">
      <section aria-modal="true" className="supervisor-actual-signature-dialog" role="dialog" aria-labelledby="actual-signature-title">
        <header>
          <div><span>Employee confirmation</span><h2 id="actual-signature-title">{employee.employeeName} signature</h2></div>
          <button aria-label="Close signature preview" onClick={onClose} type="button"><X size={17} aria-hidden="true" /></button>
        </header>
        <div><img alt={`${employee.employeeName} signature preview`} src={signature.signedUrl} /></div>
        <footer><BadgeCheck size={14} aria-hidden="true" /> Verified employee submission signature</footer>
      </section>
    </div>
  )
}

export function SupervisorActualWeekMatrix({
  days,
  entries,
  onSelectEntry,
  selectedEntryId,
  signaturesByEmployee,
}) {
  const [signaturePreview, setSignaturePreview] = useState(null)
  const employees = useMemo(() => groupEntries(entries), [entries])

  return (
    <>
      <div className="supervisor-actual-matrix-wrap">
        <table className="supervisor-actual-matrix" style={{ minWidth: `${390 + (days.length * 91)}px` }}>
          <thead>
            <tr>
              <th scope="col">Employee</th>
              {days.map((day) => <th key={day.date} scope="col"><strong>{day.dayLabel}</strong><span>{day.dateLabel}</span></th>)}
              <th scope="col">Signature</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => {
              const signature = signaturesByEmployee.get(employee.employeeId)
              return (
                <tr key={employee.employeeId}>
                  <th scope="row">
                    <span className="supervisor-actual-matrix__avatar" aria-hidden="true">{getInitials(employee.employeeName)}</span>
                    <span><strong>{employee.employeeName}</strong><small>{employee.employeeNo || 'No employee number'}</small></span>
                  </th>
                  {days.map((day) => {
                    const cellEntries = getCellEntries(employee.entries, day.date)
                    const planned = sumHours(cellEntries, 'plannedHours')
                    const actual = sumHours(cellEntries, 'actualHours')
                    const pending = cellEntries.some((entry) => entry.isPending)
                    const selected = cellEntries.some((entry) => entry.actualEntryId === selectedEntryId)
                    return (
                      <td className={selected ? 'is-selected' : ''} key={day.date}>
                        {cellEntries.length ? (
                          <button
                            aria-label={`Open ${employee.employeeName} actual overtime for ${day.date}`}
                            onClick={() => onSelectEntry(cellEntries[0].actualEntryId)}
                            type="button"
                          >
                            <strong>{pending ? 'Pending' : `${formatHours(actual)}h`}</strong>
                            <small>{formatHours(planned)}h planned</small>
                            {!pending ? <span className={`is-${getVarianceTone(actual - planned)}`}>{formatVariance(actual - planned)}h</span> : null}
                          </button>
                        ) : <span className="supervisor-actual-matrix__empty">-</span>}
                      </td>
                    )
                  })}
                  <td className="supervisor-actual-matrix__signature">
                    {signature?.signedUrl ? (
                      <button
                        aria-label={`Preview ${employee.employeeName} signature`}
                        onClick={() => setSignaturePreview({ employee, signature })}
                        title="Preview signature"
                        type="button"
                      >
                        <img alt={`${employee.employeeName} signature`} src={signature.signedUrl} />
                        <span><BadgeCheck size={10} aria-hidden="true" /> Verified</span>
                      </button>
                    ) : (
                      <span><Signature size={13} aria-hidden="true" /> Not available</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Daily total</th>
              {days.map((day) => {
                const dayEntries = entries.filter((entry) => entry.actualDate === day.date)
                return (
                  <td key={day.date}>
                    <strong>{formatHours(sumHours(dayEntries, 'actualHours'))}h</strong>
                    <small>{formatHours(sumHours(dayEntries, 'plannedHours'))}h planned</small>
                  </td>
                )
              })}
              <td><strong>{formatHours(sumHours(entries, 'actualHours'))}h</strong><small>week actual</small></td>
            </tr>
          </tfoot>
        </table>
      </div>
      {signaturePreview ? (
        <SignatureDialog
          employee={signaturePreview.employee}
          onClose={() => setSignaturePreview(null)}
          signature={signaturePreview.signature}
        />
      ) : null}
    </>
  )
}
