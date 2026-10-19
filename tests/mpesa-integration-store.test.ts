import assert from "node:assert/strict"
import test from "node:test"
import {
  assignMpesaTransactionIntegration,
  findMpesaIntegration,
  hasMpesaIntegration,
  mpesaTransactionIntegrationId,
  upsertMpesaIntegration,
} from "../lib/mpesa-integration-store.ts"

const integration = {
  id: "integration-1",
  businessId: "business-1",
  environment: "sandbox",
  accountType: "TILL",
  shortcode: "1316920",
  partyB: "1787049",
  accountReference: "MOBIDUKA",
  credentialCiphertext: "ciphertext",
  updatedAt: new Date("2026-10-02T00:00:00.000Z"),
}

test("uses the generated M-Pesa delegate when it is available", async () => {
  let lookup: unknown
  let upsert: unknown
  const client = {
    mpesaIntegration: {
      findUnique: async (args: unknown) => {
        lookup = args
        return integration
      },
      findFirst: async () => integration,
      upsert: async (args: unknown) => {
        upsert = args
        return integration
      },
    },
    $queryRaw: async () => {
      throw new Error("Raw fallback should not run")
    },
    $executeRaw: async () => 1,
  }

  assert.equal(
    await findMpesaIntegration("business-1", { environment: "sandbox" }, client),
    integration,
  )
  assert.deepEqual(lookup, {
    where: {
      businessId_environment: {
        businessId: "business-1",
        environment: "sandbox",
      },
    },
  })
  assert.equal(await hasMpesaIntegration("business-1", client), true)

  await upsertMpesaIntegration(
    {
      businessId: "business-1",
      environment: "production",
      accountType: "PAYBILL",
      shortcode: "654321",
      partyB: "222222",
      accountReference: "ORDER1",
      credentialCiphertext: "replacement",
    },
    client,
  )
  assert.deepEqual(upsert, {
    where: {
      businessId_environment: {
        businessId: "business-1",
        environment: "production",
      },
    },
    create: {
      businessId: "business-1",
      environment: "production",
      accountType: "PAYBILL",
      shortcode: "654321",
      partyB: "222222",
      accountReference: "ORDER1",
      credentialCiphertext: "replacement",
    },
    update: {
      environment: "production",
      accountType: "PAYBILL",
      shortcode: "654321",
      partyB: "222222",
      accountReference: "ORDER1",
      credentialCiphertext: "replacement",
    },
  })
})

test("prefers sandbox when no environment is selected", async () => {
  const sandboxIntegration = { ...integration, environment: "sandbox" }
  const productionIntegration = { ...integration, environment: "production" }
  const lookups: unknown[] = []
  const client = {
    mpesaIntegration: {
      findUnique: async () => null,
      findFirst: async (args: unknown) => {
        lookups.push(args)
        const environment = (args as { where: { environment?: string } }).where.environment
        if (environment === "sandbox") return sandboxIntegration
        if (environment === "production") return productionIntegration
        return null
      },
      upsert: async () => productionIntegration,
    },
    $queryRaw: async () => [],
    $executeRaw: async () => 1,
  }

  assert.equal(await findMpesaIntegration("business-1", {}, client), sandboxIntegration)
  assert.deepEqual(lookups, [
    { where: { businessId: "business-1", environment: "sandbox" } },
  ])

  lookups.length = 0
  const productionOnlyClient = {
    mpesaIntegration: {
      findUnique: async () => null,
      findFirst: async (args: unknown) => {
        return (args as { where: { environment?: string } }).where.environment === "production"
          ? productionIntegration
          : null
      },
      upsert: async () => productionIntegration,
    },
    $queryRaw: async () => [],
    $executeRaw: async () => 1,
  }
  assert.equal(
    await findMpesaIntegration("business-1", {}, productionOnlyClient),
    productionIntegration,
  )
})

test("uses parameterized raw queries only when the generated delegate is absent", async () => {
  const queries: Array<{
    sql: string
    values: unknown[]
  }> = []
  const updates: Array<{
    sql: string
    values: unknown[]
  }> = []
  const client = {
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      queries.push({ sql: strings.join("?"), values })
      if (strings.join("").includes('SELECT "mpesaIntegrationId"')) {
        return [{ mpesaIntegrationId: "integration-1" }]
      }
      return [integration]
    },
    $executeRaw: async (
      strings: TemplateStringsArray,
      ...values: unknown[]
    ) => {
      updates.push({ sql: strings.join("?"), values })
      return 1
    },
  }

  assert.equal(
    await findMpesaIntegration("business-1", { environment: "sandbox" }, client),
    integration,
  )
  assert.match(queries[0].sql, /SELECT "id", "businessId"/)
  assert.deepEqual(queries[0].values, ["business-1", "sandbox"])

  await upsertMpesaIntegration(
    {
      businessId: "business-1",
      environment: "sandbox",
      accountType: "TILL",
      shortcode: "1316920",
      partyB: "1787049",
      accountReference: "MOBIDUKA",
      credentialCiphertext: "ciphertext",
    },
    client,
  )
  assert.match(queries[1].sql, /INSERT INTO "MpesaIntegration"/)
  assert.deepEqual(queries[1].values.slice(1), [
    "business-1",
    "sandbox",
    "TILL",
    "1316920",
    "1787049",
    "MOBIDUKA",
    "ciphertext",
  ])

  await assignMpesaTransactionIntegration(
    "transaction-1",
    "integration-1",
    client,
  )
  assert.match(updates[0].sql, /UPDATE "MpesaTransaction"/)
  assert.deepEqual(updates[0].values, ["integration-1", "transaction-1"])

  assert.equal(
    await mpesaTransactionIntegrationId("transaction-1", client),
    "integration-1",
  )
})
