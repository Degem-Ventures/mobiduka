import assert from "node:assert/strict"
import test from "node:test"
import { composeProductDisplayName } from "../lib/product-display-name.ts"

test("composes brand, generic product name, and pack size", () => {
  assert.equal(
    composeProductDisplayName("Dairy Joy", "Milk", "200ml"),
    "Dairy Joy Milk 200ml",
  )
})

test("keeps products without a brand readable", () => {
  assert.equal(
    composeProductDisplayName("", "Yoghurt", "250ml"),
    "Yoghurt 250ml",
  )
})

test("does not repeat a brand or pack size already in the product name", () => {
  assert.equal(
    composeProductDisplayName("Dairy Joy", "Dairy Joy Milk 500ml", "500ml"),
    "Dairy Joy Milk 500ml",
  )
})

test("normalizes whitespace in each name part", () => {
  assert.equal(
    composeProductDisplayName("  Dairy   Joy ", " Milk ", " 500ml "),
    "Dairy Joy Milk 500ml",
  )
})
