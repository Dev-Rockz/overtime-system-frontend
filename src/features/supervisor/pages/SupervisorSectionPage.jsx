import { Inbox } from 'lucide-react'

export function SupervisorSectionPage({ title, description }) {
  return (
    <main className="supervisor-main">
      <header className="supervisor-page-heading">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </header>
      <section className="supervisor-empty-state" aria-label={`${title} workspace`}>
        <div>
          <Inbox size={27} strokeWidth={1.7} aria-hidden="true" />
          <strong>No records loaded</strong>
        </div>
      </section>
    </main>
  )
}
