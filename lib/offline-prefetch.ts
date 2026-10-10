import { apiFetch } from "./client-api"
import { refreshOfflinePinRoster, writeOfflineCollection } from "./offline-store"

export type OfflinePrefetchProgress = {
  total: number
  completed: number
  current: string
  failures: string[]
}

type PrefetchTask = {
  label: string
  run: () => Promise<PrefetchTask[] | void>
}

type PrefetchCustomer = {
  id: string
  name: string
  phone: string | null
  creditLimit?: number | null
  creditAccount: { balance: number; status?: string } | null
  _count: { sales: number; creditEntries: number }
}

type PrefetchedCustomerDetails = {
  id: string
  name: string
  phone: string | null
  creditLimit: number | null
  creditAccount: { balance: number; status: string; lastPayment: string | null } | null
  _count: { sales: number; creditEntries: number }
  sales: Array<{
    id: string
    createdAt: string
    total: number
    payments: Array<{ amount: number; paymentMethod: { name: string } }>
    items: Array<{ quantity: number }>
  }>
  creditEntries: Array<{
    id: string
    type: string
    amount: number
    paymentMethod: string | null
    createdAt: string
  }>
}

type ApiEmployee = {
  id: string
  fullName: string
  role: string
  roleId: string
  status: string
  shift: string
}

type ApiCashSession = {
  id: string
  closedAt: string | null
  openedAt: string
  cashier: {
    id: string
    fullName: string
    status?: string
    role: { name: string } | null
  } | null
  shift: {
    id: string
    code: string
    name: string
    scheduledStart: string | null
    scheduledEnd: string | null
    icon: string | null
    color: string | null
  } | null
  shiftType: string
}

const roleLabel = (role: string) => ({
  OWNER: "Store Manager",
  ADMIN: "Store Manager",
  SUPERVISOR: "Supervisor",
  STOCK_KEEPER: "Stock Keeper",
  ACCOUNTANT: "Accountant",
  CASHIER: "Cashier",
}[role] ?? "Cashier")

