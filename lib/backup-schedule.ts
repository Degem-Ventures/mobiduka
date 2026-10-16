export const AUTO_BACKUP_FREQUENCIES = ["DAILY", "WEEKLY", "MONTHLY"] as const

export type AutoBackupFrequency = (typeof AUTO_BACKUP_FREQUENCIES)[number]

export function isAutoBackupFrequency(
  value: unknown,
): value is AutoBackupFrequency {
  return AUTO_BACKUP_FREQUENCIES.some((frequency) => frequency === value)
}

export function getAutoBackupPeriodStart(
  date: Date,
  frequency: AutoBackupFrequency,
) {
  const periodStart = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  )

  if (frequency === "WEEKLY") {
    periodStart.setUTCDate(periodStart.getUTCDate() - ((periodStart.getUTCDay() + 6) % 7))
  } else if (frequency === "MONTHLY") {
    periodStart.setUTCDate(1)
  }

  return periodStart
}

export function isAutoBackupScheduledToday(
  date: Date,
  frequency: AutoBackupFrequency,
) {
  if (frequency === "WEEKLY") return date.getUTCDay() === 1
  if (frequency === "MONTHLY") return date.getUTCDate() === 1
  return true
}
