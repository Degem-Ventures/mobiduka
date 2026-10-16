import { Prisma } from "@prisma/client"

const backupTableNames = [
  "businessSettings",
  "licenses",
  "roles",
  "users",
  "shiftTypes",
  "devices",
  "categories",
  "suppliers",
  "products",
  "scanEvents",
  "purchaseOrders",
  "purchaseItems",
  "inventory",
  "stockMovements",
  "customers",
  "creditAccounts",
  "creditLedgerEntries",
  "mpesaIntegrations",
  "mpesaTransactions",
  "mpesaSmsReceipts",
  "sales",
  "saleItems",
  "payments",
  "expenses",
  "cashSessions",
  "auditLogs",
  "syncQueues",
  "syncReceipts",
  "notifications",
  "notificationSubscriptions",
] as const

type BackupTableName = typeof backupTableNames[number]
type ServerBackupTables = Record<BackupTableName, Array<Record<string, unknown>>> & {
  business: Array<Record<string, unknown>>
  rolePermissions: Array<Record<string, unknown>>
}

export type ServerBusinessBackupSnapshot = {
  formatVersion: 1
  backupType: "SERVER_BUSINESS"
  businessId: string
  createdAt: string
  tables: ServerBackupTables
}

const indirectTenantTables = new Set([
  "rolePermissions",
  "purchaseItems",
  "stockMovements",
  "creditAccounts",
  "saleItems",
  "payments",
])

const dateFields = new Set([
  "createdAt",
  "updatedAt",
  "lastLogin",
  "startDate",
  "expiryDate",
  "lastSeen",
  "deletedAt",
  "dueDate",
  "lastStockTake",
  "lastPayment",
  "nextRetryAt",
  "syncedAt",
  "receivedAt",
  "openedAt",
  "closedAt",
  "timestamp",
])

function rows<T extends object>(items: T[]): Array<Record<string, unknown>> {
  return items.map((item) => Object.fromEntries(Object.entries(item)))
}

