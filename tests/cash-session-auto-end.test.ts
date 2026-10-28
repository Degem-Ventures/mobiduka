import assert from "node:assert/strict"
import test from "node:test"
import { getCashSessionAutoEndAt } from "../lib/cash-session-auto-end.ts"

test("adds the two-hour grace period after a scheduled end in business time", () => {
  const deadline = getCashSessionAutoEndAt({
    openedAt: new Date("2026-10-28T07:00:00.000Z"),
    scheduledStart: "09:00",
    scheduledEnd: "17:00",
    timeZone: "Africa/Nairobi",
  })

  assert.equal(deadline.toISOString(), "2026-10-28T16:00:00.000Z")
})

test("keeps the scheduled end on the same day when the shift opens late", () => {
  const deadline = getCashSessionAutoEndAt({
    openedAt: new Date("2026-10-28T15:00:00.000Z"),
    scheduledStart: "09:00",
    scheduledEnd: "17:00",
    timeZone: "Africa/Nairobi",
  })

  assert.equal(deadline.toISOString(), "2026-10-28T16:00:00.000Z")
})

test("handles overnight scheduled shifts", () => {
  const deadline = getCashSessionAutoEndAt({
    openedAt: new Date("2026-10-28T19:00:00.000Z"),
    scheduledStart: "22:00",
    scheduledEnd: "06:00",
    timeZone: "Africa/Nairobi",
  })

  assert.equal(deadline.toISOString(), "2026-10-29T05:00:00.000Z")
})

test("uses a 12-hour maximum for sessions without a scheduled shift type", () => {
  const deadline = getCashSessionAutoEndAt({
    openedAt: new Date("2026-10-28T07:00:00.000Z"),
    scheduledStart: null,
    scheduledEnd: null,
    timeZone: "Africa/Nairobi",
  })

  assert.equal(deadline.toISOString(), "2026-10-28T19:00:00.000Z")
})
