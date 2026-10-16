import assert from "node:assert/strict"
import { test } from "node:test"
import { toCsvRow } from "../lib/csv"

test("CSV rows quote delimiters, quotes, and line breaks", () => {
  assert.equal(
    toCsvRow(["Smith, Jane", 'Memo "A"', "first line\nsecond line"]),
    '"Smith, Jane","Memo ""A""","first line\nsecond line"\r\n',
  )
})

test("CSV rows neutralize spreadsheet formulas without changing numeric values", () => {
  assert.equal(
    toCsvRow(["=1+1", "  @SUM(A1:A2)", -12.5, null]),
    '"\'=1+1","\'  @SUM(A1:A2)","-12.5",""\r\n',
  )
})

test("CSV rows reject non-finite numeric values", () => {
  assert.throws(() => toCsvRow([Number.NaN]), TypeError)
})
