export function parseDateValue(value) {
  return new Date(`${value}T00:00:00`)
}

export function formatDate(value, options = {}) {
  if (!value) return 'Not recorded'
  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: options.short ? 'short' : 'long',
    weekday: options.weekday ? 'short' : undefined,
    year: 'numeric',
  }).format(parseDateValue(value))
}

export function formatDateTime(value) {
  if (!value) return 'Not recorded'
  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

export function formatHours(value) {
  return new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(Number(value) || 0)
}

export function formatPeriod(period) {
  return `${formatDate(period.periodStartDate, { short: true })} - ${formatDate(period.periodEndDate, { short: true })}`
}

export function formatVariance(value) {
  const variance = Number(value) || 0
  return `${variance > 0 ? '+' : ''}${formatHours(variance)}`
}

export function getVarianceTone(value) {
  const variance = Number(value) || 0
  if (variance > 0) return 'higher'
  if (variance < 0) return 'lower'
  return 'matched'
}
