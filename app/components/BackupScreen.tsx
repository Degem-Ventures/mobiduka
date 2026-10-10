import { useCallback, useEffect, useState } from 'react'
import { useColors } from '../utils/theme'
import { getClientSession } from '../../lib/client-api'
import {
  getOfflineCacheIndex,
  getQueuedOfflineCashSales,
  getOfflineSaleSyncStatus,
  getOfflineStorageUsage,
  isNativeOfflineApp,
  retryFailedOfflineSales,
  syncPendingOfflineSales,
  type OfflineCacheIndexEntry,
  type OfflineStorageUsage,
  type QueuedOfflineCashSale,
} from '../../lib/offline-store'
import { prefetchOfflineData, type OfflinePrefetchProgress } from '../../lib/offline-prefetch'

interface Props { onNavigate: (s: string) => void }

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
  { label: 'Dashboard and scan summary', cacheKeys: ['dashboard.summary.v1', 'dashboard.notifications.v1'] },
  { label: 'Reports', cacheKeys: ['reports.summary.v1'] },
  { label: 'POS catalog and reference data', cacheKeys: ['pos.products.v1', 'pos.categories.v1', 'pos.customers.v1', 'pos.shift_roster.v1'] },
  { label: 'Inventory catalog and categories', cacheKeys: ['inventory.products.v1', 'inventory.categories.v1', 'inventory.deleted_products.v1'] },
  { label: 'Customer and credit lists', cacheKeys: ['customers.list.v1'] },
  { label: 'Customer histories', cacheKeys: ['customers.details.v1:'] },
  { label: 'Expenses', cacheKeys: ['expenses.list.v1'] },
  { label: 'Suppliers and categories', cacheKeys: ['suppliers.list.v1', 'suppliers.categories.v1'] },
  { label: 'Purchase orders and references', cacheKeys: ['purchases.orders.v1', 'purchases.suppliers.v1', 'purchases.products.v1'] },
  { label: 'Notifications', cacheKeys: ['notifications.list.v1'] },
  { label: 'Employee directory and shifts', cacheKeys: ['employees.directory.v1', 'shifts.employees.v1', 'shifts.sessions.v1', 'shifts.types.v1'] },
  { label: 'Roles and permissions', cacheKeys: ['roles.list.v1'] },
  { label: 'Signed-in profile', cacheKeys: [`profile.v1:${userId}`] },
  { label: 'Settings and accepted payment methods', cacheKeys: ['settings.overview.v1', 'settings.receipt-preview.v1', 'settings.tax-compliance.v1', 'payments.methods.v1'] },
  { label: 'Recent receipt history', cacheKeys: ['pos.receipt_history.v1'] },
  { label: 'Offline PIN roster', cacheKeys: ['offline.pin-roster.v1'] },
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

function formatPayloadSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  )
  const value = bytes / 1024 ** unitIndex
  return `${value.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`
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
  const [prefetchProgress, setPrefetchProgress] = useState<OfflinePrefetchProgress | null>(null)
  const [cacheIndex, setCacheIndex] = useState<OfflineCacheIndexEntry[]>([])
  const [cacheIndexLoading, setCacheIndexLoading] = useState(false)
  const [storageUsage, setStorageUsage] = useState<OfflineStorageUsage>(emptyStorageUsage)
  const [storageUsageLoading, setStorageUsageLoading] = useState(false)
  const [error, setError] = useState('')
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  const isNative = isNativeOfflineApp()

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
      setError(nextStatus.lastError ?? '')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to read on-device sync status.')
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
      console.error('Unable to read queued offline cash sales.', reason)
      setError(reason instanceof Error ? reason.message : 'Unable to read queued offline cash sales.')
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
      console.error('Unable to read the offline cache index.', reason)
      setError(reason instanceof Error ? reason.message : 'Unable to check saved offline data.')
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
      else setError('')
    }
    const handleOnline = () => {
      void refreshStatus()
      void refreshCacheIndex()
    }
    const handleConnectivityChange = () => setIsOnline(navigator.onLine)
    window.addEventListener('mobiduka-offline-sync-status', handleSyncStatus)
    window.addEventListener('online', handleOnline)
    window.addEventListener('online', handleConnectivityChange)
    window.addEventListener('offline', handleConnectivityChange)
    return () => {
      window.removeEventListener('mobiduka-offline-sync-status', handleSyncStatus)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('online', handleConnectivityChange)
      window.removeEventListener('offline', handleConnectivityChange)
    }
  }, [refreshCacheIndex, refreshQueuedSales, refreshStatus])

  const syncNow = async () => {
    if (!businessId || !userId || !session?.token || session.user.offline || !isOnline) {
      setError('Sign in online and connect to the internet before synchronizing queued sales.')
      return
    }
    setSyncing(true)
    setError('')
    try {
      if (status.failed > 0) await retryFailedOfflineSales(businessId)
      await syncPendingOfflineSales(businessId, userId)
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Unable to synchronize queued sales.'
      setError(message)
      try {
        const nextStatus = await getOfflineSaleSyncStatus(businessId)
        setStatus({ ...nextStatus, syncError: message })
      } catch (statusError) {
        console.error('Unable to refresh offline sale status after sync failure.', statusError)
      }
    } finally {
      setSyncing(false)
      await refreshStatus()
      await refreshCacheIndex()
    }
  }

  const downloadForOffline = async () => {
    if (!businessId || !userId || !session?.token || session.user.offline || !isOnline || !isNative) {
      setError('Sign in online and connect to the internet before downloading offline data.')
      return
    }
    setPrefetching(true)
    setError('')
    setPrefetchProgress({ total: 1, completed: 0, current: 'Preparing download…', failures: [] })
    try {
      const result = await prefetchOfflineData(businessId, userId, setPrefetchProgress)
      await refreshCacheIndex()
      if (result.failures.length > 0) {
        setError(`${result.failures.length} dataset${result.failures.length === 1 ? '' : 's'} could not be downloaded. Review the results below and try again while online.`)
      }
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Unable to download offline data.'
      setError(message)
      console.error('Unable to complete the offline data download.', reason)
    } finally {
      setPrefetching(false)
      void refreshCacheIndex()
    }
  }

  const pendingCount = status.pending
  const failedCount = status.failed
  const hasQueue = pendingCount + failedCount > 0
  const datasets = userId ? cacheDatasets(userId) : []
  const datasetStatus = datasets.map(dataset => {
    const entries = dataset.cacheKeys.flatMap(key => {
      if (key.endsWith(':')) return cacheIndex.filter(entry => entry.cacheKey.startsWith(key))
      const entry = cacheIndex.find(item => item.cacheKey === key)
      return entry ? [entry] : []
    })
    const requiredEntries = dataset.cacheKeys.filter(key => !key.endsWith(':'))
    const missingCount = requiredEntries.filter(key => !cacheIndex.some(entry => entry.cacheKey === key)).length
    const updatedAt = entries
      .map(entry => entry.updatedAt)
      .sort((left, right) => Date.parse(left) - Date.parse(right))[0] ?? null
    return {
      ...dataset,
      entries,
      missingCount,
      ready: dataset.label === 'Customer histories'
        ? entries.length > 0
        : missingCount === 0 && entries.length > 0,
      updatedAt,
    }
  })
  const readyDatasets = datasetStatus.filter(dataset => dataset.ready).length
  const statusLabel = loading
    ? 'Checking this device…'
    : !isNative
      ? 'Offline sale queue is available in the native app'
      : failedCount > 0
        ? `${failedCount} sale${failedCount === 1 ? '' : 's'} need attention`
        : pendingCount > 0
          ? `${pendingCount} sale${pendingCount === 1 ? '' : 's'} waiting to sync`
          : 'No queued sales on this device'

  return (
    <div className="screen" style={{ background: c.bg }}>
      <div style={{ background: 'linear-gradient(135deg, #0D1B3D, #0288D1)', padding: '52px 20px 24px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <button className="btn" onClick={() => onNavigate('more')} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
          </button>
          <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>On-device Sync</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 18, padding: 20, border: '1px solid rgba(255,255,255,0.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 38 }}>{hasQueue ? '🔄' : '✅'}</div>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'white', fontSize: 16, fontWeight: 700 }}>Offline cash sales</div>
              <div role="status" style={{ color: 'rgba(255,255,255,0.78)', fontSize: 12, marginTop: 4 }}>{statusLabel}</div>
              {pendingCount > 0 && (
                <div style={{ color: '#FFE082', fontSize: 12, fontWeight: 600, marginTop: 4 }}>{pendingCount} pending</div>
              )}
            </div>
            {failedCount > 0 && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#FFCDD2', fontSize: 11 }}>Failed</div>
                <div style={{ color: 'white', fontSize: 20, fontWeight: 800 }}>{failedCount}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="scroll-area" style={{ padding: 16, paddingBottom: 80 }}>
        {error && (
          <div role="alert" style={{ background: c.errorBg, color: '#D32F2F', borderRadius: 12, padding: '12px 14px', marginBottom: 14, fontSize: 12, lineHeight: 1.5 }}>
            {error}
          </div>
        )}

        {isNative && (
          <div className="card" style={{ padding: 16, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: c.text }}>Saved offline data</div>
              <div role="status" style={{ fontSize: 11, color: c.muted }}>
                {cacheIndexLoading ? 'Checking…' : `${readyDatasets}/${datasets.length} ready`}
              </div>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {datasetStatus.map(dataset => (
                <div key={dataset.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                  <span aria-hidden="true" style={{ width: 16, color: dataset.ready ? '#2E7D32' : c.faint }}>
                    {dataset.ready ? '✓' : '○'}
                  </span>
                  <span style={{ flex: 1, color: dataset.ready ? c.text : c.muted }}>{dataset.label}</span>
                  {dataset.label === 'Customer histories' && dataset.entries.length > 0 && (
                    <span style={{ color: c.muted }}>{dataset.entries.length}</span>
                  )}
                  {dataset.updatedAt && (
                    <span style={{ color: c.faint, whiteSpace: 'nowrap' }}>
                      {new Date(dataset.updatedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              ))}
            </div>
            {!cacheIndexLoading && readyDatasets < datasets.length && (
              <div style={{ marginTop: 10, fontSize: 11, color: c.muted, lineHeight: 1.5 }}>
                Missing saved data can limit offline screens. Run the download while online to refresh these snapshots.
              </div>
            )}
            <div style={{ borderTop: c.divider, marginTop: 14, paddingTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: c.text }}>On-device storage estimate</div>
                <div
                  role="status"
                  aria-label={storageUsageLoading ? 'Checking local SQLite payload size' : `Estimated local SQLite payload size: ${formatPayloadSize(storageUsage.cachedPayloadBytes + storageUsage.queuedPayloadBytes)}`}
                  style={{ fontSize: 13, fontWeight: 800, color: c.text }}
                >
                  {storageUsageLoading
                    ? 'Checking…'
                    : formatPayloadSize(storageUsage.cachedPayloadBytes + storageUsage.queuedPayloadBytes)}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 6, fontSize: 11, color: c.muted }}>
                <span>
                  {storageUsage.cachedCollections} saved snapshots · {storageUsageLoading ? '…' : formatPayloadSize(storageUsage.cachedPayloadBytes)}
                </span>
                <span>
                  {storageUsage.queuedRecords} queued records · {storageUsageLoading ? '…' : formatPayloadSize(storageUsage.queuedPayloadBytes)}
                </span>
              </div>
              <div style={{ marginTop: 7, fontSize: 10, color: c.faint, lineHeight: 1.5 }}>
                Approximate collection and queued-record JSON payload size for this business. It excludes the offline PIN roster, SQLite indexes, and database overhead; this is not cloud usage or a device quota.
              </div>
            </div>
          </div>
        )}

        {isNative && hasQueue && (
          <section className="card" aria-labelledby="queued-sales-heading" style={{ padding: 16, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
              <h2 id="queued-sales-heading" style={{ margin: 0, fontSize: 14, fontWeight: 700, color: c.text }}>
                Unsent cash sales
              </h2>
              <span role="status" style={{ fontSize: 11, color: c.muted }}>
                {queuedSalesLoading ? 'Checking…' : `${Math.min(queuedSales.length, 50)}${queuedSales.length > 50 ? '+' : ''} listed`}
              </span>
            </div>
            {queuedSales.length === 0 && !queuedSalesLoading ? (
              <div style={{ fontSize: 12, color: c.muted }}>The queue count is updating. Refresh this screen to check the saved sales.</div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {queuedSales.slice(0, 50).map(sale => {
                  const unitCount = sale.payload.items.reduce((total, item) => total + item.quantity, 0)
                  const failed = sale.status === 'FAILED'
                  return (
                    <div key={sale.id} style={{ border: `1px solid ${c.divider}`, borderRadius: 10, padding: '10px 11px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: c.text, fontSize: 12, fontWeight: 700, overflowWrap: 'anywhere' }}>
                            {sale.payload.saleNumber}
                          </div>
                          <div style={{ color: c.muted, fontSize: 10, marginTop: 3 }}>
                            {new Date(sale.createdAt).toLocaleString()} · {unitCount} unit{unitCount === 1 ? '' : 's'}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ color: c.text, fontSize: 12, fontWeight: 800 }}>
                            KSh {sale.payload.total.toLocaleString()}
                          </div>
                          <div style={{ color: failed ? '#C62828' : '#8A6500', fontSize: 10, fontWeight: 700, marginTop: 3 }}>
                            {failed ? 'Failed' : 'Pending'}
                          </div>
                        </div>
                      </div>
                      {failed && sale.lastError && (
                        <div role="note" style={{ marginTop: 7, color: '#B71C1C', fontSize: 10, lineHeight: 1.4 }}>
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
                Showing the 50 most recent unsent sales. Queue counts include all unsent sales.
              </div>
            )}
          </section>
        )}

        <button
          className="btn"
          onClick={() => void syncNow()}
          disabled={!isNative || !hasQueue || syncing || !isOnline}
          style={{
            width: '100%',
            padding: 16,
            marginBottom: 16,
            background: !isNative || !hasQueue || syncing || !isOnline ? c.cardAlt : 'linear-gradient(135deg, #0288D1, #0277BD)',
            border: 'none',
            borderRadius: 16,
            fontSize: 15,
            fontWeight: 700,
            color: !isNative || !hasQueue || syncing || !isOnline ? c.muted : 'white',
            cursor: !isNative || !hasQueue || syncing || !isOnline ? 'default' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {syncing ? 'Synchronizing queued sales…' : failedCount > 0 ? 'Retry failed sales' : 'Sync queued sales'}
        </button>

        <div className="card" style={{ padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: c.text, marginBottom: 6 }}>
            Prepare this device for offline use
          </div>
          <div style={{ fontSize: 12, color: c.muted, lineHeight: 1.6, marginBottom: 12 }}>
            Download supported dashboard, report, catalog, business-record, settings, shift, profile, receipt, and customer snapshots. This also saves each customer&apos;s latest 20 sales and credit entries; businesses with many customers may take longer. Stay online and signed in until it finishes.
          </div>
          <button
            className="btn"
            onClick={() => void downloadForOffline()}
            disabled={!isNative || !isOnline || !session?.token || session.user.offline || prefetching || syncing}
            style={{
              width: '100%',
              padding: 14,
              background: !isNative || !isOnline || !session?.token || session.user.offline || prefetching || syncing ? c.cardAlt : 'linear-gradient(135deg, #123A8F, #1A4FBF)',
              border: 'none',
              borderRadius: 12,
              color: !isNative || !isOnline || !session?.token || session.user.offline || prefetching || syncing ? c.muted : 'white',
              fontSize: 14,
              fontWeight: 700,
              cursor: !isNative || !isOnline || !session?.token || session.user.offline || prefetching || syncing ? 'default' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {prefetching ? 'Downloading offline data…' : 'Download data for offline use'}
          </button>
          {prefetchProgress && (
            <div aria-live="polite" style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11, color: c.muted, marginBottom: 6 }}>
                <span>{prefetchProgress.completed === prefetchProgress.total && !prefetchProgress.current ? 'Download finished' : prefetchProgress.current || 'Preparing download…'}</span>
                <span>{prefetchProgress.completed}/{prefetchProgress.total}</span>
              </div>
              <div
                role="progressbar"
                aria-label="Offline data download progress"
                aria-valuemin={0}
                aria-valuemax={prefetchProgress.total}
                aria-valuenow={prefetchProgress.completed}
                style={{ height: 9, overflow: 'hidden', borderRadius: 6, background: c.cardAlt }}
              >
                <div style={{ width: `${prefetchProgress.total ? Math.round(prefetchProgress.completed / prefetchProgress.total * 100) : 0}%`, height: '100%', background: 'linear-gradient(90deg, #123A8F, #2E7D32)', transition: 'width 180ms ease' }} />
              </div>
              {prefetchProgress.failures.length > 0 && (
                <div style={{ marginTop: 10, color: '#C62828', fontSize: 11, lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Not downloaded:</div>
                  {prefetchProgress.failures.map(failure => <div key={failure}>• {failure}</div>)}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: c.text, marginBottom: 6 }}>Offline limits</div>
          <div style={{ fontSize: 12, color: c.muted, lineHeight: 1.6 }}>
            This downloads supported snapshots and recent customer histories; it does not make every feature offline. Older transaction history, business changes, and other writes still require internet. Only cash sales can be queued offline and uploaded after you reconnect and sign in online.
          </div>
        </div>

        <div role="note" style={{ background: c.cardAlt, color: c.muted, borderRadius: 12, padding: '12px 14px', fontSize: 12, lineHeight: 1.55 }}>
          Cloud backups, CSV export, and cache clearing are not connected in this app yet. Offline snapshots and queued cash sales remain on this device. Do not uninstall or clear app data while sales are waiting.
        </div>
      </div>
    </div>
  )
}
