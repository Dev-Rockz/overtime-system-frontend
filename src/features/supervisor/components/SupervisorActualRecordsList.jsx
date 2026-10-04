import { CheckCircle2, Clock3, Eye, FileClock } from 'lucide-react'
import { formatDateTime, formatHours, formatPeriod, formatVariance, getVarianceTone } from '../utils/actualOvertimeView.js'

const FILTERS = ['all', 'open', 'finalized']

export function SupervisorActualRecordsList({ activeFilter, allPeriods, onFilterChange, onSelect, periods, selectedPeriodId }) {
  return (
    <section className="supervisor-actual-records" aria-labelledby="supervisor-actual-records-title">
      <header>
        <div><FileClock size={16} aria-hidden="true" /><span><strong id="supervisor-actual-records-title">Actual OT records</strong><small>Previous and finalized department periods</small></span></div>
        <div role="group" aria-label="Filter actual overtime records">
          {FILTERS.map((filter) => (
            <button aria-pressed={activeFilter === filter} key={filter} onClick={() => onFilterChange(filter)} type="button">
              {filter}<span>{filter === 'all' ? allPeriods.length : allPeriods.filter((period) => period.status === filter).length}</span>
            </button>
          ))}
        </div>
      </header>

      {periods.length ? (
        <div className="supervisor-actual-records__table-wrap">
          <table>
            <thead><tr><th scope="col">Period</th><th scope="col">Status</th><th scope="col">Entries</th><th scope="col">Planned</th><th scope="col">Actual</th><th scope="col">Variance</th><th scope="col">Finalized</th><th scope="col"><span className="supervisor-actual-visually-hidden">Open</span></th></tr></thead>
            <tbody>
              {periods.map((period) => {
                const variance = Number(period.actualHours || 0) - Number(period.plannedHours || 0)
                return (
                  <tr className={selectedPeriodId === period.actualPeriodId ? 'is-selected' : ''} key={period.actualPeriodId}>
                    <th scope="row"><strong>{formatPeriod(period)}</strong><small>{period.departmentName || period.departmentId}</small></th>
                    <td><span className={`supervisor-actual-status supervisor-actual-status--${period.status}`}>{period.status === 'finalized' ? <CheckCircle2 size={12} aria-hidden="true" /> : <Clock3 size={12} aria-hidden="true" />}{period.status}</span></td>
                    <td>{period.entryCount}</td>
                    <td>{formatHours(period.plannedHours)}h</td>
                    <td>{formatHours(period.actualHours)}h</td>
                    <td><span className={`is-${getVarianceTone(variance)}`}>{formatVariance(variance)}h</span></td>
                    <td>{period.finalizedAt ? formatDateTime(period.finalizedAt) : '-'}</td>
                    <td><button aria-label={`Open actual overtime period ${period.periodStartDate}`} onClick={() => onSelect(period.actualPeriodId)} title="Open period" type="button"><Eye size={13} aria-hidden="true" /></button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : <div className="supervisor-actual-records__empty">No {activeFilter === 'all' ? '' : `${activeFilter} `}records found.</div>}
    </section>
  )
}
