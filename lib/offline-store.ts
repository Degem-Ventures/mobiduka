"use client"

import { Capacitor } from "@capacitor/core"
import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from "@capacitor-community/sqlite"
import { apiFetch, ApiResponseError } from "./client-api"

const databaseName = "mobiduka_offline"
const sqlite = new SQLiteConnection(CapacitorSQLite)

let databasePromise: Promise<SQLiteDBConnection> | null = null

function isNativeApp() {
  return typeof window !== "undefined" && Capacitor.isNativePlatform()
}

export function isNativeOfflineApp() {
  return isNativeApp()
}

async function getDatabase() {
  if (!isNativeApp()) return null
  if (!databasePromise) {
    databasePromise = (async () => {
      await sqlite.checkConnectionsConsistency()
      const { result: hasConnection } = await sqlite.isConnection(
        databaseName,
        false,
      )
      const database = hasConnection
        ? await sqlite.retrieveConnection(databaseName, false)
        : await sqlite.createConnection(
            databaseName,
            false,
            "no-encryption",
            1,
            false,
          )
      await database.open()
      await database.execute(`
        CREATE TABLE IF NOT EXISTS offline_collection_cache (
          business_id TEXT NOT NULL,
          cache_key TEXT NOT NULL,
          payload TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (business_id, cache_key)
        );
        CREATE TABLE IF NOT EXISTS sync_outbox (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          entity_name TEXT NOT NULL,
          operation TEXT NOT NULL,
          external_id TEXT NOT NULL,
          payload TEXT NOT NULL,
          payload_hash TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'PENDING',
          attempt_count INTEGER NOT NULL DEFAULT 0,
          next_retry_at TEXT,
          last_error TEXT,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_sync_outbox_pending
          ON sync_outbox (business_id, status, created_at);
      `)
      return database
    })().catch((error: unknown) => {
      databasePromise = null
      throw error
    })
  }
  return databasePromise
}

export async function readOfflineCollection<T>(
  businessId: string,
  cacheKey: string,
): Promise<T | null> {
  const database = await getDatabase()
  if (!database) return null
  const result = await database.query(
    "SELECT payload FROM offline_collection_cache WHERE business_id = ? AND cache_key = ?",
    [businessId, cacheKey],
  )
  const payload = result.values?.[0]?.payload
  if (typeof payload !== "string") return null
  return JSON.parse(payload) as T
}

export async function readOfflineCollectionUpdatedAt(
  businessId: string,
  cacheKey: string,
): Promise<string | null> {
  const database = await getDatabase()
  if (!database) return null
  const result = await database.query(
    "SELECT updated_at FROM offline_collection_cache WHERE business_id = ? AND cache_key = ?",
    [businessId, cacheKey],
  )
  const updatedAt = result.values?.[0]?.updated_at
  return typeof updatedAt === "string" ? updatedAt : null
}

export async function writeOfflineCollection(
  businessId: string,
  cacheKey: string,
  value: unknown,
): Promise<void> {
  const database = await getDatabase()
  if (!database) return
  await database.run(
    `INSERT INTO offline_collection_cache (business_id, cache_key, payload, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (business_id, cache_key) DO UPDATE SET
       payload = excluded.payload,
       updated_at = excluded.updated_at`,
    [businessId, cacheKey, JSON.stringify(value), new Date().toISOString()],
  )
}

export async function fetchCachedCollection<T>(
  businessId: string,
  cacheKey: string,
  path: string,
): Promise<T> {
  try {
    const payload = await apiFetch<T>(path)
    try {
      await writeOfflineCollection(businessId, cacheKey, payload)
    } catch (error) {
      console.error(`Unable to cache ${cacheKey} for offline use.`, error)
    }
    return payload
  } catch (error) {
    const canUseCache =
      error instanceof TypeError ||
      (error instanceof ApiResponseError && error.status >= 500)
    if (!canUseCache || !isNativeApp()) throw error
    const cached = await readOfflineCollection<T>(businessId, cacheKey)
    if (cached !== null) return cached
    throw new Error(
      "This information is not available offline yet. Connect to the internet once to load it.",
    )
  }
}

