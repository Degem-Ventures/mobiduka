import assert from "node:assert/strict"
import test from "node:test"
import {
  getAutoBackupPeriodStart,
  isAutoBackupFrequency,
  isAutoBackupScheduledToday,
} from "../lib/backup-schedule"

test("automatic backup schedule supports daily, weekly, and monthly frequencies", () => {
  const date = new Date("2026-10-14T07:30:00.000Z")

  assert.equal(isAutoBackupScheduledToday(date, "DAILY"), true)
  assert.equal(isAutoBackupScheduledToday(date, "WEEKLY"), false)
  assert.equal(isAutoBackupScheduledToday(date, "MONTHLY"), false)
  assert.equal(isAutoBackupFrequency("WEEKLY"), true)
  assert.equal(isAutoBackupFrequency("quarterly"), false)
})

test("weekly and monthly backup periods begin on their UTC boundaries", () => {
  const date = new Date("2026-10-14T07:30:00.000Z")

  assert.equal(
    getAutoBackupPeriodStart(date, "WEEKLY").toISOString(),
    "2026-10-12T00:00:00.000Z",
  )
  assert.equal(
    getAutoBackupPeriodStart(date, "MONTHLY").toISOString(),
    "2026-10-01T00:00:00.000Z",
  )
})

test("weekly backups are scheduled on Monday and monthly backups on day one", () => {
  assert.equal(
    isAutoBackupScheduledToday(new Date("2026-10-12T06:00:00.000Z"), "WEEKLY"),
    true,
  )
  assert.equal(
    isAutoBackupScheduledToday(new Date("2026-11-01T06:00:00.000Z"), "MONTHLY"),
    true,
  )
})
