import { useCallback, useEffect, useState, type ReactNode } from "react"
import { Network, type ConnectionType } from "@capacitor/network"
import { useColors } from "../utils/theme"
import {
  AUTO_BACKUP_FREQUENCIES,
  isAutoBackupFrequency,
  type AutoBackupFrequency,
} from "../../lib/backup-schedule"
import {
  ApiResponseError,
  apiFetch,
  getClientSession,
} from "../../lib/client-api"
import {
  getOfflineCacheIndex,
  getQueuedOfflineCashSales,
  getOfflineSaleSyncStatus,
  getOfflineStorageUsage,
  isNativeOfflineApp,
  OFFLINE_SALE_SYNC_PROGRESS_EVENT,
  restoreOfflineBackupSnapshot,
  retryFailedOfflineSales,
  syncPendingOfflineSales,
  type OfflineCacheIndexEntry,
  type OfflineSaleSyncProgress,
  type OfflineStorageUsage,
  type QueuedOfflineCashSale,
} from "../../lib/offline-store"
import {
  prefetchOfflineData,
  type OfflinePrefetchProgress,
} from "../../lib/offline-prefetch"
import {
  DeviceBackupError,
  uploadDeviceBackup,
} from "../../lib/cloud-device-backup"
import { downloadSalesLedgerCsv } from "../../lib/download-sales-ledger"

interface Props {
  onNavigate: (s: string) => void
}

type SyncStatus = {
  pending: number
  failed: number
  lastError: string | null
  syncError: string | null
}

type CacheDataset = {
  label: string
  cacheKeys: string[]
}

const cacheDatasets = (userId: string): CacheDataset[] => [
  {
    label: "Dashboard and scan summary",
    cacheKeys: ["dashboard.summary.v1", "dashboard.notifications.v1"],
  },
  { label: "Reports", cacheKeys: ["reports.summary.v1"] },
  {
    label: "POS catalog and reference data",
    cacheKeys: [
      "pos.products.v1",
      "pos.categories.v1",
      "pos.customers.v1",
      "pos.shift_roster.v1",
    ],
  },
  {
    label: "Inventory catalog and categories",
    cacheKeys: [
      "inventory.products.v1",
      "inventory.categories.v1",
      "inventory.deleted_products.v1",
    ],
  },
  { label: "Customer and credit lists", cacheKeys: ["customers.list.v1"] },
  { label: "Customer histories", cacheKeys: ["customers.details.v1:"] },
  { label: "Expenses", cacheKeys: ["expenses.list.v1"] },
  {
    label: "Suppliers and categories",
    cacheKeys: ["suppliers.list.v1", "suppliers.categories.v1"],
  },
  {
    label: "Purchase orders and references",
    cacheKeys: [
      "purchases.orders.v1",
      "purchases.suppliers.v1",
      "purchases.products.v1",
    ],
  },
  { label: "Notifications", cacheKeys: ["notifications.list.v1"] },
  {
    label: "Employee directory and shifts",
    cacheKeys: [
      "employees.directory.v1",
      "shifts.employees.v1",
      "shifts.sessions.v1",
      "shifts.types.v1",
    ],
  },
  { label: "Roles and permissions", cacheKeys: ["roles.list.v1"] },
  { label: "Signed-in profile", cacheKeys: [`profile.v1:${userId}`] },
  {
    label: "Settings and accepted payment methods",
    cacheKeys: [
      "settings.overview.v1",
      "settings.receipt-preview.v1",
      "settings.tax-compliance.v1",
      "payments.methods.v1",
    ],
  },
  { label: "Recent receipt history", cacheKeys: ["pos.receipt_history.v1"] },
  { label: "Offline PIN roster", cacheKeys: ["offline.pin-roster.v1"] },
]

const emptyStatus: SyncStatus = {
  pending: 0,
  failed: 0,
  lastError: null,
  syncError: null,
}

const emptyStorageUsage: OfflineStorageUsage = {
  cachedCollections: 0,
  cachedPayloadBytes: 0,
  queuedRecords: 0,
  queuedPayloadBytes: 0,
}

type CloudBackupMetadata = {
  id: string
  checksum: string
  chunkCount: number
  compressedBytes: number
  originalBytes: number
  recordCount?: number | null
  collectionCount?: number | null
  queuedRecordCount?: number | null
  triggerType?: "AUTO" | "MANUAL"
  retryCount?: number
  status?: "PENDING" | "COMPLETED" | "FAILED"
  failureReason?: string | null
  progressPercent?: number
  progressMessage?: string | null
  createdAt?: string
  completedAt: string | null
}

type RestorePoint = CloudBackupMetadata & {
  kind: "Full business" | "Device snapshot"
}

type BackupSettingsResponse = {
  preferences: {
    autoBackup: boolean
    autoBackupFrequency: AutoBackupFrequency
    autoBackupWifiOnly: boolean
  }
}

function formatPayloadSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  )
  const value = bytes / 1024 ** unitIndex
  return `${value.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`
}

function formatBackupDate(value: string | null) {
  if (!value) return "Date unavailable"
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return "Date unavailable"

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const backupDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  )
  const dayOffset = Math.round(
    (today.getTime() - backupDay.getTime()) / 86_400_000,
  )
  const time = date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })

  if (dayOffset === 0) return `Today, ${time}`
  if (dayOffset === 1) return `Yesterday, ${time}`
  return `${date.toLocaleDateString(undefined, { day: "numeric", month: "short" })}, ${time}`
}

type BackupIconName =
  | "arrow-left"
  | "cloud"
  | "database"
  | "device"
  | "refresh"
  | "shield"
  | "check"
  | "clock"
  | "chevron"
  | "restore"

function BackupIcon({
  name,
  size = 20,
  color = "currentColor",
}: {
  name: BackupIconName
  size?: number
  color?: string
}) {
  const paths: Record<BackupIconName, ReactNode> = {
    "arrow-left": (
      <>
        <path d="M19 12H5" />
        <path d="m12 19-7-7 7-7" />
      </>
    ),
    cloud: <path d="M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9Z" />,
    database: (
      <>
        <ellipse cx="12" cy="5" rx="8" ry="3" />
        <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
        <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
      </>
    ),
    device: (
      <>
        <rect x="6" y="2" width="12" height="20" rx="2" />
        <path d="M10 18h4" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5" />
        <path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5" />
      </>
    ),
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />,
    check: <path d="m5 12 4 4L19 6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    chevron: <path d="m9 18 6-6-6-6" />,
    restore: (
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
        <path d="M3 3v5h5" />
      </>
    ),
  }

  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  )
}