export type OfflineCashSale = {
  businessId: string
  cashierId: string
  cashSessionId: string
  saleNumber: string
  subtotal: number
  discount: number
  total: number
  items: Array<{
    productId: string
    name: string
    quantity: number
    unitPrice: number
    total: number
  }>
}

export async function commitOfflineCashSale(sale: OfflineCashSale) {
  const database = await getDatabase()
  if (!database) {
    throw new Error("Offline sales are only available in the native app.")
  }
  if (
    !sale.businessId ||
    !sale.cashierId ||
    !sale.cashSessionId ||
    sale.items.length === 0
  ) {
    throw new Error("An active cashier, shift, and sale items are required.")
  }

  const now = new Date().toISOString()
  const saleId = crypto.randomUUID()
  const saleNumber = sale.saleNumber || `OFFLINE-${saleId}`
  const payload = {
    id: saleId,
    businessId: sale.businessId,
    cashierId: sale.cashierId,
    userId: sale.cashierId,
    cashSessionId: sale.cashSessionId,
    saleNumber,
    subtotal: sale.subtotal,
    discount: sale.discount,
    tax: 0,
    total: sale.total,
    paymentMethod: "CASH",
    paymentStatus: "PAID",
    saleStatus: "COMPLETED",
    items: sale.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total,
    })),
    createdAt: now,
  }
  const payloadJson = JSON.stringify(payload)
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(payloadJson),
  )
  const payloadHash = Array.from(new Uint8Array(hashBuffer), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("")

  await database.execute("BEGIN IMMEDIATE;", false)
  try {
    const cached = await database.query(
      `SELECT payload FROM offline_collection_cache
       WHERE business_id = ? AND cache_key = 'pos.products.v1'`,
      [sale.businessId],
    )
    const rawProducts = cached.values?.[0]?.payload
    if (typeof rawProducts !== "string") {
      throw new Error(
        "Load the product catalogue online before selling offline.",
      )
    }
    const products = JSON.parse(rawProducts) as Array<{
      id: string
      inventory?: { quantity?: number | null } | null
    }>
    const quantitiesByProduct = new Map<string, number>()
    for (const item of sale.items) {
      const product = products.find((row) => row.id === item.productId)
      if (!product) {
        throw new Error(
          `Product ${item.name} is not available in the local catalogue.`,
        )
      }
      quantitiesByProduct.set(
        item.productId,
        (quantitiesByProduct.get(item.productId) ?? 0) + item.quantity,
      )
    }
    for (const [productId, quantity] of quantitiesByProduct) {
      const product = products.find((row) => row.id === productId)
      if (!product) continue
      const available = Number(product.inventory?.quantity ?? 0)
      if (quantity > available) {
        const name =
          sale.items.find((item) => item.productId === productId)?.name ??
          product.id
        throw new Error(
          `${name} has only ${available} units in the last downloaded stock. Refresh the catalogue online before selling more.`,
        )
      }
    }

    for (const [productId, quantity] of quantitiesByProduct) {
      const product = products.find((row) => row.id === productId)
      if (!product) continue
      product.inventory = {
        quantity: Number(product.inventory?.quantity ?? 0) - quantity,
      }
    }

    await database.run(
      `UPDATE offline_collection_cache
       SET payload = ?, updated_at = ?
       WHERE business_id = ? AND cache_key = 'pos.products.v1'`,
      [JSON.stringify(products), now, sale.businessId],
      false,
    )
    await database.run(
      `INSERT INTO sync_outbox (
         id, business_id, entity_name, operation, external_id, payload,
         payload_hash, status, created_at, next_retry_at
       ) VALUES (?, ?, 'Sale', 'CREATE', ?, ?, ?, 'PENDING', ?, ?)`,
      [saleId, sale.businessId, saleId, payloadJson, payloadHash, now, now],
      false,
    )
    await database.execute("COMMIT;", false)
    return { id: saleId, saleNumber, createdAt: now }
  } catch (error) {
    await database.execute("ROLLBACK;", false)
    throw error
  }
}