export async function prefetchOfflineData(
  businessId: string,
  userId: string,
  onProgress: (progress: OfflinePrefetchProgress) => void,
) {
  const businessQuery = `businessId=${encodeURIComponent(businessId)}`
  const tasks: PrefetchTask[] = [
    {
      label: "Dashboard and scan summary",
      run: async () => {
        await writeOfflineCollection(
          businessId,
          "dashboard.summary.v1",
          await apiFetch(`/api/dashboard/summary?${businessQuery}`),
        )
      },
    },
    {
      label: "Reports",
      run: async () => {
        await writeOfflineCollection(
          businessId,
          "reports.summary.v1",
          await apiFetch(`/api/reports/summary?${businessQuery}`),
        )
      },
    },
    {
      label: "Product catalogs and categories",
      run: async () => {
        const [products, deletedProducts, categories] = await Promise.all([
          apiFetch<unknown[]>(`/api/products?${businessQuery}`),
          apiFetch<unknown[]>(`/api/products?${businessQuery}&includeDeleted=true`),
          apiFetch<unknown[]>(`/api/categories?${businessQuery}`),
        ])
        await Promise.all([
          writeOfflineCollection(businessId, "inventory.products.v1", products),
          writeOfflineCollection(businessId, "inventory.deleted_products.v1", deletedProducts),
          writeOfflineCollection(businessId, "pos.products.v1", products),
          writeOfflineCollection(businessId, "pos.categories.v1", categories),
          writeOfflineCollection(businessId, "inventory.categories.v1", categories),
          writeOfflineCollection(businessId, "suppliers.categories.v1", categories),
          writeOfflineCollection(businessId, "purchases.products.v1", products),
        ])
      },
    },
    {
      label: "Customer and credit account lists",
      run: async () => {
        const customers = await apiFetch<PrefetchCustomer[]>(`/api/customers?${businessQuery}`)
        await Promise.all([
          writeOfflineCollection(businessId, "customers.list.v1", customers),
          writeOfflineCollection(businessId, "pos.customers.v1", customers),
        ])
        return customers.map(customer => ({
          label: `Recent history: ${customer.name}`,
          run: async () => {
            const response = await apiFetch<PrefetchedCustomerDetails>(
              `/api/customers?${businessQuery}&customerId=${encodeURIComponent(customer.id)}`,
            )
            const safeSnapshot: PrefetchedCustomerDetails = {
              id: response.id,
              name: response.name,
              phone: response.phone,
              creditLimit: response.creditLimit,
              creditAccount: response.creditAccount
                ? {
                    balance: response.creditAccount.balance,
                    status: response.creditAccount.status,
                    lastPayment: response.creditAccount.lastPayment,
                  }
                : null,
              _count: customer._count,
              sales: response.sales.map(sale => ({
                id: sale.id,
                createdAt: sale.createdAt,
                total: sale.total,
                payments: sale.payments.map(payment => ({
                  amount: payment.amount,
                  paymentMethod: { name: payment.paymentMethod.name },
                })),
                items: sale.items.map(item => ({ quantity: item.quantity })),
              })),
              creditEntries: response.creditEntries.map(entry => ({
                id: entry.id,
                type: entry.type,
                amount: entry.amount,
                paymentMethod: entry.paymentMethod,
                createdAt: entry.createdAt,
              })),
            }
            await writeOfflineCollection(
              businessId,
              `customers.details.v1:${customer.id}`,
              safeSnapshot,
            )
          },
        }))
      },
    },
    {
      label: "Expenses",
      run: async () => {
        await writeOfflineCollection(
          businessId,
          "expenses.list.v1",
          await apiFetch(`/api/expenses?${businessQuery}`),
        )
      },
    },
    {
      label: "Suppliers",
      run: async () => {
        const suppliers = await apiFetch<unknown[]>(`/api/suppliers?${businessQuery}`)
        await Promise.all([
          writeOfflineCollection(businessId, "suppliers.list.v1", suppliers),
          writeOfflineCollection(businessId, "purchases.suppliers.v1", suppliers),
        ])
      },
    },
    {
      label: "Purchase orders",
      run: async () => {
        await writeOfflineCollection(
          businessId,
          "purchases.orders.v1",
          await apiFetch(`/api/purchase-orders?${businessQuery}`),
        )
      },
    },
    {
      label: "Notifications",
      run: async () => {
        const notifications = await apiFetch(`/api/notifications?${businessQuery}`)
        await Promise.all([
          writeOfflineCollection(businessId, "notifications.list.v1", notifications),
          writeOfflineCollection(businessId, "dashboard.notifications.v1", notifications),
        ])
      },
    },
    {
      label: "Employee directory",
      run: async () => {
        const response = await apiFetch<{
          employees: Array<ApiEmployee & { startDate: string }>
        }>(`/api/employees?${businessQuery}`)
        const employees = response.employees.map((employee, index) => ({
          id: employee.id,
          roleId: employee.roleId,
          name: employee.fullName,
          role: roleLabel(employee.role),
          phone: "",
          email: "",
          pin: "",
          hasPin: false,
          shift: employee.shift,
          salary: null,
          startDate: "Not available offline",
          active: employee.status === "ACTIVE",
          initials: employee.fullName.split(" ").slice(0, 2).map(word => word[0]).join("").toUpperCase(),
          color: ["#123A8F", "#2E7D32", "#D32F2F", "#F57C00", "#7B1FA2"][index % 5] ?? "#123A8F",
        }))
        await writeOfflineCollection(businessId, "employees.directory.v1", employees)
      },
    },
    {
      label: "Shift history and active shift roster",
      run: async () => {
        const [employeeResponse, sessionResponse, typeResponse] = await Promise.all([
          apiFetch<{ employees: ApiEmployee[] }>(`/api/employees?${businessQuery}`),
          apiFetch<{ sessions: ApiCashSession[] }>(`/api/cash/session?${businessQuery}`),
          apiFetch<{ shiftTypes: unknown[] }>(`/api/shift-types?${businessQuery}`),
        ])
        const safeSessions = sessionResponse.sessions.map(item => ({
          ...item,
          cashier: item.cashier ? {
            id: item.cashier.id,
            fullName: item.cashier.fullName,
            role: item.cashier.role ? { name: item.cashier.role.name } : null,
          } : null,
          shift: item.shift ? {
            id: item.shift.id,
            code: item.shift.code,
            name: item.shift.name,
            scheduledStart: item.shift.scheduledStart,
            scheduledEnd: item.shift.scheduledEnd,
            icon: item.shift.icon,
            color: item.shift.color,
          } : null,
        }))
        const activeOperators = sessionResponse.sessions
          .filter(item =>
            !item.closedAt &&
            item.cashier &&
            item.cashier.status !== "INACTIVE" &&
            ["CASHIER", "SUPERVISOR"].includes(item.cashier.role?.name?.toUpperCase() ?? ""),
          )
          .map(item => ({
            id: item.cashier!.id,
            sessionId: item.id,
            name: item.cashier!.fullName,
            shift: item.shift?.name ?? item.shiftType,
            openedAt: item.openedAt,
          }))
        await Promise.all([
          writeOfflineCollection(
            businessId,
            "shifts.employees.v1",
            employeeResponse.employees.map(({ id, fullName, role, status }) => ({
              id, fullName, role, isActive: status === "ACTIVE",
            })),
          ),
          writeOfflineCollection(businessId, "shifts.sessions.v1", safeSessions),
          writeOfflineCollection(businessId, "shifts.types.v1", typeResponse.shiftTypes ?? []),
          writeOfflineCollection(businessId, "pos.shift_roster.v1", activeOperators),
        ])
        window.localStorage.setItem(
          `mobiduka.shift_roster.v1:${businessId}`,
          JSON.stringify(activeOperators),
        )
        if (activeOperators.length === 1) {
          window.localStorage.setItem(
            `mobiduka.current_shift.v1:${businessId}`,
            activeOperators[0].sessionId,
          )
        }
      },
    },
    {
      label: "Roles and permissions",
      run: async () => {
        await writeOfflineCollection(
          businessId,
          "roles.list.v1",
          await apiFetch(`/api/roles?${businessQuery}`),
        )
      },
    },
    {
      label: "Profile snapshot",
      run: async () => {
        await writeOfflineCollection(
          businessId,
          `profile.v1:${userId}`,
          await apiFetch(`/api/profile?${businessQuery}`),
        )
      },
    },
    {
      label: "Settings and payment summaries",
      run: async () => {
        const [business, settings, receiptSettings, taxSettings] = await Promise.all([
          apiFetch<{
            business: {
              name: string
              branch: string | null
              country: string | null
              currency: string | null
            }
          }>(`/api/business?${businessQuery}`),
          apiFetch<{
            preferences: {
              receiptPrint: boolean
              lowStockAlerts: boolean
              salesNotifications: boolean
              dailyReport: boolean
              autoBackup: boolean
              themeMode: string
              paymentConfig: { methods: Record<string, boolean> } | null
              mpesaEnabled: boolean
            }
          }>(`/api/settings?${businessQuery}`),
          apiFetch<{ preferences: { receiptConfig: unknown } }>(
            `/api/settings?${businessQuery}&includeReceiptConfig=true`,
          ),
          apiFetch<{ preferences: { taxConfig: unknown } }>(
            `/api/settings?${businessQuery}&includeTaxConfig=true`,
          ),
        ])
        const safeBusiness = {
          name: business.business.name,
          branch: business.business.branch,
          country: business.business.country,
          currency: business.business.currency,
        }
        await Promise.all([
          writeOfflineCollection(businessId, "settings.overview.v1", {
            business: safeBusiness,
            preferences: {
              receiptPrint: settings.preferences.receiptPrint,
              lowStockAlerts: settings.preferences.lowStockAlerts,
              salesNotifications: settings.preferences.salesNotifications,
              dailyReport: settings.preferences.dailyReport,
              autoBackup: settings.preferences.autoBackup,
              themeMode: settings.preferences.themeMode,
              paymentConfig: settings.preferences.paymentConfig
                ? { methods: { ...settings.preferences.paymentConfig.methods } }
                : null,
            },
          }),
          writeOfflineCollection(businessId, "settings.receipt-preview.v1", {
            business: {
              name: business.business.name,
              branch: business.business.branch ?? "",
              country: business.business.country ?? "",
            },
            receiptConfig: receiptSettings.preferences.receiptConfig ?? {
              headerText: "Thank you for shopping with us!",
              footerText: "Goods sold are not refundable · Valid receipt required for exchange",
              format: "80mm",
              showLogo: true,
              showTax: true,
              showDiscount: true,
              showCashier: true,
              showShift: true,
              showBarcode: false,
              receiptPrefix: "RCP",
              nextNumber: "1042",
            },
          }),
          writeOfflineCollection(
            businessId,
            "settings.tax-compliance.v1",
            taxSettings.preferences.taxConfig ?? {
              vatEnabled: true,
              defaultRate: "standard",
              filingPeriod: "Monthly",
              etimsEnabled: false,
              etimsDevice: "",
            },
          ),
          writeOfflineCollection(businessId, "payments.methods.v1", {
            methods: {
              ...(settings.preferences.paymentConfig?.methods ?? {}),
              mpesa: Boolean(
                settings.preferences.paymentConfig?.methods.mpesa &&
                settings.preferences.mpesaEnabled,
              ),
            },
          }),
        ])
      },
    },
    {
      label: "Recent receipt history",
      run: async () => {
        await writeOfflineCollection(
          businessId,
          "pos.receipt_history.v1",
          await apiFetch(`/api/sales?${businessQuery}&limit=10`),
        )
      },
    },
    {
      label: "Offline PIN roster",
      run: () => refreshOfflinePinRoster(businessId),
    },
  ]

  const progress: OfflinePrefetchProgress = {
    total: tasks.length,
    completed: 0,
    current: "",
    failures: [],
  }
  onProgress({ ...progress, failures: [] })
  for (let index = 0; index < tasks.length; index += 1) {
    const task = tasks[index]
    progress.current = task.label
    onProgress({ ...progress, failures: [...progress.failures] })
    let additionalTasks: PrefetchTask[] = []
    try {
      additionalTasks = await task.run() ?? []
    } catch (reason) {
      const detail = reason instanceof Error ? reason.message : "Download failed."
      progress.failures.push(`${task.label}: ${detail}`)
    }
    progress.completed += 1
    if (additionalTasks.length > 0) {
      tasks.splice(index + 1, 0, ...additionalTasks)
      progress.total += additionalTasks.length
    }
    onProgress({ ...progress, failures: [...progress.failures] })
  }
  progress.current = ""
  onProgress({ ...progress, failures: [...progress.failures] })
  return progress
}
