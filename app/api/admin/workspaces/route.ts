import { NextResponse } from "next/server.js"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin } from "@/lib/platform-admin"
import { effectiveSubscriptionStatus } from "@/lib/subscriptions"

const pageSize = 50
const noStore = { "Cache-Control": "no-store" }

type WorkspaceMetric = {
  label: string
  value: string
  note: string
}

function formatDate(value: Date | null | undefined) {
  return value ? value.toISOString() : "—"
}

function formatAmount(amount: number, currency?: string | null) {
  return `${currency || "Currency unknown"} ${amount.toLocaleString("en-KE")}`
}

function maskPhone(phone: string | null) {
  if (!phone) return "—"
  return `${phone.slice(0, 3)}${"•".repeat(Math.max(0, phone.length - 6))}${phone.slice(-3)}`
}

function makeResponse(
  workspace: string,
  columns: string[],
  rows: string[][],
  total: number,
  page: number,
  metrics: WorkspaceMetric[],
) {
  return NextResponse.json(
    {
      workspace,
      columns,
      rows,
      total,
      page,
      pageSize,
      metrics,
      generatedAt: new Date().toISOString(),
    },
    { headers: noStore },
  )
}

export async function GET(request: Request) {
  const admin = await requirePlatformAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: "SUPER_ADMIN access is required." }, {
      status: 403,
      headers: noStore,
    })
  }

  const params = new URL(request.url).searchParams
  const workspace = params.get("workspace") ?? ""
  const query = params.get("q")?.trim().slice(0, 100) ?? ""
  const requestedPage = Number.parseInt(params.get("page") ?? "1", 10)
  const page = Number.isSafeInteger(requestedPage)
    ? Math.min(1_000_000, Math.max(1, requestedPage))
    : 1
  const skip = (page - 1) * pageSize

  try {
    switch (workspace) {
      case "transactions": {
        const [sales, total, completed, failed] = await Promise.all([
          prisma.sale.findMany({
            orderBy: { createdAt: "desc" },
            skip,
            take: pageSize,
            select: {
              id: true,
              saleNumber: true,
              total: true,
              saleStatus: true,
              paymentStatus: true,
              createdAt: true,
              business: {
                select: { name: true, branch: true, currency: true },
              },
              payments: {
                select: {
                  amount: true,
                  reference: true,
                  paymentMethod: { select: { name: true } },
                },
              },
            },
          }),
          prisma.sale.count(),
          prisma.sale.count({ where: { saleStatus: "COMPLETED" } }),
          prisma.sale.count({ where: { saleStatus: "CANCELLED" } }),
        ])
        return makeResponse(
          workspace,
          [
            "Date",
            "Sale",
            "Business",
            "Method",
            "Amount",
            "Sale status",
            "Payment status",
          ],
          sales.map((sale) => [
            formatDate(sale.createdAt),
            sale.saleNumber ?? sale.id,
            sale.business.branch
              ? `${sale.business.name} · ${sale.business.branch}`
              : sale.business.name,
            [
              ...new Set(
                sale.payments.map((payment) => payment.paymentMethod.name),
              ),
            ].join(", ") || "—",
            formatAmount(sale.total, sale.business.currency),
            sale.saleStatus,
            sale.paymentStatus,
          ]),
          total,
          page,
          [
            {
              label: "Sales records",
              value: total.toLocaleString(),
              note: "All stored sales",
            },
            {
              label: "Completed",
              value: completed.toLocaleString(),
              note: "All time",
            },
            {
              label: "Cancelled",
              value: failed.toLocaleString(),
              note: "All time",
            },
          ],
        )
      }
      case "sync-health": {
        const [records, total, grouped, receiptsPending] = await Promise.all([
          prisma.syncQueue.findMany({
            orderBy: { createdAt: "desc" },
            skip,
            take: pageSize,
            select: {
              id: true,
              tableName: true,
              operation: true,
              status: true,
              createdAt: true,
              syncedAt: true,
              business: { select: { name: true, branch: true } },
              device: { select: { deviceName: true, deviceUuid: true } },
            },
          }),
          prisma.syncQueue.count(),
          prisma.syncQueue.groupBy({ by: ["status"], _count: { _all: true } }),
          prisma.syncReceipt.count({ where: { status: "RECEIVED" } }),
        ])
        return makeResponse(
          workspace,
          [
            "Created",
            "Business",
            "Device",
            "Entity",
            "Operation",
            "Status",
            "Synced",
          ],
          records.map((record) => [
            formatDate(record.createdAt),
            record.business.branch
              ? `${record.business.name} · ${record.business.branch}`
              : record.business.name,
            record.device?.deviceName ?? record.device?.deviceUuid ?? "—",
            record.tableName,
            record.operation,
            record.status,
            formatDate(record.syncedAt),
          ]),
          total,
          page,
          [
            {
              label: "Queue records",
              value: total.toLocaleString(),
              note: "All stored sync operations",
            },
            ...grouped.slice(0, 2).map((entry) => ({
              label: entry.status,
              value: entry._count._all.toLocaleString(),
              note: "Queue status count",
            })),
            {
              label: "Received receipts",
              value: receiptsPending.toLocaleString(),
              note: "Receipt state is RECEIVED",
            },
          ],
        )
      }
      case "devices": {
        const [devices, total, active, sessions] = await Promise.all([
          prisma.device.findMany({
            orderBy: { lastSeen: "desc" },
            skip,
            take: pageSize,
            select: {
              id: true,
              deviceName: true,
              deviceModel: true,
              platform: true,
              status: true,
              lastSeen: true,
              business: { select: { name: true, branch: true } },
              user: { select: { fullName: true } },
            },
          }),
          prisma.device.count(),
          prisma.device.count({ where: { status: "ACTIVE" } }),
          prisma.cashSession.count({ where: { closedAt: null } }),
        ])
        return makeResponse(
          workspace,
          [
            "Device",
            "Model",
            "Platform",
            "Business",
            "Assigned user",
            "Last seen",
            "Status",
          ],
          devices.map((device) => [
            device.deviceName ?? device.id,
            device.deviceModel ?? "—",
            device.platform ?? "—",
            device.business.branch
              ? `${device.business.name} · ${device.business.branch}`
              : device.business.name,
            device.user?.fullName ?? "—",
            formatDate(device.lastSeen),
            device.status,
          ]),
          total,
          page,
          [
            {
              label: "Registered devices",
              value: total.toLocaleString(),
              note: "All stored devices",
            },
            {
              label: "Active status",
              value: active.toLocaleString(),
              note: "Device status is ACTIVE",
            },
            {
              label: "Open cash sessions",
              value: sessions.toLocaleString(),
              note: "Not equivalent to authenticated sessions",
            },
          ],
        )
      }
      case "tenant-health": {
        const businessWhere: Prisma.BusinessWhereInput = query
          ? {
              OR: [
                { id: { contains: query, mode: "insensitive" } },
                { name: { contains: query, mode: "insensitive" } },
                { branch: { contains: query, mode: "insensitive" } },
              ],
            }
          : {}
        const [businesses, total, businessCount, active, users, devices] =
          await Promise.all([
            prisma.business.findMany({
              where: businessWhere,
              orderBy: { updatedAt: "desc" },
              skip,
              take: pageSize,
              select: {
                id: true,
                name: true,
                branch: true,
                status: true,
                updatedAt: true,
                platformSubscription: { select: { status: true } },
                _count: {
                  select: { users: true, devices: true, syncQueues: true },
                },
              },
            }),
            prisma.business.count({ where: businessWhere }),
            prisma.business.count(),
            prisma.business.count({ where: { status: "ACTIVE" } }),
            prisma.user.count(),
            prisma.device.count(),
          ])
        return makeResponse(
          workspace,
          [
            "Business",
            "Users",
            "Devices",
            "Sync records",
            "Subscription",
            "Business status",
            "Updated",
          ],
          businesses.map((business) => [
            business.branch
              ? `${business.name} · ${business.branch}`
              : business.name,
            business._count.users.toString(),
            business._count.devices.toString(),
            business._count.syncQueues.toString(),
            business.platformSubscription?.status ?? "No subscription record",
            business.status,
            formatDate(business.updatedAt),
          ]),
          total,
          page,
          [
            {
              label: "Businesses",
              value: businessCount.toLocaleString(),
              note: "All tenants",
            },
            {
              label: "Active businesses",
              value: active.toLocaleString(),
              note: "Business status is ACTIVE",
            },
            {
              label: "Users",
              value: users.toLocaleString(),
              note: "Registered users",
            },
            {
              label: "Devices",
              value: devices.toLocaleString(),
              note: "Registered devices",
            },
          ],
        )
      }
      case "roles": {
        const [roles, total, permissionCount] = await Promise.all([
          prisma.role.findMany({
            orderBy: [{ business: { name: "asc" } }, { name: "asc" }],
            skip,
            take: pageSize,
            select: {
              name: true,
              description: true,
              isSystem: true,
              business: { select: { name: true, branch: true } },
              _count: { select: { users: true, permissions: true } },
            },
          }),
          prisma.role.count(),
          prisma.rolePermission.count(),
        ])
        return makeResponse(
          workspace,
          [
            "Role",
            "Business",
            "Description",
            "Users",
            "Permissions",
            "System role",
          ],
          roles.map((role) => [
            role.name,
            role.business.branch
              ? `${role.business.name} · ${role.business.branch}`
              : role.business.name,
            role.description ?? "—",
            role._count.users.toString(),
            role._count.permissions.toString(),
            role.isSystem ? "Yes" : "No",
          ]),
          total,
          page,
          [
            {
              label: "Stored roles",
              value: total.toLocaleString(),
              note: "Across all businesses",
            },
            {
              label: "Permission assignments",
              value: permissionCount.toLocaleString(),
              note: "Stored role permissions",
            },
          ],
        )
      }
      case "security": {
        const [admins, totalAdmins, activeAdmins, auditCount] =
          await Promise.all([
            prisma.platformAdmin.findMany({
              orderBy: { createdAt: "desc" },
              skip,
              take: pageSize,
              select: { email: true, status: true, createdAt: true },
            }),
            prisma.platformAdmin.count(),
            prisma.platformAdmin.count({ where: { status: "ACTIVE" } }),
            prisma.auditLog.count(),
          ])
        return makeResponse(
          workspace,
          ["Platform admin", "Status", "Created"],
          admins.map((platformAdmin) => [
            platformAdmin.email,
            platformAdmin.status,
            formatDate(platformAdmin.createdAt),
          ]),
          totalAdmins,
          page,
          [
            {
              label: "Platform admin accounts",
              value: totalAdmins.toLocaleString(),
              note: "Stored administrator accounts",
            },
            {
              label: "Active accounts",
              value: activeAdmins.toLocaleString(),
              note: "Status is ACTIVE",
            },
            {
              label: "Business audit records",
              value: auditCount.toLocaleString(),
              note: "Audit records exist, but no security-event classification is stored",
            },
          ],
        )
      }
      case "audit-logs": {
        const [logs, total, businesses] = await Promise.all([
          prisma.auditLog.findMany({
            orderBy: { timestamp: "desc" },
            skip,
            take: pageSize,
            select: {
              action: true,
              tableName: true,
              recordId: true,
              timestamp: true,
              business: { select: { name: true, branch: true } },
              user: { select: { fullName: true, email: true } },
            },
          }),
          prisma.auditLog.count(),
          prisma.auditLog.groupBy({
            by: ["businessId"],
            _count: { _all: true },
          }),
        ])
        return makeResponse(
          workspace,
          ["Time", "Business", "User", "Action", "Table", "Record"],
          logs.map((log) => [
            formatDate(log.timestamp),
            log.business.branch
              ? `${log.business.name} · ${log.business.branch}`
              : log.business.name,
            log.user?.fullName ?? log.user?.email ?? "Unknown user",
            log.action,
            log.tableName ?? "—",
            log.recordId ?? "—",
          ]),
          total,
          page,
          [
            {
              label: "Audit records",
              value: total.toLocaleString(),
              note: "Stored business audit logs",
            },
            {
              label: "Businesses represented",
              value: businesses.length.toLocaleString(),
              note: "With at least one audit record",
            },
          ],
        )
      }
      case "subscriptions": {
        const [subscriptions, total, grouped] = await Promise.all([
          prisma.platformSubscription.findMany({
            orderBy: { updatedAt: "desc" },
            skip,
            take: pageSize,
            select: {
              planType: true,
              status: true,
              trialEndsAt: true,
              currentPeriodEndsAt: true,
              graceEndsAt: true,
              licenseCost: true,
              autoRenewActive: true,
              business: {
                select: { name: true, branch: true, currency: true },
              },
            },
          }),
          prisma.platformSubscription.count(),
          prisma.platformSubscription.groupBy({
            by: ["status"],
            _count: { _all: true },
          }),
        ])
        return makeResponse(
          workspace,
          [
            "Business",
            "Plan",
            "Status",
            "License cost",
            "Trial ends",
            "Period ends",
            "Auto renew",
          ],
          subscriptions.map((subscription) => [
            subscription.business.branch
              ? `${subscription.business.name} · ${subscription.business.branch}`
              : subscription.business.name,
            subscription.planType,
            effectiveSubscriptionStatus(subscription),
            formatAmount(
              subscription.licenseCost,
              subscription.business.currency,
            ),
            formatDate(subscription.trialEndsAt),
            formatDate(
              subscription.currentPeriodEndsAt ?? subscription.graceEndsAt,
            ),
            subscription.autoRenewActive ? "Enabled" : "Disabled",
          ]),
          total,
          page,
          grouped.map((entry) => ({
            label: entry.status,
            value: entry._count._all.toLocaleString(),
            note: "Stored status; expiry is reflected in the table",
          })),
        )
      }
      case "mpesa": {
        const [transactions, total, grouped] = await Promise.all([
          prisma.mpesaTransaction.findMany({
            orderBy: { createdAt: "desc" },
            skip,
            take: pageSize,
            select: {
              amount: true,
              accountReference: true,
              checkoutRequestId: true,
              status: true,
              receiptNumber: true,
              createdAt: true,
              business: {
                select: { name: true, branch: true, currency: true },
              },
            },
          }),
          prisma.mpesaTransaction.count(),
          prisma.mpesaTransaction.groupBy({
            by: ["status"],
            _count: { _all: true },
          }),
        ])
        return makeResponse(
          workspace,
          [
            "Time",
            "Business",
            "Amount",
            "Account reference",
            "Checkout request",
            "Receipt",
            "Status",
          ],
          transactions.map((transaction) => [
            formatDate(transaction.createdAt),
            transaction.business.branch
              ? `${transaction.business.name} · ${transaction.business.branch}`
              : transaction.business.name,
            formatAmount(transaction.amount, transaction.business.currency),
            transaction.accountReference,
            transaction.checkoutRequestId,
            transaction.receiptNumber ?? "—",
            transaction.status,
          ]),
          total,
          page,
          grouped.map((entry) => ({
            label: entry.status,
            value: entry._count._all.toLocaleString(),
            note: "M-PESA transaction status",
          })),
        )
      }
      case "reconciliation": {
        const [receipts, total, matched, unmatched] = await Promise.all([
          prisma.mpesaSmsReceipt.findMany({
            orderBy: { createdAt: "desc" },
            skip,
            take: pageSize,
            select: {
              receiptCode: true,
              senderPhone: true,
              customerName: true,
              amount: true,
              isMatched: true,
              createdAt: true,
              business: {
                select: { name: true, branch: true, currency: true },
              },
            },
          }),
          prisma.mpesaSmsReceipt.count(),
          prisma.mpesaSmsReceipt.count({ where: { isMatched: true } }),
          prisma.mpesaSmsReceipt.count({ where: { isMatched: false } }),
        ])
        return makeResponse(
          workspace,
          [
            "Received",
            "Business",
            "Receipt",
            "Amount",
            "Customer",
            "Sender",
            "Matched",
          ],
          receipts.map((receipt) => [
            formatDate(receipt.createdAt),
            receipt.business.branch
              ? `${receipt.business.name} · ${receipt.business.branch}`
              : receipt.business.name,
            receipt.receiptCode,
            formatAmount(receipt.amount, receipt.business.currency),
            receipt.customerName ?? "—",
            maskPhone(receipt.senderPhone),
            receipt.isMatched ? "Matched" : "Unmatched",
          ]),
          total,
          page,
          [
            {
              label: "Receipts",
              value: total.toLocaleString(),
              note: "Stored M-PESA SMS receipts",
            },
            {
              label: "Matched",
              value: matched.toLocaleString(),
              note: "Receipt matched flag is true",
            },
            {
              label: "Unmatched",
              value: unmatched.toLocaleString(),
              note: "Receipt matched flag is false",
            },
          ],
        )
      }
      case "payment-events": {
        const [payments, total, methods] = await Promise.all([
          prisma.payment.findMany({
            orderBy: { receivedAt: "desc" },
            skip,
            take: pageSize,
            select: {
              amount: true,
              reference: true,
              receivedAt: true,
              paymentMethod: { select: { name: true } },
              sale: {
                select: {
                  saleNumber: true,
                  business: {
                    select: { name: true, branch: true, currency: true },
                  },
                },
              },
            },
          }),
          prisma.payment.count(),
          prisma.paymentMethod.findMany({
            select: { name: true, _count: { select: { payments: true } } },
          }),
        ])
        return makeResponse(
          workspace,
          ["Received", "Business", "Sale", "Method", "Reference", "Amount"],
          payments.map((payment) => [
            formatDate(payment.receivedAt),
            payment.sale.business.branch
              ? `${payment.sale.business.name} · ${payment.sale.business.branch}`
              : payment.sale.business.name,
            payment.sale.saleNumber ?? "—",
            payment.paymentMethod.name,
            payment.reference ?? "—",
            formatAmount(payment.amount, payment.sale.business.currency),
          ]),
          total,
          page,
          [
            {
              label: "Payment records",
              value: total.toLocaleString(),
              note: "Payments recorded against sales",
            },
            {
              label: "Payment methods",
              value: methods.length.toLocaleString(),
              note: "Configured methods",
            },
          ],
        )
      }
      case "backups": {
        const [backups, total, grouped] = await Promise.all([
          prisma.cloudBackup.findMany({
            orderBy: { createdAt: "desc" },
            skip,
            take: pageSize,
            select: {
              backupType: true,
              triggerType: true,
              status: true,
              chunkCount: true,
              compressedBytes: true,
              recordCount: true,
              retryCount: true,
              failureReason: true,
              createdAt: true,
              completedAt: true,
              business: { select: { name: true, branch: true } },
            },
          }),
          prisma.cloudBackup.count(),
          prisma.cloudBackup.groupBy({
            by: ["status"],
            _count: { _all: true },
          }),
        ])
        return makeResponse(
          workspace,
          [
            "Created",
            "Business",
            "Type",
            "Trigger",
            "Status",
            "Records",
            "Chunks",
            "Retry count",
            "Completed",
          ],
          backups.map((backup) => [
            formatDate(backup.createdAt),
            backup.business.branch
              ? `${backup.business.name} · ${backup.business.branch}`
              : backup.business.name,
            backup.backupType,
            backup.triggerType,
            backup.failureReason
              ? `${backup.status}: ${backup.failureReason}`
              : backup.status,
            backup.recordCount?.toString() ?? "—",
            backup.chunkCount.toString(),
            backup.retryCount.toString(),
            formatDate(backup.completedAt),
          ]),
          total,
          page,
          grouped.map((entry) => ({
            label: entry.status,
            value: entry._count._all.toLocaleString(),
            note: "Stored backup status",
          })),
        )
      }
      case "notifications": {
        const [notifications, total, unread] = await Promise.all([
          prisma.notification.findMany({
            where: { deletedAt: null },
            orderBy: { createdAt: "desc" },
            skip,
            take: pageSize,
            select: {
              title: true,
              type: true,
              isRead: true,
              message: true,
              createdAt: true,
              business: { select: { name: true, branch: true } },
              user: { select: { fullName: true } },
            },
          }),
          prisma.notification.count({ where: { deletedAt: null } }),
          prisma.notification.count({
            where: { deletedAt: null, isRead: false },
          }),
        ])
        return makeResponse(
          workspace,
          [
            "Created",
            "Business",
            "Recipient",
            "Type",
            "Title",
            "Message",
            "Read status",
          ],
          notifications.map((notification) => [
            formatDate(notification.createdAt),
            notification.business.branch
              ? `${notification.business.name} · ${notification.business.branch}`
              : notification.business.name,
            notification.user?.fullName ?? "Business-wide",
            notification.type ?? "—",
            notification.title,
            notification.message,
            notification.isRead ? "Read" : "Unread",
          ]),
          total,
          page,
          [
            {
              label: "Stored notifications",
              value: total.toLocaleString(),
              note: "Not delivery telemetry",
            },
            {
              label: "Unread",
              value: unread.toLocaleString(),
              note: "Not marked as read",
            },
          ],
        )
      }
      case "revenue": {
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        const [sales, total, aggregates] = await Promise.all([
          prisma.sale.findMany({
            where: { createdAt: { gte: since }, saleStatus: "COMPLETED" },
            orderBy: { createdAt: "desc" },
            skip,
            take: pageSize,
            select: {
              saleNumber: true,
              total: true,
              createdAt: true,
              business: {
                select: { name: true, branch: true, currency: true },
              },
            },
          }),
          prisma.sale.count({
            where: { createdAt: { gte: since }, saleStatus: "COMPLETED" },
          }),
          prisma.sale.aggregate({
            where: { createdAt: { gte: since }, saleStatus: "COMPLETED" },
            _sum: { total: true },
          }),
        ])
        return makeResponse(
          workspace,
          ["Date", "Business", "Currency", "Sale", "Stored amount"],
          sales.map((sale) => [
            formatDate(sale.createdAt),
            sale.business.branch
              ? `${sale.business.name} · ${sale.business.branch}`
              : sale.business.name,
            sale.business.currency ?? "Unknown",
            sale.saleNumber ?? "—",
            sale.total.toLocaleString("en-KE"),
          ]),
          total,
          page,
          [
            {
              label: "Completed sales",
              value: total.toLocaleString(),
              note: "Last 30 days",
            },
            {
              label: "Stored amount sum",
              value: (aggregates._sum.total ?? 0).toLocaleString("en-KE"),
              note: "Mixed currencies are not converted",
            },
          ],
        )
      }
      case "integrations": {
        const [integrations, total] = await Promise.all([
          prisma.mpesaIntegration.findMany({
            orderBy: { updatedAt: "desc" },
            skip,
            take: pageSize,
            select: {
              environment: true,
              accountType: true,
              shortcode: true,
              partyB: true,
              updatedAt: true,
              business: { select: { name: true, branch: true } },
            },
          }),
          prisma.mpesaIntegration.count(),
        ])
        return makeResponse(
          workspace,
          [
            "Business",
            "Provider",
            "Environment",
            "Account type",
            "Shortcode",
            "Party B",
            "Updated",
          ],
          integrations.map((integration) => [
            integration.business.branch
              ? `${integration.business.name} · ${integration.business.branch}`
              : integration.business.name,
            "M-PESA",
            integration.environment,
            integration.accountType,
            integration.shortcode,
            integration.partyB ?? "—",
            formatDate(integration.updatedAt),
          ]),
          total,
          page,
          [
            {
              label: "M-PESA integrations",
              value: total.toLocaleString(),
              note: "Credential values are excluded",
            },
          ],
        )
      }
      case "system-settings": {
        const [settings, total, backupEnabled] = await Promise.all([
          prisma.businessSettings.findMany({
            orderBy: { updatedAt: "desc" },
            skip,
            take: pageSize,
            select: {
              receiptPrint: true,
              lowStockAlerts: true,
              salesNotifications: true,
              dailyReport: true,
              autoBackup: true,
              autoBackupFrequency: true,
              autoBackupWifiOnly: true,
              mpesaEnabled: true,
              updatedAt: true,
              business: { select: { name: true, branch: true } },
            },
          }),
          prisma.businessSettings.count(),
          prisma.businessSettings.count({ where: { autoBackup: true } }),
        ])
        return makeResponse(
          workspace,
          [
            "Business",
            "Receipt print",
            "Low-stock alerts",
            "Sales notifications",
            "Daily report",
            "Auto backup",
            "Backup frequency",
            "Wi-Fi only",
            "M-PESA enabled",
            "Updated",
          ],
          settings.map((setting) => [
            setting.business.branch
              ? `${setting.business.name} · ${setting.business.branch}`
              : setting.business.name,
            setting.receiptPrint ? "Enabled" : "Disabled",
            setting.lowStockAlerts ? "Enabled" : "Disabled",
            setting.salesNotifications ? "Enabled" : "Disabled",
            setting.dailyReport ? "Enabled" : "Disabled",
            setting.autoBackup ? "Enabled" : "Disabled",
            setting.autoBackupFrequency,
            setting.autoBackupWifiOnly ? "Yes" : "No",
            setting.mpesaEnabled ? "Enabled" : "Disabled",
            formatDate(setting.updatedAt),
          ]),
          total,
          page,
          [
            {
              label: "Business settings records",
              value: total.toLocaleString(),
              note: "Tenant-level settings; no global settings model exists",
            },
            {
              label: "Auto backup enabled",
              value: backupEnabled.toLocaleString(),
              note: "Stored tenant preferences",
            },
          ],
        )
      }
      default:
        return NextResponse.json(
          { error: "This admin workspace has no database-backed view." },
          { status: 404, headers: noStore },
        )
    }
  } catch (error) {
    console.error(`Platform admin ${workspace} workspace load failed:`, error)
    return NextResponse.json(
      { error: `Unable to load ${workspace || "admin"} workspace data.` },
      { status: 500, headers: noStore },
    )
  }
}
