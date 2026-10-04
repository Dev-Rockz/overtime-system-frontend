export function toDateValue(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseDateValue(value) {
  const [year, month, day] = String(value).split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function addDays(value, days) {
  const date = value instanceof Date ? new Date(value) : parseDateValue(value)
  date.setDate(date.getDate() + days)
  return date
}

export function getWeekPeriod(anchor = new Date()) {
  const date = anchor instanceof Date ? new Date(anchor) : parseDateValue(anchor)
  date.setHours(0, 0, 0, 0)
  const day = date.getDay()
  const monday = addDays(date, -(day === 0 ? 6 : day - 1))
  const sunday = addDays(monday, 6)

  return {
    periodStartDate: toDateValue(monday),
    periodEndDate: toDateValue(sunday),
  }
}

export function getWeekDays(periodStartDate) {
  const dayFormatter = new Intl.DateTimeFormat('en', { weekday: 'short' })
  const dateFormatter = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' })

  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(periodStartDate, index)
    return {
      date: toDateValue(date),
      dayLabel: dayFormatter.format(date),
      dateLabel: dateFormatter.format(date),
    }
  })
}

export function getPeriodDays(periodStartDate, periodEndDate) {
  const dayFormatter = new Intl.DateTimeFormat('en', { weekday: 'short' })
  const dateFormatter = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' })
  const end = parseDateValue(periodEndDate)
  const days = []
  let current = parseDateValue(periodStartDate)

  while (current <= end && days.length < 62) {
    days.push({
      date: toDateValue(current),
      dayLabel: dayFormatter.format(current),
      dateLabel: dateFormatter.format(current),
    })
    current = addDays(current, 1)
  }

  return days
}

export function formatWeek(periodStartDate, periodEndDate) {
  const formatter = new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
  return `${formatter.format(parseDateValue(periodStartDate))} - ${formatter.format(parseDateValue(periodEndDate))}`
}
