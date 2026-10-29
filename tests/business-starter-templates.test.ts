import assert from "node:assert/strict"
import test from "node:test"
import { getBusinessStarterTemplate } from "../lib/business-starter-templates.ts"

test("provides a starter catalog for each supported business type", () => {
  for (const businessType of [
    "duka",
    "kiosk",
    "mini-shop",
    "pharmacy",
    "agrovet",
    "retail-chain",
    "other",
  ]) {
    const template = getBusinessStarterTemplate(businessType)
    assert.ok(template, `expected a template for ${businessType}`)
    assert.ok(template.categories.length > 0)
    assert.ok(template.products.length > 0)
    const categoryNames = new Set(
      template.categories.map((category) => category.name),
    )
    for (const product of template.products) {
      assert.ok(categoryNames.has(product.category))
    }
  }
})

test("retains support for the previously offered mini-market business type", () => {
  assert.equal(getBusinessStarterTemplate("mini-market")?.label, "Mini-market")
})

test("does not choose a template for an empty or unknown business type", () => {
  assert.equal(getBusinessStarterTemplate(""), null)
  assert.equal(getBusinessStarterTemplate("unknown"), null)
})

test("pharmacy and agrovet product examples require the owner to enter details", () => {
  for (const businessType of ["pharmacy", "agrovet"]) {
    const template = getBusinessStarterTemplate(businessType)
    assert.ok(template)
    assert.ok(
      template.products.every((product) =>
        /enter .*details/i.test(product.name),
      ),
    )
  }
})