export async function createServerBusinessBackupSnapshot(
  transaction: Prisma.TransactionClient,
  businessId: string,
  onTableProgress?: (
    completed: number,
    total: number,
    tableName: string,
  ) => Promise<void>,
): Promise<ServerBusinessBackupSnapshot> {
  const tableCount = 32
  let completedTables = 0
  const trackTable = async <T>(tableName: string, query: Promise<T>) => {
    const result = await query
    completedTables += 1
    if (
      onTableProgress &&
      (completedTables % 2 === 0 || completedTables === tableCount)
    ) {
      await onTableProgress(completedTables, tableCount, tableName)
    }
    return result
  }
  const [
    business,
    businessSettings,
    licenses,
    roles,
    rolePermissions,
    users,
    shiftTypes,
    devices,
    categories,
    suppliers,
    products,
    scanEvents,
    purchaseOrders,
    purchaseItems,
    inventory,
    stockMovements,
    customers,
    creditAccounts,
    creditLedgerEntries,
    mpesaIntegrations,
    mpesaTransactions,
    mpesaSmsReceipts,
    sales,
    saleItems,
    payments,
    expenses,
    cashSessions,
    auditLogs,
    syncQueues,
    syncReceipts,
    notifications,
    notificationSubscriptions,
  ] = await Promise.all([
    trackTable(
      "business",
      transaction.business.findMany({ where: { id: businessId } }),
    ),
    trackTable(
      "settings",
      transaction.businessSettings.findMany({ where: { businessId } }),
    ),
    trackTable(
      "licenses",
      transaction.license.findMany({ where: { businessId } }),
    ),
    trackTable("roles", transaction.role.findMany({ where: { businessId } })),
    trackTable(
      "role permissions",
      transaction.rolePermission.findMany({ where: { role: { businessId } } }),
    ),
    trackTable("users", transaction.user.findMany({ where: { businessId } })),
    trackTable(
      "shift types",
      transaction.shiftType.findMany({ where: { businessId } }),
    ),
    trackTable(
      "devices",
      transaction.device.findMany({ where: { businessId } }),
    ),
    trackTable(
      "categories",
      transaction.category.findMany({ where: { businessId } }),
    ),
    trackTable(
      "suppliers",
      transaction.supplier.findMany({ where: { businessId } }),
    ),
    trackTable(
      "products",
      transaction.product.findMany({ where: { businessId } }),
    ),
    trackTable(
      "scan events",
      transaction.scanEvent.findMany({ where: { businessId } }),
    ),
    trackTable(
      "purchase orders",
      transaction.purchaseOrder.findMany({ where: { businessId } }),
    ),
    trackTable(
      "purchase items",
      transaction.purchaseItem.findMany({
        where: { purchaseOrder: { businessId } },
      }),
    ),
    trackTable(
      "inventory",
      transaction.inventory.findMany({ where: { businessId } }),
    ),
    trackTable(
      "stock movements",
      transaction.stockMovement.findMany({
        where: { product: { businessId } },
      }),
    ),
    trackTable(
      "customers",
      transaction.customer.findMany({ where: { businessId } }),
    ),
    trackTable(
      "credit accounts",
      transaction.creditAccount.findMany({
        where: { customer: { businessId } },
      }),
    ),
    trackTable(
      "credit ledger",
      transaction.creditLedgerEntry.findMany({ where: { businessId } }),
    ),
    trackTable(
      "M-Pesa integration",
      transaction.mpesaIntegration.findMany({ where: { businessId } }),
    ),
    trackTable(
      "M-Pesa transactions",
      transaction.mpesaTransaction.findMany({ where: { businessId } }),
    ),
    trackTable(
      "M-Pesa receipts",
      transaction.mpesaSmsReceipt.findMany({ where: { businessId } }),
    ),
    trackTable("sales", transaction.sale.findMany({ where: { businessId } })),
    trackTable(
      "sale items",
      transaction.saleItem.findMany({ where: { sale: { businessId } } }),
    ),
    trackTable(
      "payments",
      transaction.payment.findMany({ where: { sale: { businessId } } }),
    ),
    trackTable(
      "expenses",
      transaction.expense.findMany({ where: { businessId } }),
    ),
    trackTable(
      "cash sessions",
      transaction.cashSession.findMany({ where: { businessId } }),
    ),
    trackTable(
      "audit logs",
      transaction.auditLog.findMany({ where: { businessId } }),
    ),
    trackTable(
      "sync queue",
      transaction.syncQueue.findMany({ where: { businessId } }),
    ),
    trackTable(
      "sync receipts",
      transaction.syncReceipt.findMany({ where: { businessId } }),
    ),
    trackTable(
      "notifications",
      transaction.notification.findMany({ where: { businessId } }),
    ),
    trackTable(
      "notification subscriptions",
      transaction.notificationSubscription.findMany({ where: { businessId } }),
    ),
  ])

  return {
    formatVersion: 1,
    backupType: "SERVER_BUSINESS",
    businessId,
    createdAt: new Date().toISOString(),
    tables: {
      business: rows(business),
      businessSettings: rows(businessSettings),
      licenses: rows(licenses),
      roles: rows(roles),
      rolePermissions: rows(rolePermissions),
      users: rows(users),
      shiftTypes: rows(shiftTypes),
      devices: rows(devices),
      categories: rows(categories),
      suppliers: rows(suppliers),
      products: rows(products),
      scanEvents: rows(scanEvents),
      purchaseOrders: rows(purchaseOrders),
      purchaseItems: rows(purchaseItems),
      inventory: rows(inventory),
      stockMovements: rows(stockMovements),
      customers: rows(customers),
      creditAccounts: rows(creditAccounts),
      creditLedgerEntries: rows(creditLedgerEntries),
      mpesaIntegrations: rows(mpesaIntegrations),
      mpesaTransactions: rows(mpesaTransactions),
      mpesaSmsReceipts: rows(mpesaSmsReceipts),
      sales: rows(sales),
      saleItems: rows(saleItems),
      payments: rows(payments),
      expenses: rows(expenses),
      cashSessions: rows(cashSessions),
      auditLogs: rows(auditLogs),
      syncQueues: rows(syncQueues),
      syncReceipts: rows(syncReceipts),
      notifications: rows(notifications),
      notificationSubscriptions: rows(notificationSubscriptions),
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function hasBusinessId(rowsValue: unknown, businessId: string) {
  return (
    Array.isArray(rowsValue) &&
    rowsValue.every((row) => isRecord(row) && row.businessId === businessId)
  )
}

function records(value: unknown): Array<Record<string, unknown>> | null {
  return Array.isArray(value) && value.every(isRecord) ? value : null
}

function references(
  rowsValue: Array<Record<string, unknown>>,
  field: string,
  allowedIds: Set<string>,
  optional = false,
) {
  return rowsValue.every((row) => {
    const reference = row[field]
    return (
      (optional && reference == null) ||
      (typeof reference === "string" && allowedIds.has(reference))
    )
  })
}

export function validateServerBusinessBackupSnapshot(
  value: unknown,
  businessId: string,
): value is ServerBusinessBackupSnapshot {
  if (!isRecord(value) || !isRecord(value.tables)) return false
  const tables = value.tables
  if (
    value.formatVersion !== 1 ||
    value.backupType !== "SERVER_BUSINESS" ||
    value.businessId !== businessId ||
    typeof value.createdAt !== "string" ||
    !Number.isFinite(Date.parse(value.createdAt)) ||
    !Array.isArray(tables.business) ||
    tables.business.length !== 1 ||
    !isRecord(tables.business[0]) ||
    tables.business[0].id !== businessId ||
    !Array.isArray(tables.rolePermissions) ||
    !tables.rolePermissions.every(isRecord)
  ) {
    return false
  }

  for (const tableName of backupTableNames) {
    const tableRows = tables[tableName]
    if (!Array.isArray(tableRows) || !tableRows.every(isRecord)) return false
    if (
      !indirectTenantTables.has(tableName) &&
      !hasBusinessId(tableRows, businessId)
    ) {
      return false
    }
    const ids = new Set<string>()
    for (const row of tableRows) {
      if (typeof row.id !== "string" || row.id.length === 0 || ids.has(row.id))
        return false
      ids.add(row.id)
    }
  }
  if (!tables.business.every((row) => isRecord(row) && row.id === businessId))
    return false

  const roleRows = records(tables.roles)
  const productRows = records(tables.products)
  const purchaseOrderRows = records(tables.purchaseOrders)
  const customerRows = records(tables.customers)
  const saleRows = records(tables.sales)
  const rolePermissionRows = records(tables.rolePermissions)
  const purchaseItemRows = records(tables.purchaseItems)
  const stockMovementRows = records(tables.stockMovements)
  const creditAccountRows = records(tables.creditAccounts)
  const saleItemRows = records(tables.saleItems)
  const paymentRows = records(tables.payments)
  const userRows = records(tables.users)
  const shiftTypeRows = records(tables.shiftTypes)
  const deviceRows = records(tables.devices)
  const categoryRows = records(tables.categories)
  const supplierRows = records(tables.suppliers)
  const integrationRows = records(tables.mpesaIntegrations)
  const cashSessionRows = records(tables.cashSessions)
  const scanEventRows = records(tables.scanEvents)
  const inventoryRows = records(tables.inventory)
  const creditLedgerRows = records(tables.creditLedgerEntries)
  const mpesaTransactionRows = records(tables.mpesaTransactions)
  const notificationRows = records(tables.notifications)
  const notificationSubscriptionRows = records(tables.notificationSubscriptions)
  const syncQueueRows = records(tables.syncQueues)
  const auditLogRows = records(tables.auditLogs)
  const mpesaSmsReceiptRows = records(tables.mpesaSmsReceipts)
  if (
    !roleRows ||
    !productRows ||
    !purchaseOrderRows ||
    !customerRows ||
    !saleRows ||
    !rolePermissionRows ||
    !purchaseItemRows ||
    !stockMovementRows ||
    !creditAccountRows ||
    !saleItemRows ||
    !paymentRows ||
    !userRows ||
    !shiftTypeRows ||
    !deviceRows ||
    !categoryRows ||
    !supplierRows ||
    !integrationRows ||
    !cashSessionRows ||
    !scanEventRows ||
    !inventoryRows ||
    !creditLedgerRows ||
    !mpesaTransactionRows ||
    !notificationRows ||
    !notificationSubscriptionRows ||
    !syncQueueRows ||
    !auditLogRows ||
    !mpesaSmsReceiptRows
  )
    return false

  const roles = new Set(
    roleRows.flatMap((row) => (typeof row.id === "string" ? [row.id] : [])),
  )
  if (
    !rolePermissionRows.every(
      (row) =>
        typeof row.roleId === "string" &&
        typeof row.permissionKey === "string" &&
        roles.has(row.roleId),
    )
  )
    return false

  const products = new Set(
    productRows.flatMap((row) => (typeof row.id === "string" ? [row.id] : [])),
  )
  const purchaseOrders = new Set(
    purchaseOrderRows.flatMap((row) =>
      typeof row.id === "string" ? [row.id] : [],
    ),
  )
  const customers = new Set(
    customerRows.flatMap((row) => (typeof row.id === "string" ? [row.id] : [])),
  )
  const sales = new Set(
    saleRows.flatMap((row) => (typeof row.id === "string" ? [row.id] : [])),
  )
  const userIds = new Set(
    userRows.flatMap((row) => (typeof row.id === "string" ? [row.id] : [])),
  )
  const shiftTypeIds = new Set(
    shiftTypeRows.flatMap((row) =>
      typeof row.id === "string" ? [row.id] : [],
    ),
  )
  const deviceIds = new Set(
    deviceRows.flatMap((row) => (typeof row.id === "string" ? [row.id] : [])),
  )
  const categoryIds = new Set(
    categoryRows.flatMap((row) => (typeof row.id === "string" ? [row.id] : [])),
  )
  const supplierIds = new Set(
    supplierRows.flatMap((row) => (typeof row.id === "string" ? [row.id] : [])),
  )
  const integrationIds = new Set(
    integrationRows.flatMap((row) =>
      typeof row.id === "string" ? [row.id] : [],
    ),
  )
  const cashSessionIds = new Set(
    cashSessionRows.flatMap((row) =>
      typeof row.id === "string" ? [row.id] : [],
    ),
  )

  return (
    purchaseItemRows.every(
      (row) =>
        typeof row.purchaseOrderId === "string" &&
        purchaseOrders.has(row.purchaseOrderId),
    ) &&
    purchaseItemRows.every(
      (row) => typeof row.productId === "string" && products.has(row.productId),
    ) &&
    references(userRows, "roleId", roles, true) &&
    references(deviceRows, "userId", userIds, true) &&
    references(deviceRows, "currentCashSessionId", cashSessionIds, true) &&
    references(categoryRows, "parentCategoryId", categoryIds, true) &&
    references(productRows, "categoryId", categoryIds, true) &&
    references(productRows, "supplierId", supplierIds, true) &&
    references(scanEventRows, "productId", products, true) &&
    references(purchaseOrderRows, "supplierId", supplierIds, true) &&
    references(inventoryRows, "productId", products) &&
    references(stockMovementRows, "productId", products) &&
    references(stockMovementRows, "userId", userIds, true) &&
    creditAccountRows.every(
      (row) =>
        typeof row.customerId === "string" && customers.has(row.customerId),
    ) &&
    references(creditLedgerRows, "customerId", customers) &&
    references(
      mpesaTransactionRows,
      "mpesaIntegrationId",
      integrationIds,
      true,
    ) &&
    references(mpesaSmsReceiptRows, "customerId", customers, true) &&
    references(saleRows, "cashierId", userIds, true) &&
    references(saleRows, "cashSessionId", cashSessionIds, true) &&
    references(saleRows, "customerId", customers, true) &&
    references(cashSessionRows, "cashierId", userIds, true) &&
    references(cashSessionRows, "shiftTypeId", shiftTypeIds, true) &&
    saleItemRows.every(
      (row) => typeof row.saleId === "string" && sales.has(row.saleId),
    ) &&
    references(saleItemRows, "productId", products) &&
    paymentRows.every(
      (row) => typeof row.saleId === "string" && sales.has(row.saleId),
    ) &&
    references(notificationRows, "userId", userIds, true) &&
    references(notificationSubscriptionRows, "userId", userIds, true) &&
    references(auditLogRows, "userId", userIds, true) &&
    references(syncQueueRows, "deviceId", deviceIds, true)
  )
}

function quoteIdentifier(identifier: string) {
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new Error("Server backup contains an invalid database identifier.")
  }
  return `"${identifier}"`
}

async function upsertSnapshotRows(
  transaction: Prisma.TransactionClient,
  tableName: string,
  rows: Array<Record<string, unknown>>,
  conflictColumns: readonly string[] = ["id"],
  jsonColumns: readonly string[] = [],
  enumColumns: Readonly<Record<string, string>> = {},
  onBatchComplete?: (restoredRows: number) => Promise<void>,
) {
  const batchSize = 100
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize)
    const columns = Object.keys(batch[0])
    if (
      !conflictColumns.every((column) => columns.includes(column)) ||
      batch.some((row) => {
        const rowColumns = Object.keys(row)
        return (
          rowColumns.length !== columns.length ||
          columns.some(
            (column) => !Object.prototype.hasOwnProperty.call(row, column),
          )
        )
      })
    ) {
      throw new Error(
        `Server backup rows for ${tableName} have an invalid shape.`,
      )
    }
    const identifiers = columns.map((column) =>
      Prisma.raw(quoteIdentifier(column)),
    )
    const updateColumns = columns.filter(
      (column) => !conflictColumns.includes(column),
    )
    const values = batch.map(
      (row) =>
        Prisma.sql`(${Prisma.join(
          columns.map((column) =>
            jsonColumns.includes(column)
              ? row[column] === null
                ? Prisma.sql`NULL::jsonb`
                : Prisma.sql`${JSON.stringify(row[column])}::jsonb`
              : enumColumns[column]
                ? Prisma.sql`${row[column]}::${Prisma.raw(quoteIdentifier(enumColumns[column]))}`
                : Prisma.sql`${
                    typeof row[column] === "string" && dateFields.has(column)
                      ? new Date(row[column])
                      : row[column]
                  }`,
          ),
        )})`,
    )
    const conflictTarget = Prisma.join(
      conflictColumns.map((column) => Prisma.raw(quoteIdentifier(column))),
    )
    const updateClause = updateColumns.length
      ? Prisma.sql`DO UPDATE SET ${Prisma.join(
          updateColumns.map(
            (column) =>
              Prisma.sql`${Prisma.raw(quoteIdentifier(column))} = EXCLUDED.${Prisma.raw(quoteIdentifier(column))}`,
          ),
        )}`
      : Prisma.sql`DO NOTHING`
    const query = Prisma.sql`
      INSERT INTO ${Prisma.raw(quoteIdentifier(tableName))}
        (${Prisma.join(identifiers)})
      VALUES ${Prisma.join(values)}
      ON CONFLICT (${conflictTarget}) ${updateClause}
    `
    await transaction.$executeRaw(query)
    await onBatchComplete?.(batch.length)
  }
}

