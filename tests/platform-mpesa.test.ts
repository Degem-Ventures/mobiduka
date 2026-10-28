import assert from "node:assert/strict"
import test from "node:test"
import { normalizePlatformPhone } from "../lib/platform-mpesa.ts"

test("normalizes valid Kenyan mobile numbers for platform checkout", () => {
  assert.equal(normalizePlatformPhone("0712345678"), "254712345678")
  assert.equal(normalizePlatformPhone("+254112345678"), "254112345678")
})

test("rejects malformed or non-Kenyan checkout phone numbers", () => {
  assert.equal(normalizePlatformPhone("25471234567"), null)
  assert.equal(normalizePlatformPhone("0201234567"), null)
  assert.equal(normalizePlatformPhone(254712345678), null)
})
