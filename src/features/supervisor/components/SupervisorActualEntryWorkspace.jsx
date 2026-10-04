import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  Clock3,
  History,
  LockKeyhole,
  MessageSquareText,
  Save,
  Send,
} from 'lucide-react'
import { actualOvertimeApi } from '../../../api/actualOvertimeApi.js'
import { useToast } from '../../../components/shared/toast/useToast.js'
import {
  formatDate,
  formatDateTime,
  formatHours,
  formatVariance,
  getVarianceTone,
} from '../utils/actualOvertimeView.js'

export function SupervisorActualEntryWorkspace({ entry, period, userId }) {
  const [actualHours, setActualHours] = useState(String(entry.actualHours ?? 0))
  const [adjustmentRemarks, setAdjustmentRemarks] = useState('')
  const [comment, setComment] = useState('')
  const commentsRef = useRef(null)
  const queryClient = useQueryClient()
  const toast = useToast()
  const isFinalized = period.status === 'finalized'
  const periodQueryKey = ['supervisor', 'actual-overtime', 'period', period.actualPeriodId]
  const variance = Number(entry.actualHours || 0) - Number(entry.plannedHours || 0)

  useEffect(() => {
    setActualHours(String(entry.actualHours ?? 0))
    setAdjustmentRemarks('')
    setComment('')
  }, [entry.actualEntryId, entry.actualHours])

  useEffect(() => {
    if (commentsRef.current) commentsRef.current.scrollTop = commentsRef.current.scrollHeight
  }, [entry.actualEntryId, entry.comments?.length])

  const updateMutation = useMutation({
    mutationFn: (update) => actualOvertimeApi.updateEntry(entry.actualEntryId, update),
    onSuccess: async () => {
      setAdjustmentRemarks('')
      toast.success('Actual overtime updated successfully.')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: periodQueryKey }),
        queryClient.invalidateQueries({ queryKey: ['supervisor', 'actual-overtime', 'periods'] }),
      ])
    },
    onError: (error) => toast.error(error.message),
  })
  const commentMutation = useMutation({
    mutationFn: (remarks) => actualOvertimeApi.addComment(entry.actualEntryId, remarks),
    onSuccess: (savedComment) => {
      queryClient.setQueryData(periodQueryKey, (current) => current ? {
        ...current,
        entries: current.entries.map((currentEntry) => (
          currentEntry.actualEntryId === entry.actualEntryId
            ? { ...currentEntry, comments: [...(currentEntry.comments || []), savedComment] }
            : currentEntry
        )),
      } : current)
      setComment('')
      toast.success('Comment added successfully.')
    },
    onError: (error) => toast.error(error.message),
  })

  function submitAdjustment(event) {
    event.preventDefault()
    updateMutation.mutate({
      actualHours: Number(actualHours),
      remarks: adjustmentRemarks.trim(),
    })
  }

  function submitComment(event) {
    event.preventDefault()
    commentMutation.mutate(comment.trim())
  }

  return (
    <section className="supervisor-actual-entry" aria-labelledby="supervisor-actual-entry-title">
      <header className="supervisor-actual-entry__header">
        <div>
          <span>Selected employee entry</span>
          <h2 id="supervisor-actual-entry-title">{entry.employeeName}</h2>
          <p>{entry.employeeNo || 'No employee number'} - {formatDate(entry.actualDate, { short: true, weekday: true })}</p>
        </div>
        <span className={`supervisor-actual-entry__variance is-${getVarianceTone(variance)}`}>
          {formatVariance(variance)}h variance
        </span>
      </header>

      <div className="supervisor-actual-entry__layout">
        <div className="supervisor-actual-entry__details">
          <dl>
            <div><dt>Planned hours</dt><dd>{formatHours(entry.plannedHours)}h</dd></div>
            <div><dt>Actual hours</dt><dd>{formatHours(entry.actualHours)}h</dd></div>
          </dl>
          <div className="supervisor-actual-entry__reason">
            <small>Planned reason</small>
            <p>{entry.plannedReason || 'No reason provided.'}</p>
          </div>

          {isFinalized ? (
            <div className="supervisor-actual-entry__locked">
              <LockKeyhole size={17} aria-hidden="true" />
              <span><strong>Finalized by Admin/HR</strong><small>Hours and comments are locked for this period.</small></span>
            </div>
          ) : (
            <form className="supervisor-actual-adjustment" onSubmit={submitAdjustment}>
              <header><Clock3 size={15} aria-hidden="true" /><strong>Adjust actual hours</strong></header>
              <label>
                <span>Actual hours</span>
                <input
                  max="24"
                  min="0"
                  onChange={(event) => setActualHours(event.target.value)}
                  required
                  step="0.25"
                  type="number"
                  value={actualHours}
                />
              </label>
              <label>
                <span>Adjustment remarks</span>
                <textarea
                  maxLength="500"
                  onChange={(event) => setAdjustmentRemarks(event.target.value)}
                  placeholder="Explain why the actual hours changed"
                  required
                  rows="3"
                  value={adjustmentRemarks}
                />
              </label>
              <button disabled={updateMutation.isPending || !adjustmentRemarks.trim()} type="submit">
                <Save size={14} aria-hidden="true" />
                {updateMutation.isPending ? 'Saving...' : 'Save adjustment'}
              </button>
            </form>
          )}

          <section className="supervisor-actual-adjustments" aria-label="Adjustment history">
            <header><History size={15} aria-hidden="true" /><strong>Adjustment history</strong><span>{entry.adjustments?.length || 0}</span></header>
            {entry.adjustments?.length ? (
              <ol>
                {[...entry.adjustments].reverse().map((adjustment) => (
                  <li key={adjustment.adjustmentId}>
                    <CheckCircle2 size={13} aria-hidden="true" />
                    <div>
                      <strong>{formatHours(adjustment.previousHours)}h to {formatHours(adjustment.newHours)}h</strong>
                      <p>{adjustment.remarks}</p>
                      <small>{adjustment.changedByName || 'System'} - {formatDateTime(adjustment.changedAt)}</small>
                    </div>
                  </li>
                ))}
              </ol>
            ) : <p>No manual adjustments recorded.</p>}
          </section>
        </div>

        <section className="supervisor-actual-conversation" aria-label="Actual overtime comments">
          <header><span><MessageSquareText size={15} aria-hidden="true" /><strong>Conversation</strong></span><b>{entry.comments?.length || 0}</b></header>
          <div className="supervisor-actual-comments" ref={commentsRef}>
            {entry.comments?.length ? (
              <ol aria-live="polite">
                {entry.comments.map((entryComment) => {
                  const isOwnComment = entryComment.userId === userId
                  return (
                    <li className={isOwnComment ? 'is-own' : ''} key={entryComment.commentId}>
                      <div>
                        <p>{entryComment.remarks}</p>
                        <span>{isOwnComment ? 'You' : entryComment.userName || 'User'} - {formatDateTime(entryComment.createdAt)}</span>
                      </div>
                    </li>
                  )
                })}
              </ol>
            ) : (
              <div className="supervisor-actual-comments__empty"><MessageSquareText size={20} aria-hidden="true" /><span>No comments for this entry.</span></div>
            )}
          </div>
          {!isFinalized ? (
            <form className="supervisor-actual-comment-form" onSubmit={submitComment}>
              <label>
                <span className="supervisor-actual-visually-hidden">Add comment</span>
                <textarea
                  maxLength="1000"
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Write a comment"
                  required
                  rows="2"
                  value={comment}
                />
              </label>
              <button aria-label="Send comment" disabled={commentMutation.isPending || !comment.trim()} type="submit">
                <Send size={15} aria-hidden="true" />
              </button>
            </form>
          ) : (
            <footer><LockKeyhole size={13} aria-hidden="true" /> Conversation closed after finalization</footer>
          )}
        </section>
      </div>
    </section>
  )
}