export default function BackupScreen({ onNavigate }: Props) {
  const c = useColors()
  const session = getClientSession()
  const businessId = session?.user.businessId
  const userId = session?.user.id
  const [status, setStatus] = useState<SyncStatus>(emptyStatus)
  const [queuedSales, setQueuedSales] = useState<QueuedOfflineCashSale[]>([])
  const [syncingSaleIds, setSyncingSaleIds] = useState<Set<string>>(new Set())
  const [salesSyncExpanded, setSalesSyncExpanded] = useState(false)
  const [offlinePreparationExpanded, setOfflinePreparationExpanded] =
    useState(true)
  const [recentlySyncedSales, setRecentlySyncedSales] = useState<
    QueuedOfflineCashSale[]
  >([])
  const [queuedSalesLoading, setQueuedSalesLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [prefetching, setPrefetching] = useState(false)
  const [prefetchProgress, setPrefetchProgress] =
    useState<OfflinePrefetchProgress | null>(null)
  const [cacheIndex, setCacheIndex] = useState<OfflineCacheIndexEntry[]>([])
  const [cacheIndexLoading, setCacheIndexLoading] = useState(false)
  const [storageUsage, setStorageUsage] =
    useState<OfflineStorageUsage>(emptyStorageUsage)
  const [storageUsageLoading, setStorageUsageLoading] = useState(false)
  const [error, setError] = useState("")
  const [backupError, setBackupError] = useState("")
  const [ledgerExportError, setLedgerExportError] = useState("")
  const [ledgerExportMessage, setLedgerExportMessage] = useState("")
  const [ledgerExporting, setLedgerExporting] = useState(false)
  const [restoreMessage, setRestoreMessage] = useState("")
  const [selectedRestoreBackupId, setSelectedRestoreBackupId] = useState<
    string | null
  >(null)
  const [backingUp, setBackingUp] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [backupProgress, setBackupProgress] = useState<{
    completed: number
    total: number
  } | null>(null)
  const [latestBackup, setLatestBackup] = useState<CloudBackupMetadata | null>(
    null,
  )
  const [deviceBackupHistory, setDeviceBackupHistory] =
    useState<CloudBackupMetadata[]>([])
  const [backupMetadataLoading, setBackupMetadataLoading] = useState(false)
  const [latestServerBackup, setLatestServerBackup] =
    useState<CloudBackupMetadata | null>(null)
  const [serverBackupHistory, setServerBackupHistory] =
    useState<CloudBackupMetadata[]>([])
  const [serverBackupLoading, setServerBackupLoading] = useState(false)
  const [serverBackupBusy, setServerBackupBusy] = useState(false)
  const [serverBackupProgress, setServerBackupProgress] = useState<{
    percent: number
    message: string
  } | null>(null)
  const [serverRestoreBusy, setServerRestoreBusy] = useState(false)
  const [serverRestoreBackupId, setServerRestoreBackupId] = useState<
    string | null
  >(null)
  const [serverRestoreProgress, setServerRestoreProgress] = useState<{
    percent: number
    message: string
  } | null>(null)
  const [serverBackupError, setServerBackupError] = useState("")
  const [serverBackupHistoryError, setServerBackupHistoryError] = useState("")
  const [serverBackupMessage, setServerBackupMessage] = useState("")
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(true)
  const [autoBackupFrequency, setAutoBackupFrequency] =
    useState<AutoBackupFrequency>("DAILY")
  const [autoBackupWifiOnly, setAutoBackupWifiOnly] = useState(true)
  const [backupSettingsLoading, setBackupSettingsLoading] = useState(false)
  const [backupSettingsSaving, setBackupSettingsSaving] = useState(false)
  const [networkType, setNetworkType] = useState<ConnectionType>("unknown")
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  )
  useEffect(() => {
    setRecentlySyncedSales([])
    setSyncingSaleIds(new Set())
  }, [businessId])

  const isNative = isNativeOfflineApp()
  const deviceBackupUnavailableReason = !isNative
    ? "Device snapshots use app-private SQLite storage and are available only in the installed Android or iOS app, not in a browser."
    : !isOnline
      ? "Connect this device to the internet to create or restore an encrypted cloud copy."
      : !session?.token || session.user.offline
        ? "Sign in online to create or restore a device snapshot."
        : ""

  useEffect(() => {
    if (!businessId || !session?.token || session.user.offline) return
    let active = true
    setBackupSettingsLoading(true)
    void apiFetch<BackupSettingsResponse>(
      `/api/settings?businessId=${encodeURIComponent(businessId)}`,
    )
      .then((result) => {
        if (!active) return
        setAutoBackupEnabled(result.preferences.autoBackup)
        if (!isAutoBackupFrequency(result.preferences.autoBackupFrequency)) {
          throw new Error("Saved automatic backup frequency is invalid.")
        }
        setAutoBackupFrequency(result.preferences.autoBackupFrequency)
        setAutoBackupWifiOnly(result.preferences.autoBackupWifiOnly ?? true)
      })
      .catch((reason) => {
        console.error("Unable to load automatic backup settings.", reason)
        if (active) {
          setBackupError(
            reason instanceof Error
              ? reason.message
              : "Unable to load automatic backup settings.",
          )
        }
      })
      .finally(() => {
        if (active) {
          setBackupSettingsLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [businessId, session?.token, session?.user.offline])

  const saveBackupSettings = async (patch: {
    autoBackup?: boolean
    autoBackupFrequency?: AutoBackupFrequency
    autoBackupWifiOnly?: boolean
  }) => {
    if (!businessId) return
    const previous = {
      autoBackupEnabled,
      autoBackupFrequency,
      autoBackupWifiOnly,
    }
    if (patch.autoBackup !== undefined) setAutoBackupEnabled(patch.autoBackup)
    if (patch.autoBackupFrequency !== undefined)
      setAutoBackupFrequency(patch.autoBackupFrequency)
    if (patch.autoBackupWifiOnly !== undefined)
      setAutoBackupWifiOnly(patch.autoBackupWifiOnly)
    setBackupSettingsSaving(true)
    setBackupError("")
    try {
      const result = await apiFetch<BackupSettingsResponse>("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({ businessId, ...patch }),
      })
      setAutoBackupEnabled(result.preferences.autoBackup)
      if (!isAutoBackupFrequency(result.preferences.autoBackupFrequency)) {
        throw new Error("Saved automatic backup frequency is invalid.")
      }
      setAutoBackupFrequency(result.preferences.autoBackupFrequency)
      setAutoBackupWifiOnly(result.preferences.autoBackupWifiOnly ?? true)
    } catch (reason) {
      setAutoBackupEnabled(previous.autoBackupEnabled)
      setAutoBackupFrequency(previous.autoBackupFrequency)
      setAutoBackupWifiOnly(previous.autoBackupWifiOnly)
      console.error("Unable to save automatic backup settings.", reason)
      setBackupError(
        reason instanceof Error
          ? reason.message
          : "Unable to save backup settings.",
      )
    } finally {
      setBackupSettingsSaving(false)
    }
  }

  const downloadSavedLedgerWhileOffline = async () => {
    setLedgerExporting(true)
    setLedgerExportError("")
    setLedgerExportMessage("")
    try {
      const result = await downloadSalesLedgerCsv()
      setLedgerExportMessage(
        result.source === "offline"
          ? `Downloaded the saved offline ledger from ${new Date(result.savedAt).toLocaleString()}. It may not include newer sales.`
          : "Sales ledger downloaded and saved for offline use.",
      )
    } catch (reason) {
      console.error("Unable to download the saved sales ledger.", reason)
      setLedgerExportError(
        reason instanceof Error
          ? reason.message
          : "Unable to download the saved sales ledger.",
      )
    } finally {
      setLedgerExporting(false)
    }
  }

  useEffect(() => {
    if (!isNative) return
    let active = true
    void Network.getStatus()
      .then((status) => {
        if (!active) return
        setNetworkType(status.connectionType)
        setIsOnline(status.connected)
      })
      .catch((reason) => {
        console.error("Unable to read native network status.", reason)
      })
    const listener = Network.addListener("networkStatusChange", (status) => {
      setNetworkType(status.connectionType)
      setIsOnline(status.connected)
    })
    return () => {
      active = false
      void listener.then((handle) => handle.remove())
    }
  }, [isNative])

  useEffect(() => {
    if (!businessId || !session?.token || session.user.offline) {
      setLatestBackup(null)
      setDeviceBackupHistory([])
      setBackupMetadataLoading(false)
      return
    }
    let active = true
    setBackupMetadataLoading(true)
    setLatestBackup(null)
    setDeviceBackupHistory([])
    void apiFetch<{
      backup: CloudBackupMetadata | null
      backups?: CloudBackupMetadata[]
    }>("/api/business/backup")
      .then((result) => {
        if (active) {
          setLatestBackup(result.backup)
          setDeviceBackupHistory(
            result.backups ?? (result.backup ? [result.backup] : []),
          )
          setBackupError("")
        }
      })
      .catch((reason) => {
        console.error("Unable to load cloud backup information.", reason)
        if (active) {
          setBackupError(
            reason instanceof Error
              ? reason.message
              : "Unable to load cloud backup information.",
          )
        }
      })
      .finally(() => {
        if (active) {
          setBackupMetadataLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [businessId, session?.token, session?.user.offline])

  useEffect(() => {
    if (!businessId || !session?.token || session.user.offline) {
      setLatestServerBackup(null)
      setServerBackupHistory([])
      setServerBackupLoading(false)
      return
    }
    let active = true
    let requestInProgress = false
    const loadServerBackupHistory = async () => {
      if (requestInProgress) return
      requestInProgress = true
      setServerBackupLoading(true)
      try {
        const result = await apiFetch<{
          backup?: CloudBackupMetadata | null
          backups?: CloudBackupMetadata[]
        }>("/api/business/backup/server-data", { cache: "no-store" })
        if (
          !result ||
          !Array.isArray(result.backups) ||
          !("backup" in result)
        ) {
          throw new Error(
            "The server returned an invalid backup history response. Refresh and try again.",
          )
        }
        if (active) {
          const history = result.backups
          const latest =
            result.backup ??
            history.find((backup) => backup.status === "COMPLETED") ??
            null
          setLatestServerBackup(latest)
          setServerBackupHistory(history)
          setServerBackupHistoryError("")
        }
      } catch (reason) {
        console.error(
          "Unable to load server business backup information.",
          reason,
        )
        if (active) {
          setServerBackupHistoryError(
            reason instanceof Error
              ? reason.message
              : "Unable to load server backup information.",
          )
        }
      } finally {
        requestInProgress = false
        if (active) setServerBackupLoading(false)
      }
    }
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void loadServerBackupHistory()
      }
    }
    void loadServerBackupHistory()
    window.addEventListener("focus", refreshWhenVisible)
    document.addEventListener("visibilitychange", refreshWhenVisible)
    return () => {
      active = false
      window.removeEventListener("focus", refreshWhenVisible)
      document.removeEventListener("visibilitychange", refreshWhenVisible)
    }
  }, [businessId, session?.token, session?.user.offline])

  useEffect(() => {
    if (!serverBackupBusy || !businessId || !session?.token) return
    let active = true
    let loggedPollFailure = false
    let timeoutId: number | undefined
    const refreshProgress = async () => {
      try {
        const result = await apiFetch<{
          activeBackup?: Pick<CloudBackupMetadata, "id" | "status" | "progressPercent" | "progressMessage"> | null
        }>("/api/business/backup/server-data?progress=1", {
          cache: "no-store",
        })
        if (!active) return
        if (result.activeBackup) {
          setServerBackupProgress((current) => ({
            percent: Math.max(
              current?.percent ?? 0,
              result.activeBackup?.progressPercent ?? 0,
            ),
            message:
              result.activeBackup?.progressMessage ??
              "Preparing business backup",
          }))
        }
      } catch (reason) {
        if (!loggedPollFailure) {
          console.error(
            "Unable to refresh full business backup progress.",
            reason,
          )
          loggedPollFailure = true
        }
        if (active) {
          setServerBackupProgress((current) =>
            current
              ? {
                  ...current,
                  message: "Progress update temporarily unavailable",
                }
              : current,
          )
        }
      } finally {
        if (active) {
          timeoutId = window.setTimeout(() => void refreshProgress(), 500)
        }
      }
    }
    void refreshProgress()
    return () => {
      active = false
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
    }
  }, [businessId, serverBackupBusy, session?.token])

  useEffect(() => {
    const backupId = serverRestoreBackupId
    if (!serverRestoreBusy || !backupId || !businessId || !session?.token)
      return
    let active = true
    let loggedPollFailure = false
    let timeoutId: number | undefined
    const refreshProgress = async () => {
      try {
        const result = await apiFetch<{
          restoreProgress?: {
            restoreProgressPercent: number | null
            restoreProgressMessage: string | null
          } | null
        }>(
          `/api/business/restore/server-data?backupId=${encodeURIComponent(backupId)}`,
          { cache: "no-store" },
        )
        if (!active) return
        const restoreProgress = result.restoreProgress
        if (restoreProgress) {
          setServerRestoreProgress((current) => ({
            percent: Math.max(
              current?.percent ?? 0,
              restoreProgress.restoreProgressPercent ?? 0,
            ),
            message:
              restoreProgress.restoreProgressMessage ??
              "Restoring business records",
          }))
        }
      } catch (reason) {
        if (!loggedPollFailure) {
          console.error("Unable to refresh server restore progress.", reason)
          loggedPollFailure = true
        }
        if (active) {
          setServerRestoreProgress((current) =>
            current
              ? {
                  ...current,
                  message: "Progress update temporarily unavailable",
                }
              : current,
          )
        }
      } finally {
        if (active) {
          timeoutId = window.setTimeout(() => void refreshProgress(), 500)
        }
      }
    }
    void refreshProgress()
    return () => {
      active = false
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
    }
  }, [businessId, serverRestoreBackupId, serverRestoreBusy, session?.token])

  const refreshStatus = useCallback(async () => {
    if (!businessId || !isNative) {
      setStatus(emptyStatus)
      setQueuedSales([])
      setLoading(false)
      return
    }
    setQueuedSalesLoading(true)
    try {
      const [nextStatus, sales] = await Promise.all([
        getOfflineSaleSyncStatus(businessId),
        getQueuedOfflineCashSales(businessId),
      ])
      setStatus({ ...nextStatus, syncError: null })
      setQueuedSales(sales)
      setError(nextStatus.lastError ?? "")
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to read on-device sync status.",
      )
    } finally {
      setLoading(false)
      setQueuedSalesLoading(false)
    }
  }, [businessId, isNative])

  const refreshQueuedSales = useCallback(async () => {
    if (!businessId || !isNative) {
      setQueuedSales([])
      return
    }
    setQueuedSalesLoading(true)
    try {
      setQueuedSales(await getQueuedOfflineCashSales(businessId))
    } catch (reason) {
      console.error("Unable to read queued offline cash sales.", reason)
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to read queued offline cash sales.",
      )
    } finally {
      setQueuedSalesLoading(false)
    }
  }, [businessId, isNative])

  const refreshCacheIndex = useCallback(async () => {
    if (!businessId || !isNative) {
      setCacheIndex([])
      setStorageUsage(emptyStorageUsage)
      setCacheIndexLoading(false)
      setStorageUsageLoading(false)
      return
    }
    setCacheIndexLoading(true)
    setStorageUsageLoading(true)
    try {
      const [index, usage] = await Promise.all([
        getOfflineCacheIndex(businessId),
        getOfflineStorageUsage(businessId),
      ])
      setCacheIndex(index)
      setStorageUsage(usage)
    } catch (reason) {
      console.error("Unable to read the offline cache index.", reason)
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to check saved offline data.",
      )
    } finally {
      setCacheIndexLoading(false)
      setStorageUsageLoading(false)
    }
  }, [businessId, isNative])

  useEffect(() => {
    void refreshStatus()
    void refreshCacheIndex()
    const handleSyncStatus = (event: Event) => {
      const detail = (event as CustomEvent<SyncStatus>).detail
      if (!detail) return
      setStatus(detail)
      setLoading(false)
      void refreshQueuedSales()
      void refreshCacheIndex()
      if (detail.syncError) setError(detail.syncError)
      else if (detail.lastError) setError(detail.lastError)
      else setError("")
    }
    const handleSaleSyncProgress = (event: Event) => {
      const detail = (event as CustomEvent<OfflineSaleSyncProgress>).detail
      if (!detail || detail.businessId !== businessId) return
      const saleIds = new Set(detail.sales.map((sale) => sale.id))
      if (detail.phase === "syncing") {
        setSyncingSaleIds((current) => new Set([...current, ...saleIds]))
      } else if (detail.phase === "synced") {
        setRecentlySyncedSales((current) =>
          [
            ...detail.sales.slice().reverse(),
            ...current.filter((sale) => !saleIds.has(sale.id)),
          ].slice(0, 50),
        )
      }
      if (detail.phase === "failed" || detail.phase === "settled") {
        setSyncingSaleIds((current) => {
          const next = new Set(current)
          for (const id of saleIds) next.delete(id)
          return next
        })
      }
    }
    const handleOnline = () => {
      void refreshStatus()
      void refreshCacheIndex()
    }
    const handleConnectivityChange = () => setIsOnline(navigator.onLine)
    window.addEventListener("mobiduka-offline-sync-status", handleSyncStatus)
    window.addEventListener(
      OFFLINE_SALE_SYNC_PROGRESS_EVENT,
      handleSaleSyncProgress,
    )
    window.addEventListener("online", handleOnline)
    window.addEventListener("online", handleConnectivityChange)
    window.addEventListener("offline", handleConnectivityChange)
    return () => {
      window.removeEventListener(
        "mobiduka-offline-sync-status",
        handleSyncStatus,
      )
      window.removeEventListener(
        OFFLINE_SALE_SYNC_PROGRESS_EVENT,
        handleSaleSyncProgress,
      )
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("online", handleConnectivityChange)
      window.removeEventListener("offline", handleConnectivityChange)
    }
  }, [businessId, refreshCacheIndex, refreshQueuedSales, refreshStatus])

  const syncNow = async () => {
    if (
      !businessId ||
      !userId ||
      !session?.token ||
      session.user.offline ||
      !isOnline
    ) {
      setError(
        "Sign in online and connect to the internet before synchronizing queued sales.",
      )
      return
    }
    setSyncing(true)
    setError("")
    try {
      if (status.failed > 0) await retryFailedOfflineSales(businessId)
      await syncPendingOfflineSales(businessId, userId)
    } catch (reason) {
      const message =
        reason instanceof Error
          ? reason.message
          : "Unable to synchronize queued sales."
      setError(message)
      try {
        const nextStatus = await getOfflineSaleSyncStatus(businessId)
        setStatus({ ...nextStatus, syncError: message })
      } catch (statusError) {
        console.error(
          "Unable to refresh offline sale status after sync failure.",
          statusError,
        )
      }
    } finally {
      setSyncing(false)
      await refreshStatus()
      await refreshCacheIndex()
    }
  }

  const createCloudBackup = useCallback(
    async (triggerType: "AUTO" | "MANUAL" = "MANUAL") => {
      if (
        !businessId ||
        !session?.token ||
        session.user.offline ||
        !isNative ||
        !isOnline
      ) {
        setBackupError(
          "Sign in online and connect to the internet in the native app before creating a cloud backup.",
        )
        return
      }
      setBackingUp(true)
      setBackupError("")
      setBackupProgress({ completed: 0, total: 0 })
      try {
        const completedBackup = await uploadDeviceBackup(
          businessId,
          triggerType,
          (completed, total) => setBackupProgress({ completed, total }),
        )
        setLatestBackup(completedBackup)
        setDeviceBackupHistory((previous) =>
          [
            completedBackup,
            ...previous.filter((backup) => backup.id !== completedBackup.id),
          ].slice(0, 20),
        )
      } catch (reason) {
        console.error("Unable to create cloud backup.", reason)
        const failureReason =
          reason instanceof Error
            ? reason.message
            : "Unable to create cloud backup."
        setBackupError(failureReason)
        const failedBackup =
          reason instanceof DeviceBackupError ? reason.backup : null
        if (failedBackup) {
          setDeviceBackupHistory((previous) =>
            [
              failedBackup,
              ...previous.filter((backup) => backup.id !== failedBackup.id),
            ].slice(0, 20),
          )
        }
      } finally {
        setBackingUp(false)
        setBackupProgress(null)
      }
    },
    [businessId, isNative, isOnline, session?.token, session?.user.offline],
  )

  const restoreCloudBackup = async (backupId?: string) => {
    if (
      !businessId ||
      !session?.token ||
      session.user.offline ||
      !isNative ||
      !isOnline
    ) {
      setBackupError(
        "Sign in online and connect to the internet in the native app before restoring a cloud backup.",
      )
      return
    }
    const backupToRestore = backupId
      ? deviceBackupHistory.find((backup) => backup.id === backupId) ??
        (latestBackup?.id === backupId ? latestBackup : null)
      : latestBackup
    if (!backupToRestore?.completedAt) {
      setBackupError("There is no completed cloud backup to restore.")
      return
    }
    if (
      !window.confirm(
        "Restore this cloud backup? This replaces this business’s saved offline collections and queued sync records on this device.",
      )
    ) {
      return
    }

    setRestoring(true)
    setBackupError("")
    setRestoreMessage("")
    try {
      const result = await apiFetch<{
        payload: unknown
      }>("/api/business/restore", {
        method: "POST",
        body: JSON.stringify({ backupId: backupToRestore.id }),
      })
      await restoreOfflineBackupSnapshot(businessId, result.payload)
      await Promise.all([refreshStatus(), refreshCacheIndex()])
      setRestoreMessage(
        "Cloud backup restored. Saved collections and queued sync records are ready on this device.",
      )
    } catch (reason) {
      console.error("Unable to restore cloud backup.", reason)
      setBackupError(
        reason instanceof Error
          ? reason.message
          : "Unable to restore cloud backup.",
      )
    } finally {
      setRestoring(false)
    }
  }

  const createServerBackup = async () => {
    if (!businessId || !session?.token || session.user.offline || !isOnline) {
      setServerBackupError(
        "Sign in online and connect to the internet before creating a server backup.",
      )
      return
    }
    setServerBackupBusy(true)
    setServerBackupProgress({
      percent: 0,
      message: "Preparing business snapshot",
    })
    setServerBackupError("")
    setServerBackupHistoryError("")
    setServerBackupMessage("")
    try {
      const result = await apiFetch<{ backup: CloudBackupMetadata }>(
        "/api/business/backup/server-data",
        {
          method: "POST",
          body: JSON.stringify({ triggerType: "MANUAL" }),
        },
      )
      setLatestServerBackup(result.backup)
      setServerBackupHistory((previous) =>
        [
          result.backup,
          ...previous.filter((backup) => backup.id !== result.backup.id),
        ].slice(0, 10),
      )
      setServerBackupMessage(
        "Full server business backup created and encrypted.",
      )
    } catch (reason) {
      console.error("Unable to create server business backup.", reason)
      setServerBackupError(
        reason instanceof ApiResponseError && reason.status === 504
          ? "The backup request timed out. Check backup history before retrying; the server may have completed it."
          : reason instanceof Error
            ? reason.message
            : "Unable to create server backup.",
      )
      try {
        const history = await apiFetch<{ backups: CloudBackupMetadata[] }>(
          "/api/business/backup/server-data",
        )
        setServerBackupHistory(history.backups)
        setServerBackupHistoryError("")
      } catch (historyError) {
        console.error(
          "Unable to refresh server backup history after backup failure.",
          historyError,
        )
        setServerBackupHistoryError(
          historyError instanceof Error
            ? historyError.message
            : "Unable to refresh server backup history.",
        )
      }
    } finally {
      setServerBackupBusy(false)
      setServerBackupProgress(null)
    }
  }

  const restoreServerBackup = async (backupId?: string) => {
    if (!businessId || !session?.token || session.user.offline || !isOnline) {
      setServerBackupError(
        "Sign in online and connect to the internet before restoring a server backup.",
      )
      return
    }
    const backupToRestore = backupId
      ? serverBackupHistory.find((backup) => backup.id === backupId) ??
        (latestServerBackup?.id === backupId ? latestServerBackup : null)
      : latestServerBackup
    if (!backupToRestore?.completedAt) {
      setServerBackupError("There is no completed server backup to restore.")
      return
    }
    if (
      !window.confirm(
        "Restore this full business snapshot? Rows with matching IDs will be restored from the snapshot. Current rows absent from the snapshot will remain. This includes user credential hashes and encrypted payment credentials.",
      )
    ) {
      return
    }

    setServerRestoreBusy(true)
    setServerRestoreBackupId(backupToRestore.id)
    setServerRestoreProgress({ percent: 0, message: "Preparing restore" })
    setServerBackupError("")
    setServerBackupHistoryError("")
    setServerBackupMessage("")
    try {
      const result = await apiFetch<{
        restoredRows: Record<string, number>
      }>("/api/business/restore/server-data", {
        method: "POST",
        body: JSON.stringify({ backupId: backupToRestore.id }),
      })
      const restoredCount = Object.values(result.restoredRows).reduce(
        (total, count) => total + count,
        0,
      )
      setServerBackupMessage(
        `Server restore completed for ${restoredCount} snapshot rows. Current-only rows were retained.`,
      )
      setServerRestoreProgress({ percent: 100, message: "Restore complete" })
    } catch (reason) {
      console.error("Unable to restore server business backup.", reason)
      setServerBackupError(
        reason instanceof ApiResponseError && reason.status === 504
          ? "The restore request timed out. Refresh business data and check whether the restore completed before retrying."
          : reason instanceof Error
            ? reason.message
            : "Unable to restore server backup.",
      )
    } finally {
      setServerRestoreBusy(false)
      setServerRestoreBackupId(null)
      setServerRestoreProgress(null)
    }
  }

  const downloadForOffline = async () => {
    if (
      !businessId ||
      !userId ||
      !session?.token ||
      session.user.offline ||
      !isOnline ||
      !isNative
    ) {
      setError(
        "Sign in online and connect to the internet before downloading offline data.",
      )
      return
    }
    setPrefetching(true)
    setError("")
    setPrefetchProgress({
      total: 1,
      completed: 0,
      current: "Preparing download…",
      failures: [],
    })
    try {
      const result = await prefetchOfflineData(
        businessId,
        userId,
        setPrefetchProgress,
      )
      await refreshCacheIndex()
      if (result.failures.length > 0) {
        setError(
          `${result.failures.length} dataset${
            result.failures.length === 1 ? "" : "s"
          } could not be downloaded. Review the results below and try again while online.`,
        )
      }
    } catch (reason) {
      const message =
        reason instanceof Error
          ? reason.message
          : "Unable to download offline data."
      setError(message)
      console.error("Unable to complete the offline data download.", reason)
    } finally {
      setPrefetching(false)
      void refreshCacheIndex()
    }
  }

  const pendingCount = status.pending
  const failedCount = status.failed
  const hasQueue = pendingCount + failedCount > 0
  useEffect(() => {
    if (hasQueue) setSalesSyncExpanded(true)
  }, [hasQueue])
  const datasets = userId ? cacheDatasets(userId) : []
  const datasetStatus = datasets.map((dataset) => {
    const entries = dataset.cacheKeys.flatMap((key) => {
      if (key.endsWith(":"))
        return cacheIndex.filter((entry) => entry.cacheKey.startsWith(key))
      const entry = cacheIndex.find((item) => item.cacheKey === key)
      return entry ? [entry] : []
    })
    const requiredEntries = dataset.cacheKeys.filter(
      (key) => !key.endsWith(":"),
    )
    const missingCount = requiredEntries.filter(
      (key) => !cacheIndex.some((entry) => entry.cacheKey === key),
    ).length
    const updatedAt =
      entries
        .map((entry) => entry.updatedAt)
        .sort((left, right) => Date.parse(left) - Date.parse(right))[0] ?? null
    return {
      ...dataset,
      entries,
      missingCount,
      ready:
        dataset.label === "Customer histories"
          ? entries.length > 0
          : missingCount === 0 && entries.length > 0,
      updatedAt,
    }
  })
  const readyDatasets = datasetStatus.filter((dataset) => dataset.ready).length
  const restorePointCandidates: RestorePoint[] = []
  for (const [kind, backups] of [
    [
      "Full business",
      [
        ...serverBackupHistory,
        ...(latestServerBackup ? [latestServerBackup] : []),
      ],
    ],
    [
      "Device snapshot",
      [...deviceBackupHistory, ...(latestBackup ? [latestBackup] : [])],
    ],
  ] as const) {
    for (const backup of backups) {
      if (backup.completedAt) restorePointCandidates.push({ ...backup, kind })
    }
  }
  const restorePointsById = new Map<string, RestorePoint>()
  for (const backup of restorePointCandidates) {
    restorePointsById.set(`${backup.kind}:${backup.id}`, backup)
  }
  const restorePoints = Array.from(restorePointsById.values()).sort(
    (left, right) =>
      new Date(right.completedAt ?? 0).getTime() -
      new Date(left.completedAt ?? 0).getTime(),
  )
  const selectedRestorePoint =
    restorePoints.find(
      (backup) =>
        `${backup.kind}:${backup.id}` === selectedRestoreBackupId,
    ) ??
    restorePoints[0] ??
    null
  const canRestoreSelectedBackup =
    !!selectedRestorePoint &&
    isOnline &&
    !!session?.token &&
    !session.user.offline &&
    (selectedRestorePoint.kind !== "Device snapshot" || isNative) &&
    !backingUp &&
    !restoring &&
    !serverBackupBusy &&
    !serverRestoreBusy
  const hasSalesActivity =
    hasQueue || recentlySyncedSales.length > 0 || syncingSaleIds.size > 0
  const salesActivityRow = (
    sale: QueuedOfflineCashSale,
    synced: boolean,
  ) => {
    const unitCount = sale.payload.items.reduce(
      (total, item) => total + item.quantity,
      0,
    )
    const failed = !synced && sale.status === "FAILED"
    const inProgress = !synced && syncingSaleIds.has(sale.id)
    const statusLabel = synced
      ? "Synced"
      : failed
        ? "Failed"
        : inProgress
          ? "Syncing"
          : "Pending"
    const statusColor = synced
      ? c.success
      : failed
        ? c.error
        : inProgress
          ? c.warning
          : c.muted
    const statusBackground = synced
      ? c.successBg
      : failed
        ? c.errorBg
        : inProgress
          ? c.warningBg
          : c.cardAlt

    return (
      <div
        key={sale.id}
        style={{
          border: `1px solid ${c.border}`,
          borderRadius: 13,
          padding: "11px 12px",
          background: c.card,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                color: c.text,
                fontSize: 12,
                fontWeight: 700,
                overflowWrap: "anywhere",
              }}
            >
              {sale.payload.saleNumber}
            </div>
            <div style={{ color: c.muted, fontSize: 10, marginTop: 3 }}>
              {new Date(sale.createdAt).toLocaleString()} · {unitCount} unit
              {unitCount === 1 ? "" : "s"}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 5,
              flexShrink: 0,
            }}
          >
            <div style={{ color: c.text, fontSize: 12, fontWeight: 800 }}>
              KSh {sale.payload.total.toLocaleString()}
            </div>
            <span
              role="status"
              style={{
                padding: "3px 8px",
                borderRadius: 999,
                color: statusColor,
                background: statusBackground,
                fontSize: 9,
                fontWeight: 800,
              }}
            >
              {statusLabel}
            </span>
          </div>
        </div>
        {failed && sale.lastError && (
          <div
            role="note"
            style={{
              marginTop: 7,
              color: c.error,
              fontSize: 10,
              lineHeight: 1.4,
            }}
          >
            {sale.lastError}
          </div>
        )}
      </div>
    )
  }
  return (
    <div className="screen" style={{ background: c.bg }}>
      <div
        style={{
          background: c.headerGradient,
          padding: "52px 20px 24px",
          flexShrink: 0,
          color: c.onNavy,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 20,
          }}
        >
          <button
            className="btn"
            onClick={() => onNavigate("more")}
            style={{
              width: 38,
              height: 38,
              border: `1px solid ${c.navyBorder}`,
              borderRadius: 12,
              background: c.navySurface,
              display: "grid",
              placeItems: "center",
            }}
          >
            <BackupIcon name="arrow-left" size={18} color={c.onNavy} />
          </button>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.2 }}>
              Backup & sync
            </div>
            <div style={{ marginTop: 2, color: c.onNavyMuted, fontSize: 11 }}>
              Business protection center
            </div>
          </div>
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: latestServerBackup?.completedAt ? c.gold : "#FFE082",
              fontSize: 10,
              fontWeight: 800,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: latestServerBackup?.completedAt
                  ? c.gold
                  : "#FFE082",
              }}
            />
            {serverBackupLoading
              ? "Checking"
              : latestServerBackup?.completedAt
                ? "Protected"
                : "Backup needed"}
          </div>
        </div>
        <div
          style={{
            background: c.navySurface,
            borderRadius: 20,
            padding: 18,
            border: `1px solid ${c.navyBorder}`,
            boxShadow: c.shadow,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              aria-hidden="true"
              style={{
                width: 46,
                height: 46,
                borderRadius: 15,
                display: "grid",
                placeItems: "center",
                color: c.gold,
                background: c.navySurface,
                border: `1px solid ${c.navyBorder}`,
                fontSize: 23,
              }}
            >
              <BackupIcon name="shield" size={24} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>
                {latestServerBackup?.completedAt
                  ? "Your business data is protected"
                  : "Set up business protection"}
              </div>
              <div
                role="status"
                style={{
                  color: c.onNavyMuted,
                  fontSize: 11,
                  marginTop: 4,
                }}
              >
                {serverBackupLoading
                  ? "Checking latest business backup…"
                  : latestServerBackup?.completedAt
                    ? `Latest encrypted backup · ${formatBackupDate(latestServerBackup.completedAt)}`
                    : "No full business backup yet"}
              </div>
              <div
                style={{
                  color: c.onNavyFaint,
                  fontSize: 10,
                  marginTop: 5,
                }}
              >
                Full business recovery point
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: c.onNavyFaint, fontSize: 9 }}>
                SNAPSHOT SIZE
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, marginTop: 3 }}>
                {latestServerBackup?.completedAt
                  ? formatPayloadSize(latestServerBackup.originalBytes)
                  : "—"}
              </div>
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              marginTop: 16,
              paddingTop: 13,
              borderTop: `1px solid ${c.navyDivider}`,
            }}
          >
            {[
              {
                label: "Cloud",
                value: serverBackupLoading
                  ? "Checking"
                  : latestServerBackup?.completedAt
                    ? "Saved"
                    : "Needed",
              },
              {
                label: "Device",
                value: loading
                ? "Checking"
                : `${readyDatasets}/${datasets.length} ready`,
              },
              {
                label: "Sales sync",
                value:
                  loading
                    ? "Checking"
                    : syncingSaleIds.size > 0
                      ? `Syncing ${syncingSaleIds.size}`
                      : pendingCount + failedCount > 0
                        ? `${pendingCount + failedCount} waiting`
                        : "Clear",
              },
            ].map((item, index) => (
              <div
                key={item.label}
                style={{
                  textAlign: "center",
                  borderRight:
                    index < 2 ? `1px solid ${c.navyDivider}` : "none",
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    color: c.onNavyFaint,
                    fontSize: 9,
                    textTransform: "uppercase",
                    letterSpacing: 0.6,
                  }}
                >
                  {item.label}
                </div>
                <div
                  style={{
                    marginTop: 3,
                    fontSize: 10,
                    fontWeight: 700,
                    overflowWrap: "anywhere",
                  }}
                >
                  {item.value}
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              borderTop: `1px solid ${c.navyDivider}`,
              marginTop: 12,
              paddingTop: 10,
              color: c.onNavyFaint,
              fontSize: 9,
              lineHeight: 1.5,
            }}
          >
            {loading
              ? "Checking on-device offline data… "
              : `${readyDatasets}/${datasets.length} offline datasets ready. `}
            Full business backups and device snapshots are separate. Cloud
            backups need internet.
          </div>
        </div>
      </div>

      <div
        className="scroll-area backup-screen-content"
        style={{ padding: 16, paddingBottom: 80 }}
      >
        {error && (
          <div
            className="backup-screen-error"
            role="alert"
            style={{
              background: c.errorBg,
              color: "#D32F2F",
              borderRadius: 12,
              padding: "12px 14px",
              marginBottom: 14,
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        )}

        <div
          className="backup-screen-overview"
          style={{ order: 0, marginBottom: 16 }}
        >
          <button
            type="button"
            className="btn"
            onClick={() => void createServerBackup()}
            disabled={
              !isOnline ||
              !session?.token ||
              session.user.offline ||
              serverBackupBusy ||
              serverRestoreBusy
            }
            style={{
              width: "100%",
              minHeight: 50,
              marginBottom: 20,
              border: "none",
              borderRadius: 15,
              background:
                !isOnline ||
                !session?.token ||
                session.user.offline ||
                serverBackupBusy ||
                serverRestoreBusy
                  ? c.cardAlt
                  : c.primaryGradient,
              color:
                !isOnline ||
                !session?.token ||
                session.user.offline ||
                serverBackupBusy ||
                serverRestoreBusy
                  ? c.muted
                  : c.onNavy,
              boxShadow:
                !isOnline ||
                !session?.token ||
                session.user.offline ||
                serverBackupBusy ||
                serverRestoreBusy
                  ? "none"
                  : c.shadow,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 9,
              fontFamily: "inherit",
              fontSize: 14,
              fontWeight: 800,
              cursor:
                !isOnline ||
                !session?.token ||
                session.user.offline ||
                serverBackupBusy ||
                serverRestoreBusy
                  ? "default"
                  : "pointer",
            }}
          >
            <BackupIcon
              name={serverBackupBusy ? "refresh" : "cloud"}
              size={19}
            />
            {serverBackupBusy
              ? `Backing up · ${serverBackupProgress?.percent ?? 0}%`
              : "Back up now"}
          </button>
          {serverBackupBusy && (
            <div aria-live="polite" style={{ margin: "-10px 2px 16px" }}>
              <div
                role="progressbar"
                aria-label="Full business backup progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={serverBackupProgress?.percent ?? 0}
                aria-valuetext={`${serverBackupProgress?.percent ?? 0}% complete`}
                style={{
                  height: 5,
                  borderRadius: 999,
                  overflow: "hidden",
                  background: c.cardAlt,
                }}
              >
                <div
                  style={{
                    width: `${serverBackupProgress?.percent ?? 0}%`,
                    height: "100%",
                    borderRadius: 999,
                    background: c.successGradient,
                    transition: "width 160ms ease",
                  }}
                />
              </div>
              <div
                style={{
                  marginTop: 6,
                  color: c.muted,
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                {serverBackupProgress?.message ?? "Preparing business backup"}
              </div>
            </div>
          )}
          {(serverBackupError || backupError) && (
            <div
              role="alert"
              style={{
                background: c.errorBg,
                color: "#D32F2F",
                borderRadius: 10,
                padding: "10px 12px",
                margin: "-8px 0 14px",
                fontSize: 11,
                lineHeight: 1.5,
              }}
            >
              {serverBackupError || backupError}
            </div>
          )}
          {(serverBackupMessage || restoreMessage) && (
            <div
              role="status"
              style={{
                background: "rgba(46, 125, 50, 0.1)",
                color: "#2E7D32",
                borderRadius: 10,
                padding: "10px 12px",
                margin: "-8px 0 14px",
                fontSize: 11,
                lineHeight: 1.5,
              }}
            >
              {serverBackupMessage || restoreMessage}
            </div>
          )}

          <div
            style={{
              color: c.muted,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 0.8,
              textTransform: "uppercase",
              margin: "0 4px 8px",
            }}
          >
            Protection
          </div>
          <section
            className="card"
            aria-label="Backup and sync protection status"
            style={{ marginBottom: 16 }}
          >
            {[
              {
                icon: "database" as const,
                title: "Business cloud backup",
                detail: serverBackupLoading
                  ? "Checking latest backup…"
                  : latestServerBackup?.completedAt
                    ? `Last backup · ${formatBackupDate(latestServerBackup.completedAt)}`
                    : "No full business backup yet",
                status: serverBackupLoading
                  ? "Checking"
                  : latestServerBackup?.completedAt
                    ? "Saved"
                    : "Needed",
                tone: latestServerBackup?.completedAt ? c.success : c.warning,
                background: latestServerBackup?.completedAt
                  ? c.successBg
                  : c.warningBg,
              },
              {
                icon: "device" as const,
                title: "Offline data on this device",
                detail: !isNative
                  ? "Available in the installed app"
                  : loading
                    ? "Checking saved datasets…"
                    : `${readyDatasets} of ${datasets.length} datasets ready`,
                status: !isNative
                  ? "Native app"
                  : loading
                    ? "Checking"
                    : readyDatasets === datasets.length
                      ? "Ready"
                      : "Prepare",
                tone:
                  isNative && readyDatasets === datasets.length
                    ? c.success
                    : c.primary,
                background:
                  isNative && readyDatasets === datasets.length
                    ? c.successBg
                    : c.infoBg,
              },
              {
                icon: "refresh" as const,
                title: "Sales sync",
                detail: syncing
                  ? `Sending ${syncingSaleIds.size || "queued"} sales to the server…`
                  : failedCount > 0
                    ? `${failedCount} failed · ${pendingCount} waiting`
                    : hasQueue
                      ? `${pendingCount} sales waiting to sync`
                      : "All queued sales are synced",
                status: syncing
                  ? "Syncing"
                  : failedCount > 0
                    ? "Attention"
                    : hasQueue
                      ? "Needs sync"
                      : "Synced",
                tone:
                  failedCount > 0 || syncing || hasQueue
                    ? c.warning
                    : c.success,
                background:
                  failedCount > 0 || syncing || hasQueue
                    ? c.warningBg
                    : c.successBg,
              },
            ].map((item, index) => (
              <div
                key={item.title}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "14px 15px",
                  borderBottom: index < 2 ? c.divider : "none",
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    flexShrink: 0,
                    display: "grid",
                    placeItems: "center",
                    color: item.tone,
                    background: item.background,
                  }}
                >
                  <BackupIcon name={item.icon} size={19} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: c.text, fontSize: 12, fontWeight: 700 }}>
                    {item.title}
                  </div>
                  <div
                    style={{
                      marginTop: 2,
                      color: c.muted,
                      fontSize: 10,
                      lineHeight: 1.4,
                    }}
                  >
                    {item.detail}
                  </div>
                </div>
                <div
                  style={{
                    padding: "4px 8px",
                    borderRadius: 999,
                    color: item.tone,
                    background: item.background,
                    fontSize: 9,
                    fontWeight: 800,
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.status}
                </div>
              </div>
            ))}
          </section>
        </div>

        {isNative && (
          <>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: c.muted,
                letterSpacing: 0.6,
                textTransform: "uppercase",
                margin: "2px 4px 8px",
              }}
            >
              On this device
            </div>
            <details className="card" style={{ marginBottom: 14 }}>
              <summary
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 11,
                  padding: 15,
                  cursor: "pointer",
                  listStyle: "none",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 36,
                    height: 36,
                    display: "grid",
                    placeItems: "center",
                    borderRadius: 10,
                    color: c.primary,
                    background: c.infoBg,
                    flexShrink: 0,
                  }}
                >
                  <BackupIcon name="device" size={19} />
                </span>
                <span style={{ flex: 1 }}>
                  <span
                    style={{
                      display: "block",
                      color: c.text,
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    Saved offline data
                  </span>
                  <span
                    role="status"
                    style={{
                      display: "block",
                      marginTop: 3,
                      color: c.muted,
                      fontSize: 10,
                    }}
                  >
                    {cacheIndexLoading
                      ? "Checking saved datasets…"
                      : `${readyDatasets}/${datasets.length} datasets ready`}
                  </span>
                </span>
                <BackupIcon name="chevron" size={17} color={c.muted} />
              </summary>
              <div style={{ padding: "0 15px 15px" }}>
              <div style={{ display: "grid", gap: 8 }}>
                {datasetStatus.map((dataset) => (
                  <div
                    key={dataset.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 11,
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: 16,
                        color: dataset.ready ? "#2E7D32" : c.faint,
                      }}
                    >
                      {dataset.ready ? "✓" : "○"}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        color: dataset.ready ? c.text : c.muted,
                      }}
                    >
                      {dataset.label}
                    </span>
                    {dataset.label === "Customer histories" &&
                      dataset.entries.length > 0 && (
                        <span style={{ color: c.muted }}>
                          {dataset.entries.length}
                        </span>
                      )}
                    {dataset.updatedAt && (
                      <span style={{ color: c.faint, whiteSpace: "nowrap" }}>
                        {new Date(dataset.updatedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {!cacheIndexLoading && readyDatasets < datasets.length && (
                <div
                  style={{
                    marginTop: 10,
                    fontSize: 11,
                    color: c.muted,
                    lineHeight: 1.5,
                  }}
                >
                  Missing saved data can limit offline screens. Run the download
                  while online to refresh these snapshots.
                </div>
              )}
              <div
                style={{ borderTop: c.divider, marginTop: 14, paddingTop: 12 }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    gap: 8,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: c.text }}>
                    On-device storage estimate
                  </div>
                  <div
                    role="status"
                    aria-label={
                      storageUsageLoading
                        ? "Checking local SQLite payload size"
                        : `Estimated local SQLite payload size: ${formatPayloadSize(storageUsage.cachedPayloadBytes + storageUsage.queuedPayloadBytes)}`
                    }
                    style={{ fontSize: 13, fontWeight: 800, color: c.text }}
                  >
                    {storageUsageLoading
                      ? "Checking…"
                      : formatPayloadSize(
                          storageUsage.cachedPayloadBytes +
                            storageUsage.queuedPayloadBytes,
                        )}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    marginTop: 6,
                    fontSize: 11,
                    color: c.muted,
                  }}
                >
                  <span>
                    {storageUsage.cachedCollections} saved snapshots ·{" "}
                    {storageUsageLoading
                      ? "…"
                      : formatPayloadSize(storageUsage.cachedPayloadBytes)}
                  </span>
                  <span>
                    {storageUsage.queuedRecords} queued records ·{" "}
                    {storageUsageLoading
                      ? "…"
                      : formatPayloadSize(storageUsage.queuedPayloadBytes)}
                  </span>
                </div>
                <div
                  style={{
                    marginTop: 7,
                    fontSize: 10,
                    color: c.faint,
                    lineHeight: 1.5,
                  }}
                >
                  Approximate collection and queued-record JSON payload size for
                  this business. It excludes the offline PIN roster, SQLite
                  indexes, and database overhead; this is not cloud usage or a
                  device quota.
                </div>
              </div>
            </div>
            </details>
          </>
        )}

        {isNative && hasSalesActivity && (
          <details
            className="card"
            open={salesSyncExpanded}
            onToggle={(event) =>
              setSalesSyncExpanded(event.currentTarget.open)
            }
            style={{ marginBottom: 14, order: 0 }}
          >
            <summary
              style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                padding: 15,
                cursor: "pointer",
                listStyle: "none",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 36,
                  height: 36,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: 10,
                  color: c.primary,
                  background: c.infoBg,
                  flexShrink: 0,
                }}
              >
                <BackupIcon name="refresh" size={19} />
              </span>
              <span style={{ flex: 1 }}>
                <span
                  id="sales-activity-heading"
                  style={{
                    display: "block",
                    color: c.text,
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  Sales sync activity
                </span>
                <span
                  role="status"
                  style={{
                    display: "block",
                    marginTop: 3,
                    color: c.muted,
                    fontSize: 10,
                  }}
                >
                  {`${recentlySyncedSales.length} synced · ${
                    pendingCount + failedCount
                  } waiting`}
                </span>
              </span>
              <span
                style={{
                  transform: salesSyncExpanded ? "rotate(90deg)" : "none",
                  transition: "transform 160ms ease",
                }}
              >
                <BackupIcon name="chevron" size={17} color={c.muted} />
              </span>
            </summary>
            <div style={{ padding: "0 15px 15px" }}>
              <button
                type="button"
                className="btn"
                onClick={() => void syncNow()}
                disabled={
                  !hasQueue ||
                  syncing ||
                  backingUp ||
                  !isOnline ||
                  !session?.token ||
                  session.user.offline
                }
                style={{
                  width: "100%",
                  minHeight: 40,
                  marginBottom: 12,
                  border: "none",
                  borderRadius: 10,
                  background:
                    hasQueue &&
                    !syncing &&
                    !backingUp &&
                    isOnline &&
                    !!session?.token &&
                    !session.user.offline
                      ? c.primaryGradient
                      : c.cardAlt,
                  color:
                    hasQueue &&
                    !syncing &&
                    !backingUp &&
                    isOnline &&
                    !!session?.token &&
                    !session.user.offline
                      ? c.onNavy
                      : c.muted,
                  fontFamily: "inherit",
                  fontSize: 11,
                  fontWeight: 800,
                  cursor:
                    hasQueue &&
                    !syncing &&
                    !backingUp &&
                    isOnline &&
                    !!session?.token &&
                    !session.user.offline
                      ? "pointer"
                      : "default",
                }}
              >
                {syncing
                  ? `Syncing ${syncingSaleIds.size || "queued"} sales…`
                  : failedCount > 0
                    ? `Retry and sync ${pendingCount + failedCount} sales`
                    : hasQueue
                      ? `Sync ${pendingCount} waiting sales now`
                      : "All sales synced"}
              </button>
            {queuedSalesLoading && (
              <div role="status" style={{ color: c.muted, fontSize: 11 }}>
                Checking queued sales…
              </div>
            )}
            {recentlySyncedSales.length > 0 && (
              <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
                <div
                  style={{
                    color: c.muted,
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: 0.6,
                    textTransform: "uppercase",
                  }}
                >
                  Recently synced
                </div>
                {recentlySyncedSales
                  .slice(0, 50)
                  .map((sale) => salesActivityRow(sale, true))}
              </div>
            )}
            {queuedSales.length > 0 && (
              <div style={{ display: "grid", gap: 8 }}>
                {recentlySyncedSales.length > 0 && (
                  <div
                    style={{
                      color: c.muted,
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: 0.6,
                      textTransform: "uppercase",
                    }}
                  >
                    Waiting to sync
                  </div>
                )}
                {queuedSales.slice(0, 50).map((sale) =>
                  salesActivityRow(sale, false),
                )}
              </div>
            )}
            {queuedSales.length === 0 &&
              recentlySyncedSales.length === 0 &&
              !queuedSalesLoading && (
                <div style={{ fontSize: 12, color: c.muted }}>
                  The sync queue is empty.
                </div>
              )}
            {queuedSales.length > 50 && (
              <div style={{ marginTop: 8, color: c.muted, fontSize: 10 }}>
                Showing the 50 most recent unsent sales. Queue counts include
                all unsent sales.
              </div>
            )}
            </div>
          </details>
        )}

        <details
          className="card"
          aria-labelledby="offline-preparation-heading"
          open={offlinePreparationExpanded}
          onToggle={(event) =>
            setOfflinePreparationExpanded(event.currentTarget.open)
          }
          style={{
            marginBottom: 14,
            overflow: "visible",
            border: `1px solid ${c.border}`,
            boxShadow: "0 3px 12px rgba(13,27,61,0.06)",
            order: 0,
          }}
        >
          <summary
            style={{
              display: "flex",
              alignItems: "center",
              gap: 11,
              padding: 15,
              cursor: "pointer",
              listStyle: "none",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 36,
                height: 36,
                flex: "0 0 36px",
                display: "grid",
                placeItems: "center",
                borderRadius: 10,
                background: "rgba(18,58,143,0.09)",
                color: "#123A8F",
                fontSize: 18,
              }}
            >
              ↓
            </span>
            <span style={{ flex: 1 }}>
              <h2
                id="offline-preparation-heading"
                style={{
                  margin: "0 0 3px",
                  fontSize: 13,
                  lineHeight: 1.35,
                  fontWeight: 700,
                  color: c.text,
                }}
              >
                Prepare this device for offline use
              </h2>
              <div style={{ fontSize: 10, color: c.muted }}>
                Save supported business data to this device
              </div>
            </span>
            <span
              style={{
                transform: offlinePreparationExpanded ? "rotate(90deg)" : "none",
                transition: "transform 160ms ease",
              }}
            >
              <BackupIcon name="chevron" size={17} color={c.muted} />
            </span>
          </summary>
          <div style={{ padding: "0 16px 16px" }}>
          <div
            style={{
              fontSize: 12,
              color: c.muted,
              lineHeight: 1.55,
              display: "block",
              width: "100%",
              minWidth: 0,
              whiteSpace: "normal",
              overflowWrap: "anywhere",
              margin: "0 0 13px",
            }}
          >
            Download supported dashboard, report, catalog, business-record,
            settings, shift, profile, receipt, and customer snapshots. This also
            saves each customer&apos;s latest 20 sales and credit entries;
            businesses with many customers may take longer. Stay online and
            signed in until it finishes.
          </div>
          <button
            className="btn"
            onClick={() => void downloadForOffline()}
            disabled={
              !isNative ||
              !isOnline ||
              !session?.token ||
              session.user.offline ||
              prefetching ||
              syncing ||
              backingUp
            }
            style={{
              width: "100%",
              padding: 14,
              background:
                !isNative ||
                !isOnline ||
                !session?.token ||
                session.user.offline ||
                prefetching ||
                syncing ||
                backingUp
                  ? c.cardAlt
                  : "linear-gradient(135deg, #123A8F, #1A4FBF)",
              border: "none",
              borderRadius: 12,
              color:
                !isNative ||
                !isOnline ||
                !session?.token ||
                session.user.offline ||
                prefetching ||
                syncing ||
                backingUp
                  ? c.muted
                  : "white",
              fontSize: 14,
              fontWeight: 700,
              textAlign: "center",
              cursor:
                !isNative ||
                !isOnline ||
                !session?.token ||
                session.user.offline ||
                prefetching ||
                syncing ||
                backingUp
                  ? "default"
                  : "pointer",
              fontFamily: "inherit",
            }}
          >
            {prefetching
              ? "Downloading offline data…"
              : "Download data for offline use"}
          </button>
          {prefetchProgress && (
            <div aria-live="polite" style={{ marginTop: 14 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                  fontSize: 11,
                  color: c.muted,
                  marginBottom: 6,
                }}
              >
                <span>
                  {prefetchProgress.completed === prefetchProgress.total &&
                  !prefetchProgress.current
                    ? "Download finished"
                    : prefetchProgress.current || "Preparing download…"}
                </span>
                <span>
                  {prefetchProgress.completed}/{prefetchProgress.total}
                </span>
              </div>
              <div
                role="progressbar"
                aria-label="Offline data download progress"
                aria-valuemin={0}
                aria-valuemax={prefetchProgress.total}
                aria-valuenow={prefetchProgress.completed}
                style={{
                  height: 9,
                  overflow: "hidden",
                  borderRadius: 6,
                  background: c.cardAlt,
                }}
              >
                <div
                  style={{
                    width: `${
                      prefetchProgress.total
                        ? Math.round(
                            (prefetchProgress.completed /
                              prefetchProgress.total) *
                              100,
                          )
                        : 0
                    }%`,
                    height: "100%",
                    background: "linear-gradient(90deg, #123A8F, #2E7D32)",
                    transition: "width 180ms ease",
                  }}
                />
              </div>
              {prefetchProgress.failures.length > 0 && (
                <div
                  style={{
                    marginTop: 10,
                    color: "#C62828",
                    fontSize: 11,
                    lineHeight: 1.5,
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>
                    Not downloaded:
                  </div>
                  {prefetchProgress.failures.map((failure) => (
                    <div key={failure}>• {failure}</div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div
            role="status"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "15px 0 0",
              marginTop: 14,
              borderTop: c.divider,
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: c.text }}>
                Automatic sales sync
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: c.muted,
                  marginTop: 3,
                  lineHeight: 1.4,
                }}
              >
                Queued sales upload when internet is available; they remain
                saved on this device while offline.
              </div>
            </div>
            <span
              style={{
                padding: "4px 8px",
                borderRadius: 999,
                color: c.success,
                background: c.successBg,
                fontSize: 9,
                fontWeight: 800,
                whiteSpace: "nowrap",
              }}
            >
              Automatic
            </span>
          </div>
          </div>
        </details>

        <div className="backup-primary">
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: c.muted,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              margin: "2px 4px 8px",
            }}
          >
            Recovery
          </div>

          <details style={{ marginBottom: 14 }}>
            <summary
              className="card"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: 15,
                cursor: "pointer",
                listStyle: "none",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: c.infoBg,
                  color: c.primary,
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                }}
              >
                <BackupIcon name="restore" size={20} />
              </span>
              <span style={{ flex: 1 }}>
                <span
                  style={{
                    display: "block",
                    color: c.text,
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  Restore from a backup
                </span>
                <span
                  style={{
                    display: "block",
                    marginTop: 3,
                    color: c.muted,
                    fontSize: 10,
                  }}
                >
                  Full business data or this device&apos;s offline snapshot
                </span>
              </span>
              <span
                aria-hidden="true"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 11,
                  background: c.cardAlt,
                  color: c.muted,
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <BackupIcon name="chevron" size={17} />
              </span>
            </summary>
            <div style={{ paddingTop: 12 }}>
          <section
            className="card"
            aria-labelledby="restore-points-heading"
            style={{ padding: 15, marginBottom: 14 }}
          >
            <h3
              id="restore-points-heading"
              style={{
                margin: "0 0 8px",
                color: c.text,
                fontSize: 13,
              }}
            >
              Select a restore point
            </h3>
            {restorePoints.length === 0 ? (
              <div style={{ color: c.muted, fontSize: 11 }}>
                No completed backups are available to restore.
              </div>
            ) : (
              <div
                role="radiogroup"
                aria-label="Available backup restore points"
                style={{ maxHeight: 280, overflowY: "auto" }}
              >
                {restorePoints.map((backup) => {
                  const selected =
                    !!selectedRestorePoint &&
                    `${selectedRestorePoint.kind}:${selectedRestorePoint.id}` ===
                      `${backup.kind}:${backup.id}`
                  const recordSummary =
                    backup.kind === "Full business"
                      ? backup.recordCount == null
                        ? "Record count unavailable"
                        : `${backup.recordCount.toLocaleString()} records`
                      : backup.collectionCount == null ||
                          backup.queuedRecordCount == null
                        ? "Entry counts unavailable"
                        : `${backup.collectionCount.toLocaleString()} collections · ${backup.queuedRecordCount.toLocaleString()} queued records`

                  return (
                    <button
                      key={`${backup.kind}-${backup.id}`}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={restoring || serverRestoreBusy}
                      className="btn"
                      onClick={() =>
                        setSelectedRestoreBackupId(
                          `${backup.kind}:${backup.id}`,
                        )
                      }
                      style={{
                        width: "100%",
                        padding: "10px 0",
                        border: "none",
                        borderTop: c.divider,
                        background: "none",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        textAlign: "left",
                        fontFamily: "inherit",
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          border: `2px solid ${selected ? c.primary : c.faint}`,
                          display: "grid",
                          placeItems: "center",
                          flexShrink: 0,
                        }}
                      >
                        {selected && (
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: c.primary,
                            }}
                          />
                        )}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span
                          style={{
                            display: "block",
                            color: c.text,
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {backup.kind} · {formatBackupDate(backup.completedAt)}
                        </span>
                        <span
                          style={{
                            display: "block",
                            marginTop: 3,
                            color: c.muted,
                            fontSize: 9,
                            lineHeight: 1.4,
                          }}
                        >
                          {recordSummary} ·{" "}
                          {formatPayloadSize(backup.compressedBytes)}
                        </span>
                      </span>
                      <BackupIcon
                        name={
                          backup.kind === "Full business" ? "database" : "device"
                        }
                        size={17}
                        color={c.muted}
                      />
                    </button>
                  )
                })}
              </div>
            )}
          </section>
          <section
            className="card"
            aria-labelledby="server-backup-heading"
            style={{ padding: 16, marginBottom: 14 }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: c.text,
                marginBottom: 6,
              }}
            >
              <h2
                id="server-backup-heading"
                style={{ display: "inline", margin: 0, fontSize: "inherit" }}
              >
                Full business backup · cloud database
              </h2>
            </div>
            <div
              style={{
                fontSize: 12,
                color: c.muted,
                lineHeight: 1.6,
                marginBottom: 12,
              }}
            >
              Copies this business&apos;s PostgreSQL records, including
              products, inventory, sales, customers, staff, settings, and
              financial history. The encrypted snapshot is stored in the same
              server database as live records.
            </div>
            <div style={{ fontSize: 11, color: c.muted, marginBottom: 12 }}>
              {serverBackupLoading
                ? "Checking server backups…"
                : latestServerBackup?.completedAt
                  ? `Last server backup: ${new Date(latestServerBackup.completedAt).toLocaleString()} · ${formatPayloadSize(latestServerBackup.originalBytes)}`
                  : "Last server backup: Never"}
            </div>
            <div
              role="note"
              style={{
                marginTop: 10,
                fontSize: 10,
                color: c.faint,
                lineHeight: 1.5,
              }}
            >
              Requires business settings permission and the server encryption
              key. Includes staff password/PIN hashes and encrypted payment
              credentials. Up to 10 snapshots are retained. Keep an independent
              off-site database backup too.
            </div>
            <div
              role="note"
              style={{
                marginTop: 10,
                fontSize: 10,
                color: c.faint,
                lineHeight: 1.5,
              }}
            >
              Restore is transactional and non-destructive: snapshot values
              replace matching IDs, current-only records are kept, and backup
              archives are not changed. Unique-key conflicts abort the entire
              restore.
            </div>
          </section>

          <section
            className="card"
            aria-labelledby="cloud-backup-heading"
            style={{ padding: 16, marginBottom: 14 }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: c.text,
                marginBottom: 6,
              }}
            >
              <h2
                id="cloud-backup-heading"
                style={{ display: "inline", margin: 0, fontSize: "inherit" }}
              >
                Device snapshot · encrypted cloud copy
              </h2>
            </div>
            <div
              style={{
                fontSize: 12,
                color: c.muted,
                lineHeight: 1.6,
                marginBottom: 12,
              }}
            >
              Copies this device&apos;s saved offline collections and queued
              sync records to encrypted storage in the server database. Restore
              writes the snapshot back to this device&apos;s SQLite database.
              This is not a full business-data backup.
            </div>
            <div style={{ fontSize: 11, color: c.muted, marginBottom: 12 }}>
              {backupMetadataLoading
                ? "Checking cloud backup…"
                : latestBackup?.completedAt
                  ? `Latest device snapshot: ${new Date(latestBackup.completedAt).toLocaleString()} · ${formatPayloadSize(latestBackup.originalBytes)}`
                  : "No device snapshot backed up yet"}
            </div>
            <button
              className="btn"
              onClick={() => void createCloudBackup()}
              disabled={
                !isNative ||
                !isOnline ||
                !session?.token ||
                session.user.offline ||
                backingUp ||
                restoring ||
                prefetching ||
                syncing
              }
              style={{
                width: "100%",
                padding: 14,
                background:
                  !isNative ||
                  !isOnline ||
                  !session?.token ||
                  session.user.offline ||
                  backingUp ||
                  restoring ||
                  prefetching ||
                  syncing
                    ? c.cardAlt
                    : c.primaryGradient,
                border: "none",
                borderRadius: 12,
                color:
                  !isNative ||
                  !isOnline ||
                  !session?.token ||
                  session.user.offline ||
                  backingUp ||
                  restoring ||
                  prefetching ||
                  syncing
                    ? c.muted
                    : "white",
                fontSize: 14,
                fontWeight: 700,
                cursor:
                  !isNative ||
                  !isOnline ||
                  !session?.token ||
                  session.user.offline ||
                  backingUp ||
                  restoring ||
                  prefetching ||
                  syncing
                    ? "default"
                    : "pointer",
                fontFamily: "inherit",
              }}
            >
              {backingUp
                ? `Uploading encrypted backup (${backupProgress?.completed ?? 0}/${backupProgress?.total ?? "…"} chunks)`
                : "Back up this device snapshot"}
            </button>
            {backupProgress && backupProgress.total > 0 && (
              <div
                role="progressbar"
                aria-label="Cloud backup upload progress"
                aria-valuemin={0}
                aria-valuemax={backupProgress.total}
                aria-valuenow={backupProgress.completed}
                style={{
                  height: 7,
                  overflow: "hidden",
                  borderRadius: 5,
                  background: c.cardAlt,
                  marginTop: 12,
                }}
              >
                <div
                  style={{
                    width: `${Math.round((backupProgress.completed / backupProgress.total) * 100)}%`,
                    height: "100%",
                    background: "#2E7D32",
                    transition: "width 180ms ease",
                  }}
                />
              </div>
            )}
            <div
              role="note"
              style={{
                marginTop: 10,
                fontSize: 10,
                color: c.faint,
                lineHeight: 1.5,
              }}
            >
              Requires the installed app, internet, and business settings
              permission. PIN hashes and payment credentials are excluded. Up to
              10 device snapshots are retained in the server database.
            </div>
            {deviceBackupUnavailableReason && (
              <div
                role="status"
                style={{
                  marginTop: 8,
                  fontSize: 11,
                  color: c.muted,
                  lineHeight: 1.5,
                }}
              >
                {deviceBackupUnavailableReason}
              </div>
            )}
          </section>
              <button
                type="button"
                className="btn"
                disabled={
                  !canRestoreSelectedBackup
                }
                onClick={() => {
                  if (!selectedRestorePoint) return
                  if (selectedRestorePoint.kind === "Full business") {
                    void restoreServerBackup(selectedRestorePoint.id)
                  } else {
                    void restoreCloudBackup(selectedRestorePoint.id)
                  }
                }}
                style={{
                  width: "100%",
                  minHeight: 44,
                  marginTop: 2,
                  border: "none",
                  borderRadius: 12,
                  background: canRestoreSelectedBackup
                    ? c.primaryGradient
                    : c.cardAlt,
                  color: canRestoreSelectedBackup ? c.onNavy : c.muted,
                  fontFamily: "inherit",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: canRestoreSelectedBackup ? "pointer" : "default",
                }}
              >
                {serverRestoreBusy
                  ? `Restoring business data… ${serverRestoreProgress?.percent ?? 0}%`
                  : restoring
                    ? "Restoring device snapshot…"
                    : "Restore selected backup"}
              </button>
              {serverRestoreBusy && (
                <div style={{ marginTop: 10 }}>
                  <div
                    role="progressbar"
                    aria-label="Full business restore progress"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={serverRestoreProgress?.percent ?? 0}
                    aria-valuetext={`${serverRestoreProgress?.percent ?? 0}% complete`}
                    style={{
                      height: 6,
                      overflow: "hidden",
                      borderRadius: 999,
                      background: c.cardAlt,
                    }}
                  >
                    <div
                      style={{
                        width: `${serverRestoreProgress?.percent ?? 0}%`,
                        height: "100%",
                        borderRadius: 999,
                        background: c.primaryGradient,
                        transition: "width 250ms ease",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 8,
                      marginTop: 5,
                      fontSize: 10,
                      color: c.muted,
                    }}
                  >
                    <span>
                      {serverRestoreProgress?.message ?? "Preparing restore"}
                    </span>
                    <span>{serverRestoreProgress?.percent ?? 0}%</span>
                  </div>
                </div>
              )}
              {restoring && (
                <div
                  role="status"
                  style={{
                    marginTop: 8,
                    color: c.muted,
                    fontSize: 10,
                  }}
                >
                  Restoring saved collections to this device&apos;s SQLite
                  database…
                </div>
              )}
            </div>
          </details>

          <h2
            id="backup-sync-settings-heading"
            style={{
              margin: "2px 4px 8px",
              fontSize: 11,
              fontWeight: 700,
              color: c.muted,
              letterSpacing: 0.6,
              textTransform: "uppercase",
            }}
          >
            Automatic backup
          </h2>
          <section
            className="card"
            aria-label="Automatic backup settings"
            style={{ marginBottom: 14 }}
          >
            {[
              {
                label: "Automatic backups",
                description:
                  autoBackupFrequency === "DAILY"
                    ? "Daily at 6:00 AM UTC"
                    : autoBackupFrequency === "WEEKLY"
                      ? "Weekly on Monday at 6:00 AM UTC"
                      : "Monthly on the 1st at 6:00 AM UTC",
                value: autoBackupEnabled,
                change: (value: boolean) =>
                  void saveBackupSettings({ autoBackup: value }),
              },
              {
                label: "Wi-Fi only",
                description: "Avoid mobile data for device copies",
                value: autoBackupWifiOnly,
                change: (value: boolean) =>
                  void saveBackupSettings({ autoBackupWifiOnly: value }),
              },
            ].map((setting, index) => (
              <div
                key={setting.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "15px",
                  borderTop: index === 0 ? "none" : c.divider,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: c.text }}>
                    {setting.label}
                  </div>
                  <div style={{ fontSize: 10, color: c.muted, marginTop: 3 }}>
                    {setting.description}
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={setting.value}
                  aria-label={setting.label}
                  disabled={
                    backupSettingsLoading ||
                    backupSettingsSaving ||
                    !session?.token ||
                    session.user.offline
                  }
                  onClick={() => setting.change(!setting.value)}
                  style={{
                    width: 42,
                    height: 24,
                    flexShrink: 0,
                    border: 0,
                    borderRadius: 12,
                    padding: 3,
                    background: setting.value ? "#2E7D32" : c.border,
                    display: "flex",
                    justifyContent: setting.value ? "flex-end" : "flex-start",
                    alignItems: "center",
                    cursor:
                      backupSettingsLoading || backupSettingsSaving
                        ? "default"
                        : "pointer",
                    opacity:
                      backupSettingsLoading || backupSettingsSaving ? 0.6 : 1,
                  }}
                >
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: "white",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                    }}
                  />
                </button>
              </div>
            ))}
            {autoBackupEnabled && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr minmax(140px, 45%)",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 15px 15px",
                  borderTop: c.divider,
                }}
              >
                <div>
                  <label
                    htmlFor="auto-backup-frequency"
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: c.text,
                    }}
                  >
                    Backup frequency
                  </label>
                  <div
                    style={{
                      fontSize: 9,
                      color: c.muted,
                      marginTop: 3,
                      lineHeight: 1.4,
                    }}
                  >
                    {autoBackupFrequency === "DAILY"
                      ? "Runs every day at 6:00 AM UTC."
                      : autoBackupFrequency === "WEEKLY"
                        ? "Runs every Monday at 6:00 AM UTC."
                        : "Runs on the first day of each month at 6:00 AM UTC."}
                  </div>
                </div>
                <select
                  id="auto-backup-frequency"
                  value={autoBackupFrequency}
                  disabled={
                    backupSettingsLoading ||
                    backupSettingsSaving ||
                    !session?.token ||
                    session.user.offline
                  }
                  onChange={(event) => {
                    if (isAutoBackupFrequency(event.target.value)) {
                      void saveBackupSettings({
                        autoBackupFrequency: event.target.value,
                      })
                    }
                  }}
                  style={{
                    width: "100%",
                    minHeight: 38,
                    border: `1px solid ${c.border}`,
                    borderRadius: 8,
                    padding: "0 10px",
                    background: c.card,
                    color: c.text,
                    font: "inherit",
                    fontSize: 12,
                  }}
                >
                  {AUTO_BACKUP_FREQUENCIES.map((frequency) => (
                    <option key={frequency} value={frequency}>
                      {frequency.charAt(0) + frequency.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div
              role="status"
              style={{
                fontSize: 10,
                color: c.faint,
                lineHeight: 1.5,
                marginTop: 4,
              }}
            >
              {backupSettingsLoading
                ? "Loading saved backup settings…"
                : backupSettingsSaving
                  ? "Saving backup settings…"
                  : !isNative
                    ? "Wi-Fi type can only be detected by Capacitor in the installed app. Browser builds cannot distinguish Wi-Fi from mobile data."
                    : autoBackupWifiOnly
                      ? `Automatic device snapshots require Wi-Fi. Current connection: ${
                          networkType === "wifi"
                            ? "Wi-Fi"
                            : networkType === "cellular"
                              ? "cellular data"
                              : networkType
                        }.`
                      : "Automatic device snapshots may use any available internet connection."}
            </div>
          </section>

          <h2
            id="backup-history-heading"
            style={{
              margin: "2px 4px 8px",
              fontSize: 11,
              fontWeight: 700,
              color: c.muted,
              letterSpacing: 0.6,
              textTransform: "uppercase",
            }}
          >
            Backup history
          </h2>
          <section
            className="card"
            aria-label="Backup history"
            style={{ marginBottom: 14 }}
          >
            {[
              ...serverBackupHistory.map((backup) => ({
                ...backup,
                kind: "Full business" as const,
              })),
              ...deviceBackupHistory.map((backup) => ({
                ...backup,
                kind: "Device snapshot" as const,
              })),
            ]
              .sort(
                (a, b) =>
                  new Date(b.completedAt ?? b.createdAt ?? 0).getTime() -
                  new Date(a.completedAt ?? a.createdAt ?? 0).getTime(),
              )
              .slice(0, 3)
              .map((backup, index, visibleBackups) => (
                <div
                  key={`${backup.kind}-${backup.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "13px 15px",
                    borderBottom:
                      index < visibleBackups.length - 1 ? c.divider : "none",
                  }}
                >
                  <div
                    aria-label={
                      backup.status === "FAILED"
                        ? "Backup failed"
                        : "Backup completed successfully"
                    }
                    style={{
                      width: 27,
                      height: 27,
                      flexShrink: 0,
                      borderRadius: "50%",
                      display: "grid",
                      placeItems: "center",
                      background:
                        backup.status === "FAILED"
                          ? "rgba(211, 47, 47, 0.12)"
                          : "rgba(46, 125, 50, 0.12)",
                      color: backup.status === "FAILED" ? "#D32F2F" : "#2E7D32",
                      fontSize: 15,
                      fontWeight: 800,
                    }}
                  >
                    {backup.status === "FAILED" ? "×" : "✓"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{ fontSize: 11, fontWeight: 700, color: c.text }}
                    >
                      {backup.kind}
                    </div>
                    <div style={{ fontSize: 10, color: c.muted, marginTop: 3 }}>
                      {backup.kind === "Full business"
                        ? backup.recordCount == null
                          ? "Record count unavailable"
                          : `${backup.recordCount.toLocaleString()} records`
                        : backup.collectionCount == null ||
                            backup.queuedRecordCount == null
                          ? "Entry counts unavailable"
                          : `${backup.collectionCount.toLocaleString()} cached collections · ${backup.queuedRecordCount.toLocaleString()} queued records`}
                      {" · "}
                      {backup.compressedBytes > 0
                        ? formatPayloadSize(backup.compressedBytes)
                        : "Size unavailable"}
                      {backup.retryCount
                        ? ` · Retried ${backup.retryCount}×`
                        : ""}
                    </div>
                    {backup.status === "FAILED" && (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 8,
                          marginTop: 5,
                        }}
                      >
                        <div
                          style={{
                            color: "#D32F2F",
                            fontSize: 10,
                            lineHeight: 1.4,
                          }}
                        >
                          {backup.failureReason ||
                            "Backup failed — retry available"}
                        </div>
                        <button
                          type="button"
                          className="btn"
                          disabled={
                            backingUp ||
                            serverBackupBusy ||
                            !isOnline ||
                            !session?.token ||
                            session.user.offline
                          }
                          onClick={() =>
                            backup.kind === "Device snapshot"
                              ? void createCloudBackup()
                              : void createServerBackup()
                          }
                          style={{
                            border: 0,
                            background: "none",
                            color: "#123A8F",
                            fontSize: 10,
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                            cursor: "pointer",
                            fontFamily: "inherit",
                          }}
                        >
                          Retry
                        </button>
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: 4,
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span
                      style={{
                        padding: "3px 7px",
                        borderRadius: 999,
                        color: backup.triggerType === "AUTO" ? c.muted : c.primary,
                        background:
                          backup.triggerType === "AUTO" ? c.cardAlt : c.infoBg,
                        fontSize: 9,
                        fontWeight: 800,
                      }}
                    >
                      {backup.triggerType === "AUTO" ? "Auto" : "Manual"}
                    </span>
                    <span style={{ color: c.faint, fontSize: 9 }}>
                      {formatBackupDate(
                        backup.completedAt ?? backup.createdAt ?? null,
                      )}
                    </span>
                  </div>
                </div>
              ))}
            {backupError && (
              <div
                role="alert"
                style={{
                  background: c.errorBg,
                  color: "#D32F2F",
                  borderRadius: 10,
                  padding: "9px 10px",
                  margin: 10,
                  fontSize: 11,
                  lineHeight: 1.5,
                }}
              >
                Device backup history could not be loaded: {backupError}
              </div>
            )}
            {serverBackupHistoryError && (
              <div
                role="alert"
                style={{
                  background: c.errorBg,
                  color: "#D32F2F",
                  borderRadius: 10,
                  padding: "9px 10px",
                  margin: 10,
                  fontSize: 11,
                  lineHeight: 1.5,
                }}
              >
                Business backup history could not be loaded:{" "}
                {serverBackupHistoryError}
              </div>
            )}
            {serverBackupHistory.length === 0 &&
              deviceBackupHistory.length === 0 &&
              !backupError &&
              !serverBackupHistoryError && (
                <div
                  style={{
                    fontSize: 12,
                    color: c.muted,
                    padding: "13px 15px",
                  }}
                >
                  {backupMetadataLoading || serverBackupLoading
                    ? "Loading backup history…"
                    : "No completed backups yet."}
                </div>
              )}
          </section>
          <div
            style={{
              margin: "-4px 4px 14px",
              fontSize: 10,
              color: c.faint,
              lineHeight: 1.5,
            }}
          >
            Shows the 3 most recent backup attempts. Automatic backups follow
            the configured schedule. Full business backups run on the server;
            device snapshots run while the native app is active. Wi-Fi-only
            uses Capacitor network status. Failed attempts are saved and can be
            retried.
          </div>
        </div>

        <aside
          aria-labelledby="offline-limits-heading"
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            padding: "13px 14px",
            marginBottom: 14,
            borderRadius: 12,
            background: c.cardAlt,
            border: `1px solid ${c.border}`,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 28,
              height: 28,
              flex: "0 0 28px",
              display: "grid",
              placeItems: "center",
              borderRadius: "50%",
              background: "rgba(249,168,37,0.16)",
              color: "#9A6500",
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            !
          </span>
          <div>
            <h2
              id="offline-limits-heading"
              style={{
                margin: "1px 0 4px",
                fontSize: 12,
                fontWeight: 700,
                color: c.text,
              }}
            >
              Offline limits
            </h2>
            <div style={{ fontSize: 11, color: c.muted, lineHeight: 1.55 }}>
              This saves supported snapshots and recent customer histories, not
              every feature or all historical transactions. Most changes still
              need internet; only cash sales can be queued and synced after you
              reconnect.
            </div>
          </div>
        </aside>

        <section
          className="card"
          aria-labelledby="ledger-export-heading"
          style={{
            padding: 16,
            marginBottom: 14,
            overflow: "visible",
            border: `1px solid ${c.border}`,
            boxShadow: "0 3px 12px rgba(13,27,61,0.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 11,
              marginBottom: 9,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 36,
                height: 36,
                flex: "0 0 36px",
                display: "grid",
                placeItems: "center",
                borderRadius: 10,
                background: "rgba(46,125,50,0.1)",
                color: "#2E7D32",
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              CSV
            </span>
            <h2
              id="ledger-export-heading"
              style={{
                margin: "1px 0 0",
                fontSize: 14,
                lineHeight: 1.4,
                fontWeight: 700,
                color: c.text,
              }}
            >
              Sales ledger
              <span
                style={{
                  display: "block",
                  fontSize: 10,
                  lineHeight: 1.4,
                  fontWeight: 500,
                  color: c.muted,
                }}
              >
                CSV export
              </span>
            </h2>
          </div>
          <div
            style={{
              fontSize: 11,
              color: c.muted,
              lineHeight: 1.55,
              display: "block",
              width: "100%",
              minWidth: 0,
              whiteSpace: "normal",
              overflowWrap: "anywhere",
              margin: "0 0 13px",
            }}
          >
            Open Reports to download the business sales ledger online or a
            previously saved offline copy. Offline PIN sessions download their
            saved copy here; online exports require Export Data permission.
          </div>
          {ledgerExportError && (
            <div
              role="alert"
              style={{ color: "#D32F2F", fontSize: 11, marginBottom: 10 }}
            >
              {ledgerExportError}
            </div>
          )}
          {ledgerExportMessage && (
            <div
              role="status"
              style={{ color: "#2E7D32", fontSize: 11, marginBottom: 10 }}
            >
              {ledgerExportMessage}
            </div>
          )}
          <button
            className="btn"
            onClick={() => {
              if (ledgerExporting) return
              if (session?.user.offline) {
                void downloadSavedLedgerWhileOffline()
              } else {
                onNavigate("reports")
              }
            }}
            disabled={ledgerExporting}
            style={{
              width: "100%",
              minHeight: 44,
              padding: "11px 14px",
              background: ledgerExporting
                ? c.cardAlt
                : "linear-gradient(135deg, #123A8F, #0288D1)",
              border: "none",
              borderRadius: 12,
              color: ledgerExporting ? c.muted : "white",
              fontSize: 13,
              fontWeight: 700,
              cursor: ledgerExporting ? "default" : "pointer",
              fontFamily: "inherit",
              boxShadow: ledgerExporting
                ? "none"
                : "0 2px 6px rgba(18,58,143,0.2)",
            }}
          >
            {ledgerExporting
              ? "Preparing saved sales ledger…"
              : session?.user.offline
                ? "Download saved sales ledger CSV"
                : "Open reports & download CSV"}
          </button>
        </section>

        <div
          role="note"
          style={{
            background: c.cardAlt,
            color: c.muted,
            borderRadius: 12,
            padding: "12px 14px",
            fontSize: 11,
            lineHeight: 1.55,
          }}
        >
          Offline data is kept in this device&apos;s private SQLite storage.
          Avoid clearing app data or uninstalling while sales are waiting to
          sync. Server backup archives are stored in the same PostgreSQL
          database as live records and do not replace an independent off-site
          backup.
        </div>
      </div>
    </div>
  )
}