export async function restoreServerBusinessBackupSnapshot(
  transaction: Prisma.TransactionClient,
  snapshot: ServerBusinessBackupSnapshot,
  onProgress?: (
    restoredRows: number,
    totalRows: number,
    tableName: string,
  ) => Promise<void>,
) {
  const t = snapshot.tables
  const totalRows = Object.values(t).reduce(
    (total, tableRows) => total + tableRows.length,
    0,
  )
  let restoredRows = 0
  const upsert = (
    tableName: string,
    rows: Array<Record<string, unknown>>,
    conflictColumns: readonly string[] = ["id"],
    jsonColumns: readonly string[] = [],
    enumColumns: Readonly<Record<string, string>> = {},
  ) =>
    upsertSnapshotRows(
      transaction,
      tableName,
      rows,
      conflictColumns,
      jsonColumns,
      enumColumns,
      async (batchRows) => {
        restoredRows += batchRows
        await onProgress?.(restoredRows, totalRows, tableName)
      },
    )
  const count = Object.fromEntries([
    ["business", t.business.length],
    ...backupTableNames.map((name) => [name, t[name].length]),
    ["rolePermissions", t.rolePermissions.length],
  ])

  await upsert("Business", t.business)
  await upsert("Role", t.roles)
  await upsert("ShiftType", t.shiftTypes)
  await upsert(
    "Category",
    t.categories.map((row) => ({ ...row, parentCategoryId: null })),
  )
  await upsert("Supplier", t.suppliers)
  await upsert("User", t.users)
  await upsert("BusinessSettings", t.businessSettings, ["businessId"], [
    "paymentConfig",
    "receiptConfig",
    "taxConfig",
  ])
  await upsert("License", t.licenses)
  await upsert("RolePermission", t.rolePermissions, ["roleId", "permissionKey"])
  await upsert("MpesaIntegration", t.mpesaIntegrations, ["businessId"])
  const categoryParents = t.categories.filter(
    (row) => typeof row.parentCategoryId === "string",
  )
  for (const row of categoryParents) {
    if (
      typeof row.id !== "string" ||
      typeof row.parentCategoryId !== "string"
    ) {
      throw new Error("Server backup category relationship is invalid.")
    }
    await transaction.category.update({
      where: { id: row.id },
      data: { parentCategoryId: row.parentCategoryId },
    })
  }
  await upsert("Product", t.products)
  await upsert("Customer", t.customers)
  await upsert("PurchaseOrder", t.purchaseOrders)
  await upsert("CashSession", t.cashSessions)
  await upsert("Device", t.devices)
  await upsert("Inventory", t.inventory)
  await upsert("ScanEvent", t.scanEvents)
  await upsert("PurchaseItem", t.purchaseItems)
  await upsert("StockMovement", t.stockMovements)
  await upsert("CreditAccount", t.creditAccounts, ["customerId"])
  await upsert("CreditLedgerEntry", t.creditLedgerEntries)
  await upsert("MpesaTransaction", t.mpesaTransactions)
  await upsert("MpesaSmsReceipt", t.mpesaSmsReceipts)
  await upsert("Sale", t.sales)
  await upsert("SaleItem", t.saleItems)
  await upsert("Payment", t.payments)
  await upsert("Expense", t.expenses)
  await upsert("SyncQueue", t.syncQueues)
  await upsert("SyncReceipt", t.syncReceipts, ["id"], [], {
    status: "SyncReceiptStatus",
  })
  await upsert("Notification", t.notifications)
  await upsert("NotificationSubscription", t.notificationSubscriptions)
  await upsert("AuditLog", t.auditLogs)

  return count
}
