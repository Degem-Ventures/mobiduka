const AUTO_END_GRACE_PERIOD_MS = 2 * 60 * 60 * 1000
const UNLINKED_SHIFT_MAX_DURATION_MS = 12 * 60 * 60 * 1000

type LocalDateTime = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

function getLocalDateTime(date: Date, timeZone: string): LocalDateTime {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)
  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, Number(value)]),
  )

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  }
}

function localDateTimeToUtc(
  localDateTime: LocalDateTime,
  timeZone: string,
): Date {
  const desiredUtcTime = Date.UTC(
    localDateTime.year,
    localDateTime.month - 1,
    localDateTime.day,
    localDateTime.hour,
    localDateTime.minute,
    localDateTime.second,
  )
  let timestamp = desiredUtcTime

  for (let iteration = 0; iteration < 4; iteration++) {
    const local = getLocalDateTime(new Date(timestamp), timeZone)
    const representedUtcTime = Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute,
      local.second,
    )
    const adjustment = desiredUtcTime - representedUtcTime
    if (adjustment === 0) break
    timestamp += adjustment
  }

  return new Date(timestamp)
}

function parseScheduledTime(value: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value)
  if (!match) {
    throw new Error(`Invalid scheduled shift time: ${value}`)
  }
  const hour = Number(match[1])
  const minute = Number(match[2])
  return { hour, minute, totalMinutes: hour * 60 + minute }
}

export function getCashSessionAutoEndAt({
  openedAt,
  scheduledStart,
  scheduledEnd,
  timeZone,
}: {
  openedAt: Date
  scheduledStart: string | null
  scheduledEnd: string | null
  timeZone: string | null
}): Date {
  if (!scheduledStart || !scheduledEnd) {
    return new Date(openedAt.getTime() + UNLINKED_SHIFT_MAX_DURATION_MS)
  }

  const zone = timeZone || "Africa/Nairobi"
  const startTime = parseScheduledTime(scheduledStart)
  const endTime = parseScheduledTime(scheduledEnd)
  const openedLocal = getLocalDateTime(openedAt, zone)
  const openedMinutes = openedLocal.hour * 60 + openedLocal.minute
  let localEnd: LocalDateTime = {
    ...openedLocal,
    hour: endTime.hour,
    minute: endTime.minute,
    second: 0,
  }
  if (
    endTime.totalMinutes <= startTime.totalMinutes &&
    openedMinutes >= endTime.totalMinutes
  ) {
    const nextLocalDate = new Date(
      Date.UTC(openedLocal.year, openedLocal.month - 1, openedLocal.day + 1),
    )
    localEnd = {
      ...localEnd,
      year: nextLocalDate.getUTCFullYear(),
      month: nextLocalDate.getUTCMonth() + 1,
      day: nextLocalDate.getUTCDate(),
    }
  }
  let scheduledEndAt = localDateTimeToUtc(localEnd, zone)

  return new Date(scheduledEndAt.getTime() + AUTO_END_GRACE_PERIOD_MS)
}