let syncInProgress: Promise<void> | null = null

export async function syncPendingOfflineSales(
  businessId: string,
  userId: string,
): Promise<void> {
  if (!isNativeApp()) return
  if (syncInProgress) return syncInProgress
  syncInProgress = (async () => {
    const database = await getDatabase()
    if (!database) return
    const now = new Date().toISOString()
    const result = await database.query(
      `SELECT id, entity_name, operation, external_id, payload, payload_hash, created_at, attempt_count
       FROM sync_outbox
       WHERE business_id = ? AND status = 'PENDING'
         AND (next_retry_at IS NULL OR next_retry_at <= ?)
       ORDER BY created_at ASC LIMIT 25`,
      [businessId, now],
    )
    const rows = result.values ?? []
    if (rows.length === 0) return

    const records = rows.map((row) => ({
      id: String(row.id),
      entityName: String(row.entity_name),
      operation: String(row.operation),
      externalId: String(row.external_id),
      payloadHash: String(row.payload_hash),
      payload: JSON.parse(String(row.payload)) as Record<string, unknown>,
      createdAt: String(row.created_at),
    }))
    try {
      const response = await apiFetch<{
        success: boolean
        processedIds: string[]
      }>("/api/sync", {
        method: "POST",
        body: JSON.stringify({
          businessId,
          deviceId: window.localStorage.getItem(
            `mobiduka.registered_device.v1:${businessId}`,
          ),
          userId,
          records,
        }),
      })
      const acknowledgedIds = new Set(response.processedIds)
      for (const row of rows) {
        const id = String(row.id)
        if (!acknowledgedIds.has(id)) continue
        await database.run("DELETE FROM sync_outbox WHERE id = ?", [id])
      }
    } catch (error) {
      for (const row of rows) {
        const attemptCount = Number(row.attempt_count ?? 0) + 1
        const terminalFailure = attemptCount >= 10
        const backoffSeconds = Math.min(3600, 5 * 2 ** attemptCount)
        const retryAt = terminalFailure
          ? null
          : new Date(Date.now() + backoffSeconds * 1000).toISOString()
        await database.run(
          `UPDATE sync_outbox
           SET status = ?, attempt_count = ?, next_retry_at = ?, last_error = ?
           WHERE id = ?`,
          [
            terminalFailure ? "FAILED" : "PENDING",
            attemptCount,
            retryAt,
            String(error),
            String(row.id),
          ],
        )
      }
      throw error
    }
  })().finally(() => {
    syncInProgress = null
  })
  return syncInProgress
}

export async function getOfflineSaleSyncStatus(businessId: string) {
  const database = await getDatabase()
  if (!database) return { pending: 0, failed: 0, lastError: null }
  const [pendingResult, failedResult, errorResult] = await Promise.all([
    database.query(
      `SELECT COUNT(*) AS count FROM sync_outbox
       WHERE business_id = ? AND status = 'PENDING'`,
      [businessId],
    ),
    database.query(
      `SELECT COUNT(*) AS count FROM sync_outbox
       WHERE business_id = ? AND status = 'FAILED'`,
      [businessId],
    ),
    database.query(
      `SELECT last_error FROM sync_outbox
       WHERE business_id = ? AND status = 'FAILED'
       ORDER BY created_at DESC LIMIT 1`,
      [businessId],
    ),
  ])
  return {
    pending: Number(pendingResult.values?.[0]?.count ?? 0),
    failed: Number(failedResult.values?.[0]?.count ?? 0),
    lastError:
      typeof errorResult.values?.[0]?.last_error === "string"
        ? errorResult.values[0].last_error
        : null,
  }
}

export async function retryFailedOfflineSales(businessId: string) {
  const database = await getDatabase()
  if (!database) return
  await database.run(
    `UPDATE sync_outbox
     SET status = 'PENDING', attempt_count = 0, next_retry_at = ?, last_error = NULL
     WHERE business_id = ? AND status = 'FAILED'`,
    [new Date().toISOString(), businessId],
  )
}
