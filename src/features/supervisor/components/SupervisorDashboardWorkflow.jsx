import { ArrowRight, Check, ChevronLeft, ChevronRight, Circle, Clock3, GitPullRequest, RotateCcw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getDashboardWorkflow } from '../utils/supervisorDashboardView.js'
import { formatWeek } from '../utils/weekPeriod.js'

export function SupervisorDashboardWorkflow({ plan, count, index, selectPlan, query, listQuery }) {
  const { progress, steps } = getDashboardWorkflow(plan, query.data?.approvals)
  const loading = plan?.status !== 'draft' && query.isPending
  const status = {
    draft: 'Ready for submission', pending_approval: 'Approval in progress', returned_for_revision: 'Returned for revision',
  }[plan?.status]
  return (
    <section className="supervisor-dashboard__workflow" aria-labelledby="dashboard-workflow-title">
      <header className="supervisor-dashboard__section-heading"><div><GitPullRequest size={18} aria-hidden="true" /><h2 id="dashboard-workflow-title">Approval tracker</h2></div><Link to="/supervisor/approvals">View all <ArrowRight size={15} /></Link></header>
      {listQuery.isError && <div className="supervisor-dashboard__inline-error" role="alert"><span>Unable to load all department workflows.</span><button type="button" onClick={() => listQuery.refetch()}>Retry</button></div>}
      {!plan ? listQuery.isPending ? <div className="supervisor-dashboard__section-loading" role="status">Loading department workflows...</div> : !listQuery.isError && <div className="supervisor-dashboard__empty"><Check size={24} /><span>No ongoing department plans in this period.</span></div> : <>
        <div className="supervisor-dashboard__workflow-focus">
          <div><span className={`supervisor-dashboard__status is-${plan.status === 'returned_for_revision' ? 'returned' : 'review'}`}>{status}</span><h3>{formatWeek(plan.periodStartDate, plan.periodEndDate)}</h3></div>
          <div className="supervisor-dashboard__pager"><span>{index + 1} / {count}</span><button type="button" className="supervisor-dashboard__icon-button" disabled={count < 2} onClick={() => selectPlan(-1)} aria-label="Previous department workflow" title="Previous workflow"><ChevronLeft size={16} /></button><button type="button" className="supervisor-dashboard__icon-button" disabled={count < 2} onClick={() => selectPlan(1)} aria-label="Next department workflow" title="Next workflow"><ChevronRight size={16} /></button></div>
        </div>
        {loading ? <div className="supervisor-dashboard__section-loading" role="status">Loading approval route...</div> : query.isError && plan.status !== 'draft' ? <div className="supervisor-dashboard__inline-error" role="alert"><span>Approval route unavailable.</span><button type="button" onClick={() => query.refetch()}>Retry</button></div> : <>
          <div className="supervisor-dashboard__progress-heading"><span>{plan.status === 'draft' ? 'Not submitted' : plan.status === 'returned_for_revision' ? 'Awaiting revision' : 'Approval progress'}</span><strong>{progress}%</strong></div>
          <div className="supervisor-dashboard__progress" role="progressbar" aria-label="Approval progress" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${progress}%` }} /></div>
          <ol className="supervisor-dashboard__steps">{steps.map((step) => <li className={`is-${step.status}`} key={step.id}><span>{step.status === 'approved' ? <Check size={13} /> : step.status === 'pending' ? <Clock3 size={13} /> : step.status === 'rejected' ? <RotateCcw size={13} /> : <Circle size={11} />}</span><div><strong>{step.label}</strong><small>{step.status === 'approved' ? 'Complete' : step.status.replaceAll('_', ' ')}</small></div></li>)}</ol>
        </>}
        <Link className="supervisor-dashboard__text-link" to={`/supervisor/department-plans/${encodeURIComponent(plan.planId)}`}>Open department plan <ArrowRight size={15} /></Link>
      </>}
    </section>
  )
}
