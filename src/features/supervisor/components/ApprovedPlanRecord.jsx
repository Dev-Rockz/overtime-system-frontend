import { History, MessageSquareText } from 'lucide-react'
import './approvedPlanRecord.css'

function formatDateTime(value) {
  if (!value) return 'Time not recorded'
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function formatAction(value) {
  return String(value || 'Plan updated')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

export function ApprovedPlanRecord({ logs = [], remarks = '' }) {
  const latestLogs = [...logs].reverse()

  return (
    <section className="approved-plan-record" aria-label="Plan remarks and activity history">
      <div className="approved-plan-record__remarks">
        <header>
          <MessageSquareText size={16} aria-hidden="true" />
          <span><strong>Plan remarks</strong><small>Recorded for this department plan</small></span>
        </header>
        <p>{remarks || 'No plan remarks were provided.'}</p>
      </div>

      <div className="approved-plan-record__history">
        <header>
          <History size={16} aria-hidden="true" />
          <span><strong>Activity history</strong><small>Latest activity first</small></span>
          <b>{latestLogs.length}</b>
        </header>
        {latestLogs.length ? (
          <ol>
            {latestLogs.map((log) => (
              <li key={log.logId}>
                <i aria-hidden="true" />
                <div>
                  <strong>{formatAction(log.action)}</strong>
                  <p>{log.remarks || 'No remarks provided.'}</p>
                  <small>{log.actionByName || 'System'} <span aria-hidden="true">|</span> {formatDateTime(log.actionAt)}</small>
                </div>
              </li>
            ))}
          </ol>
        ) : <p className="approved-plan-record__empty">No activity has been recorded for this plan.</p>}
      </div>
    </section>
  )
}
