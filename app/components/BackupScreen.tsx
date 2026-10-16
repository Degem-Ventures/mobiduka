import { useCallback, useEffect, useState } from "react"
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
  restoreOfflineBackupSnapshot,
  retryFailedOfflineSales,
  syncPendingOfflineSales,
  type OfflineCacheIndexEntry,
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

export default function BackupScreen({ onNavigate }: Props) {
  const c = useColors()
  const session = getClientSession()
  const businessId = session?.user.businessId
  const userId = session?.user.id
  const [status, setStatus] = useState<SyncStatus>(emptyStatus)
  const [queuedSales, setQueuedSales] = useState<QueuedOfflineCashSale[]>([])
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
    const backupId = latestServerBackup?.id
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
  }, [businessId, latestServerBackup?.id, serverRestoreBusy, session?.token])

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
    const handleOnline = () => {
      void refreshStatus()
      void refreshCacheIndex()
    }
    const handleConnectivityChange = () => setIsOnline(navigator.onLine)
    window.addEventListener("mobiduka-offline-sync-status", handleSyncStatus)
    window.addEventListener("online", handleOnline)
    window.addEventListener("online", handleConnectivityChange)
    window.addEventListener("offline", handleConnectivityChange)
    return () => {
      window.removeEventListener(
        "mobiduka-offline-sync-status",
        handleSyncStatus,
      )
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("online", handleConnectivityChange)
      window.removeEventListener("offline", handleConnectivityChange)
    }
  }, [refreshCacheIndex, refreshQueuedSales, refreshStatus])

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

  const restoreCloudBackup = async () => {
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
    if (!latestBackup) {
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
        body: JSON.stringify({ backupId: latestBackup.id }),
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

  const restoreServerBackup = async () => {
    if (!businessId || !session?.token || session.user.offline || !isOnline) {
      setServerBackupError(
        "Sign in online and connect to the internet before restoring a server backup.",
      )
      return
    }
    if (!latestServerBackup) {
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
    setServerRestoreProgress({ percent: 0, message: "Preparing restore" })
    setServerBackupError("")
    setServerBackupHistoryError("")
    setServerBackupMessage("")
    try {
      const result = await apiFetch<{
        restoredRows: Record<string, number>
      }>("/api/business/restore/server-data", {
        method: "POST",
        body: JSON.stringify({ backupId: latestServerBackup.id }),
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
  return (
    <div className="screen" style={{ background: c.bg }}>
      <div
        style={{
          background: "linear-gradient(135deg, #0D1B3D, #0288D1)",
          padding: "52px 20px 24px",
          flexShrink: 0,
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
              background: "rgba(255,255,255,0.12)",
              border: "none",
              borderRadius: 10,
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>
          <div style={{ color: "white", fontSize: 18, fontWeight: 700 }}>
            Backup & Cloud Sync
          </div>
        </div>
        <div
          style={{
            background: "rgba(255,255,255,0.12)",
            borderRadius: 18,
            padding: 20,
            border: "1px solid rgba(255,255,255,0.15)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ fontSize: 38 }}>☁️</div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "white", fontSize: 16, fontWeight: 700 }}>
                Business cloud backup
              </div>
              <div
                role="status"
                style={{
                  color: "rgba(255,255,255,0.78)",
                  fontSize: 12,
                  marginTop: 4,
                }}
              >
                {serverBackupLoading
                  ? "Checking latest business backup…"
                  : latestServerBackup?.completedAt
                    ? `Last business backup: ${new Date(latestServerBackup.completedAt).toLocaleString()}`
                    : "No full business backup yet"}
              </div>
              <div
                style={{
                  color: "rgba(255,255,255,0.68)",
                  fontSize: 11,
                  marginTop: 5,
                }}
              >
                {latestServerBackup
                  ? `${formatPayloadSize(latestServerBackup.originalBytes)} · encrypted`
                  : "Create a snapshot of this business’s server records"}
              </div>
            </div>
            {hasQueue && (
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    color: failedCount ? "#FFCDD2" : "#FFE082",
                    fontSize: 11,
                  }}
                >
                  {failedCount ? "Needs attention" : "Waiting to sync"}
                </div>
                <div style={{ color: "white", fontSize: 20, fontWeight: 800 }}>
                  {pendingCount + failedCount}
                </div>
              </div>
            )}
          </div>
          <div
            style={{
              borderTop: "1px solid rgba(255,255,255,0.18)",
              marginTop: 14,
              paddingTop: 12,
              display: "grid",
              gap: 5,
              fontSize: 11,
              color: "rgba(255,255,255,0.75)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <span>Full business records</span>
              <span style={{ color: "white", fontWeight: 600 }}>
                Encrypted in server database
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <span>Device cache snapshot</span>
              <span style={{ color: "white", fontWeight: 600 }}>
                {latestBackup?.completedAt
                  ? `Cloud copy · ${new Date(latestBackup.completedAt).toLocaleDateString()}`
                  : "Not backed up"}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <span>On-device offline data</span>
              <span style={{ color: "white", fontWeight: 600 }}>
                {loading
                  ? "Checking…"
                  : `${readyDatasets}/${datasets.length} datasets ready`}
              </span>
            </div>
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
            <div className="card" style={{ padding: 16, marginBottom: 14 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: c.text }}>
                  Saved offline data
                </div>
                <div role="status" style={{ fontSize: 11, color: c.muted }}>
                  {cacheIndexLoading
                    ? "Checking…"
                    : `${readyDatasets}/${datasets.length} ready`}
                </div>
              </div>
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
          </>
        )}

        {isNative && hasQueue && (
          <section
            className="card"
            aria-labelledby="queued-sales-heading"
            style={{ padding: 16, marginBottom: 14 }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 8,
                marginBottom: 10,
              }}
            >
              <h2
                id="queued-sales-heading"
                style={{
                  margin: 0,
                  fontSize: 14,
                  fontWeight: 700,
                  color: c.text,
                }}
              >
                Unsent cash sales
              </h2>
              <span role="status" style={{ fontSize: 11, color: c.muted }}>
                {queuedSalesLoading
                  ? "Checking…"
                  : `${Math.min(queuedSales.length, 50)}${
                      queuedSales.length > 50 ? "+" : ""
                    } listed`}
              </span>
            </div>
            {queuedSales.length === 0 && !queuedSalesLoading ? (
              <div style={{ fontSize: 12, color: c.muted }}>
                The queue count is updating. Refresh this screen to check the
                saved sales.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {queuedSales.slice(0, 50).map((sale) => {
                  const unitCount = sale.payload.items.reduce(
                    (total, item) => total + item.quantity,
                    0,
                  )
                  const failed = sale.status === "FAILED"
                  return (
                    <div
                      key={sale.id}
                      style={{
                        border: `1px solid ${c.divider}`,
                        borderRadius: 10,
                        padding: "10px 11px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
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
                          <div
                            style={{
                              color: c.muted,
                              fontSize: 10,
                              marginTop: 3,
                            }}
                          >
                            {new Date(sale.createdAt).toLocaleString()} ·{" "}
                            {unitCount} unit{unitCount === 1 ? "" : "s"}
                          </div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div
                            style={{
                              color: c.text,
                              fontSize: 12,
                              fontWeight: 800,
                            }}
                          >
                            KSh {sale.payload.total.toLocaleString()}
                          </div>
                          <div
                            style={{
                              color: failed ? "#C62828" : "#8A6500",
                              fontSize: 10,
                              fontWeight: 700,
                              marginTop: 3,
                            }}
                          >
                            {failed ? "Failed" : "Pending"}
                          </div>
                        </div>
                      </div>
                      {failed && sale.lastError && (
                        <div
                          role="note"
                          style={{
                            marginTop: 7,
                            color: "#B71C1C",
                            fontSize: 10,
                            lineHeight: 1.4,
                          }}
                        >
                          {sale.lastError}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            {queuedSales.length > 50 && (
              <div style={{ marginTop: 8, color: c.muted, fontSize: 10 }}>
                Showing the 50 most recent unsent sales. Queue counts include
                all unsent sales.
              </div>
            )}
          </section>
        )}

        <button
          className="btn"
          onClick={() => void syncNow()}
          disabled={!isNative || !hasQueue || syncing || backingUp || !isOnline}
          style={{
            width: "100%",
            padding: 16,
            marginBottom: 16,
            background:
              !isNative || !hasQueue || syncing || backingUp || !isOnline
                ? c.cardAlt
                : "linear-gradient(135deg, #0288D1, #0277BD)",
            border: "none",
            borderRadius: 16,
            fontSize: 15,
            fontWeight: 700,
            color:
              !isNative || !hasQueue || syncing || backingUp || !isOnline
                ? c.muted
                : "white",
            cursor:
              !isNative || !hasQueue || syncing || backingUp || !isOnline
                ? "default"
                : "pointer",
            fontFamily: "inherit",
          }}
        >
          {syncing
            ? "Synchronizing queued sales…"
            : failedCount > 0
              ? "Retry failed sales"
              : "Sync queued sales"}
        </button>

        <section
          className="card"
          aria-labelledby="offline-preparation-heading"
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
                background: "rgba(18,58,143,0.09)",
                color: "#123A8F",
                fontSize: 18,
              }}
            >
              ↓
            </span>
            <div>
              <h2
                id="offline-preparation-heading"
                style={{
                  margin: "1px 0 3px",
                  fontSize: 14,
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
            </div>
          </div>
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
        </section>

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
            Backup & restore
          </div>

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
            {serverBackupError && (
              <div
                role="alert"
                style={{
                  background: c.errorBg,
                  color: "#D32F2F",
                  borderRadius: 10,
                  padding: "10px 12px",
                  marginBottom: 12,
                  fontSize: 11,
                  lineHeight: 1.5,
                }}
              >
                {serverBackupError}
              </div>
            )}
            {serverBackupMessage && (
              <div
                role="status"
                style={{
                  background: "rgba(46, 125, 50, 0.1)",
                  color: "#2E7D32",
                  borderRadius: 10,
                  padding: "10px 12px",
                  marginBottom: 12,
                  fontSize: 11,
                  lineHeight: 1.5,
                }}
              >
                {serverBackupMessage}
              </div>
            )}
            <button
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
                padding: 14,
                background:
                  !isOnline ||
                  !session?.token ||
                  session.user.offline ||
                  serverBackupBusy ||
                  serverRestoreBusy
                    ? c.cardAlt
                    : "linear-gradient(135deg, #0288D1, #2E7D32)",
                border: "none",
                borderRadius: 12,
                color:
                  !isOnline ||
                  !session?.token ||
                  session.user.offline ||
                  serverBackupBusy ||
                  serverRestoreBusy
                    ? c.muted
                    : "white",
                fontSize: 14,
                fontWeight: 700,
                cursor:
                  !isOnline ||
                  !session?.token ||
                  session.user.offline ||
                  serverBackupBusy ||
                  serverRestoreBusy
                    ? "default"
                    : "pointer",
                fontFamily: "inherit",
              }}
            >
              {serverBackupBusy
                ? `Creating encrypted backup… ${serverBackupProgress?.percent ?? 0}%`
                : "Back up full business data"}
            </button>
            {serverBackupBusy && (
              <div style={{ marginTop: 10 }}>
                <div
                  role="progressbar"
                  aria-label="Full business backup progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={serverBackupProgress?.percent ?? 0}
                  aria-valuetext={`${serverBackupProgress?.percent ?? 0}% complete`}
                  style={{
                    height: 6,
                    overflow: "hidden",
                    borderRadius: 999,
                    background: c.cardAlt,
                  }}
                >
                  <div
                    style={{
                      width: `${serverBackupProgress?.percent ?? 0}%`,
                      height: "100%",
                      borderRadius: 999,
                      background: "linear-gradient(90deg, #0288D1, #2E7D32)",
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
                    {serverBackupProgress?.message ??
                      "Preparing business snapshot"}
                  </span>
                  <span>{serverBackupProgress?.percent ?? 0}%</span>
                </div>
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
              Requires business settings permission and the server encryption
              key. Includes staff password/PIN hashes and encrypted payment
              credentials. Up to 10 snapshots are retained. Keep an independent
              off-site database backup too.
            </div>
            <button
              className="btn"
              onClick={() => void restoreServerBackup()}
              disabled={
                !isOnline ||
                !session?.token ||
                session.user.offline ||
                !latestServerBackup ||
                serverBackupBusy ||
                serverRestoreBusy
              }
              style={{
                width: "100%",
                padding: 14,
                marginTop: 10,
                background:
                  !isOnline ||
                  !session?.token ||
                  session.user.offline ||
                  !latestServerBackup ||
                  serverBackupBusy ||
                  serverRestoreBusy
                    ? c.cardAlt
                    : "linear-gradient(135deg, #123A8F, #0288D1)",
                border: "none",
                borderRadius: 12,
                color:
                  !isOnline ||
                  !session?.token ||
                  session.user.offline ||
                  !latestServerBackup ||
                  serverBackupBusy ||
                  serverRestoreBusy
                    ? c.muted
                    : "white",
                fontSize: 14,
                fontWeight: 700,
                cursor:
                  !isOnline ||
                  !session?.token ||
                  session.user.offline ||
                  !latestServerBackup ||
                  serverBackupBusy ||
                  serverRestoreBusy
                    ? "default"
                    : "pointer",
                fontFamily: "inherit",
              }}
            >
              {serverRestoreBusy
                ? `Restoring business data… ${serverRestoreProgress?.percent ?? 0}%`
                : "Restore full business data"}
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
                      background: "linear-gradient(90deg, #123A8F, #0288D1)",
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
            {backupError && (
              <div
                role="alert"
                style={{
                  background: c.errorBg,
                  color: "#D32F2F",
                  borderRadius: 10,
                  padding: "10px 12px",
                  marginBottom: 12,
                  fontSize: 11,
                  lineHeight: 1.5,
                }}
              >
                {backupError}
              </div>
            )}
            {restoreMessage && (
              <div
                role="status"
                style={{
                  background: "rgba(46, 125, 50, 0.1)",
                  color: "#2E7D32",
                  borderRadius: 10,
                  padding: "10px 12px",
                  marginBottom: 12,
                  fontSize: 11,
                  lineHeight: 1.5,
                }}
              >
                {restoreMessage}
              </div>
            )}
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
                    : "linear-gradient(135deg, #0288D1, #2E7D32)",
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
            <button
              className="btn"
              onClick={() => void restoreCloudBackup()}
              disabled={
                !isNative ||
                !isOnline ||
                !session?.token ||
                session.user.offline ||
                !latestBackup ||
                backingUp ||
                restoring ||
                prefetching ||
                syncing
              }
              style={{
                width: "100%",
                padding: 14,
                marginTop: 10,
                background:
                  !isNative ||
                  !isOnline ||
                  !session?.token ||
                  session.user.offline ||
                  !latestBackup ||
                  backingUp ||
                  restoring ||
                  prefetching ||
                  syncing
                    ? c.cardAlt
                    : "linear-gradient(135deg, #123A8F, #0288D1)",
                border: "none",
                borderRadius: 12,
                color:
                  !isNative ||
                  !isOnline ||
                  !session?.token ||
                  session.user.offline ||
                  !latestBackup ||
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
                  !latestBackup ||
                  backingUp ||
                  restoring ||
                  prefetching ||
                  syncing
                    ? "default"
                    : "pointer",
                fontFamily: "inherit",
              }}
            >
              {restoring
                ? "Restoring device snapshot…"
                : "Restore device snapshot"}
            </button>
          </section>

          <section
            className="card"
            aria-labelledby="backup-sync-settings-heading"
            style={{ padding: 16, marginBottom: 14 }}
          >
            <h2
              id="backup-sync-settings-heading"
              style={{ margin: "0 0 6px", fontSize: 14, color: c.text }}
            >
              Backup sync settings
            </h2>
            <div
              style={{
                fontSize: 11,
                color: c.muted,
                lineHeight: 1.5,
                marginBottom: 8,
              }}
            >
              Choose how often backups run. Full business backups run on the
              server; device snapshots run when the native app is active and
              online.
            </div>
            {[
              {
                label: "Automatic backups",
                description:
                  "Create scheduled full-business and device snapshots",
                value: autoBackupEnabled,
                change: (value: boolean) =>
                  void saveBackupSettings({ autoBackup: value }),
              },
              {
                label: "Wi-Fi only",
                description:
                  "Require native Wi-Fi for automatic device snapshots",
                value: autoBackupWifiOnly,
                change: (value: boolean) =>
                  void saveBackupSettings({ autoBackupWifiOnly: value }),
              },
            ].map((setting) => (
              <div
                key={setting.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 0",
                  borderTop: `1px solid ${c.border}`,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: c.text }}>
                    {setting.label}
                  </div>
                  <div style={{ fontSize: 10, color: c.muted, marginTop: 2 }}>
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
                  padding: "12px 0",
                  borderTop: `1px solid ${c.border}`,
                }}
              >
                <div>
                  <label
                    htmlFor="auto-backup-frequency"
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: c.text,
                    }}
                  >
                    Configure schedule
                  </label>
                  <div
                    style={{
                      fontSize: 10,
                      color: c.muted,
                      marginTop: 2,
                      lineHeight: 1.4,
                    }}
                  >
                    {autoBackupFrequency === "DAILY"
                      ? "Runs every day at 06:00 UTC."
                      : autoBackupFrequency === "WEEKLY"
                        ? "Runs every Monday at 06:00 UTC."
                        : "Runs on the first day of each month at 06:00 UTC."}
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

          <section
            className="card"
            aria-labelledby="backup-history-heading"
            style={{ padding: 16, marginBottom: 14 }}
          >
            <h2
              id="backup-history-heading"
              style={{ margin: "0 0 10px", fontSize: 15, color: c.text }}
            >
              Backup history
            </h2>
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
              .map((backup) => (
                <div
                  key={backup.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "11px 0",
                    borderTop: `1px solid ${c.border}`,
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
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 8,
                        alignItems: "baseline",
                      }}
                    >
                      <div
                        style={{ fontSize: 12, fontWeight: 700, color: c.text }}
                      >
                        {formatBackupDate(
                          backup.completedAt ?? backup.createdAt ?? null,
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: c.muted,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {backup.triggerType === "AUTO" ? "Auto" : "Manual"}
                      </div>
                    </div>
                    <div style={{ fontSize: 10, color: c.muted, marginTop: 3 }}>
                      {backup.kind} ·{" "}
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
                  marginBottom: 8,
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
                  marginBottom: 8,
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
                <div style={{ fontSize: 12, color: c.muted, padding: "8px 0" }}>
                  {backupMetadataLoading || serverBackupLoading
                    ? "Loading backup history…"
                    : "No completed backups yet."}
                </div>
              )}
            <div
              style={{
                marginTop: 8,
                fontSize: 10,
                color: c.faint,
                lineHeight: 1.5,
              }}
            >
              Shows up to 20 recent completed or failed attempts of each type.
              Automatic backups follow the configured schedule. Full business
              backups run on the server; device snapshots run while the native
              app is active. Wi-Fi-only uses Capacitor network status. Failed
              attempts are saved and can be retried.
            </div>
          </section>
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
