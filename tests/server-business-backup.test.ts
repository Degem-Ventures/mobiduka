import assert from "node:assert/strict"
import { test } from "node:test"
import type { Prisma } from "@prisma/client"
import {
  restoreServerBusinessBackupSnapshot,
  validateServerBusinessBackupSnapshot,
} from "../lib/server-business-backup"

const businessId = "business-1"

type TestSnapshot = {
  businessId: string
  tables: Record<string, Array<Record<string, unknown>>>
  [key: string]: unknown
}

function emptySnapshot(): TestSnapshot {
  return {
    formatVersion: 1,
    backupType: "SERVER_BUSINESS",
    businessId,
    createdAt: new Date().toISOString(),
    tables: {
      business: [{ id: businessId }],
      businessSettings: [],
      licenses: [],
      roles: [],
      rolePermissions: [],
      users: [],
      shiftTypes: [],
      devices: [],
      categories: [],
      suppliers: [],
      products: [],
      scanEvents: [],
      purchaseOrders: [],
      purchaseItems: [],
      inventory: [],
      stockMovements: [],
      customers: [],
      creditAccounts: [],
      creditLedgerEntries: [],
      mpesaIntegrations: [],
      mpesaTransactions: [],
      mpesaSmsReceipts: [],
      sales: [],
      saleItems: [],
      payments: [],
      expenses: [],
      cashSessions: [],
      auditLogs: [],
      syncQueues: [],
      syncReceipts: [],
      notifications: [],
      notificationSubscriptions: [],
    },
  }
}

test("server backup snapshot validation accepts a business-scoped complete table set", () => {
  assert.equal(
    validateServerBusinessBackupSnapshot(emptySnapshot(), businessId),
    true,
  )
})

test("server backup snapshot validation accepts permissions for existing roles", () => {
  const snapshot = emptySnapshot()
  snapshot.tables.roles.push({ id: "role-1", businessId, name: "Accountant" })
  snapshot.tables.rolePermissions.push({
    roleId: "role-1",
    permissionKey: "export",
  })
  assert.equal(validateServerBusinessBackupSnapshot(snapshot, businessId), true)
})

test("server backup snapshot validation rejects a different tenant", () => {
  const snapshot = emptySnapshot()
  snapshot.businessId = "another-business"
  assert.equal(
    validateServerBusinessBackupSnapshot(snapshot, businessId),
    false,
  )
})

test("server backup snapshot validation rejects direct rows from another tenant", () => {
  const snapshot = emptySnapshot()
  snapshot.tables.products.push({
    id: "foreign-product",
    businessId: "another-business",
  })
  assert.equal(
    validateServerBusinessBackupSnapshot(snapshot, businessId),
    false,
  )
})

test("server backup snapshot validation rejects orphaned relation rows", () => {
  const snapshot = emptySnapshot()
  snapshot.tables.purchaseItems.push({
    id: "orphan-item",
    purchaseOrderId: "missing-order",
    productId: "missing-product",
  })
  assert.equal(
    validateServerBusinessBackupSnapshot(snapshot, businessId),
    false,
  )
})

test("server restore applies snapshot rows with batched upserts and without deletes", async () => {
  const snapshot = emptySnapshot()
  snapshot.tables.business = [
    {
      id: businessId,
      name: "Snapshot business",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    },
  ]
  snapshot.tables.roles = [
    { id: "role-1", businessId, name: "Manager" },
    { id: "role-2", businessId, name: "Cashier" },
  ]
  if (!validateServerBusinessBackupSnapshot(snapshot, businessId)) {
    assert.fail("Expected a valid business backup snapshot.")
  }

  const queries: Prisma.Sql[] = []
  const progress: Array<[number, number, string]> = []
  const transaction = new Proxy({}, {
    get: (_target, method: string) =>
      method === "$executeRaw"
        ? async (query: Prisma.Sql) => {
            queries.push(query)
          }
        : { update: async () => undefined },
  }) as Prisma.TransactionClient

  await restoreServerBusinessBackupSnapshot(
    transaction,
    snapshot,
    async (restoredRows, totalRows, tableName) => {
      progress.push([restoredRows, totalRows, tableName])
    },
  )

  assert.equal(queries.length, 2)
  assert.match(queries[0].sql, /INSERT INTO "Business"/)
  assert.match(queries[0].sql, /ON CONFLICT \("id"\) DO UPDATE SET/)
  assert.ok(
    queries[0].values.some(
      (value) =>
        value instanceof Date &&
        value.toISOString() === "2026-01-01T00:00:00.000Z",
    ),
  )
  assert.match(queries[1].sql, /INSERT INTO "Role"/)
  assert.equal(queries[1].values.length, 6)
  assert.deepEqual(progress, [
    [1, 3, "Business"],
    [3, 3, "Role"],
  ])
  assert.doesNotMatch(queries[0].sql, /DELETE FROM/)
})

test("server restore explicitly casts settings JSON fields to jsonb", async () => {
  const snapshot = emptySnapshot()
  snapshot.tables.businessSettings = [
    {
      id: "settings-1",
      businessId,
      paymentConfig: { cash: true },
      receiptConfig: null,
      taxConfig: { rate: 0.16 },
    },
  ]
  if (!validateServerBusinessBackupSnapshot(snapshot, businessId)) {
    assert.fail("Expected a valid business backup snapshot.")
  }

  const queries: Prisma.Sql[] = []
  const transaction = new Proxy({}, {
    get: (_target, method: string) =>
      method === "$executeRaw"
        ? async (query: Prisma.Sql) => {
            queries.push(query)
          }
        : { update: async () => undefined },
  }) as Prisma.TransactionClient

  await restoreServerBusinessBackupSnapshot(transaction, snapshot)

  const settingsQuery = queries.find((query) =>
    query.sql.includes('INSERT INTO "BusinessSettings"'),
  )
  assert.ok(settingsQuery)
  assert.match(settingsQuery.sql, /::jsonb/)
  assert.ok(settingsQuery.values.includes('{"cash":true}'))
  assert.ok(settingsQuery.values.includes('{"rate":0.16}'))
})

test("server restore casts sync receipt status to its PostgreSQL enum", async () => {
  const snapshot = emptySnapshot()
  snapshot.tables.syncReceipts = [
    {
      id: "receipt-1",
      businessId,
      entityName: "Sale",
      externalId: "offline-sale-1",
      payloadHash: "hash",
      status: "APPLIED",
      sourceDeviceId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ]
  if (!validateServerBusinessBackupSnapshot(snapshot, businessId)) {
    assert.fail("Expected a valid business backup snapshot.")
  }

  const queries: Prisma.Sql[] = []
  const transaction = new Proxy({}, {
    get: (_target, method: string) =>
      method === "$executeRaw"
        ? async (query: Prisma.Sql) => {
            queries.push(query)
          }
        : { update: async () => undefined },
  }) as Prisma.TransactionClient

  await restoreServerBusinessBackupSnapshot(transaction, snapshot)

  const receiptQuery = queries.find((query) =>
    query.sql.includes('INSERT INTO "SyncReceipt"'),
  )
  assert.ok(receiptQuery)
  assert.match(receiptQuery.sql, /::"SyncReceiptStatus"/)
  assert.ok(receiptQuery.values.includes("APPLIED"))
})
