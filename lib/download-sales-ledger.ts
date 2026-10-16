import { ApiResponseError, apiFetchResponse, getClientSession } from "./client-api"

const databaseName = "mobiduka_sales_ledger"
const storeName = "exports"

type CachedLedger = {
  key: string
  blob: Blob
  filename: string
  savedAt: string
}

type LedgerDownloadResult =
  | { source: "online"; offlineCopySaved: boolean }
  | { source: "offline"; savedAt: string }

function openLedgerDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(storeName, { keyPath: "key" })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(request.error ?? new Error("Unable to open local sales ledger storage."))
    request.onblocked = () =>
      reject(new Error("Local sales ledger storage is blocked by another tab."))
  })
}

async function readCachedLedger(key: string): Promise<CachedLedger | null> {
  const database = await openLedgerDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, "readonly")
      const request = transaction.objectStore(storeName).get(key)
      request.onsuccess = () =>
        resolve((request.result as CachedLedger | undefined) ?? null)
      request.onerror = () =>
        reject(request.error ?? new Error("Unable to read the offline sales ledger."))
    })
  } finally {
    database.close()
  }
}

async function cacheLedger(entry: CachedLedger) {
  const database = await openLedgerDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(storeName, "readwrite")
      transaction.objectStore(storeName).put(entry)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () =>
        reject(transaction.error ?? new Error("Unable to save the offline sales ledger."))
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Saving the offline sales ledger was aborted."))
    })
  } finally {
    database.close()
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const downloadUrl = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = downloadUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)
}

export async function downloadSalesLedgerCsv(): Promise<LedgerDownloadResult> {
  const session = getClientSession()
  if (!session?.token) {
    throw new Error("Sign in to download the sales ledger.")
  }

  const key = `${session.user.businessId}:${session.user.id}`
  const cacheKey = `sales-ledger:${key}`
  if (session.user.offline || !navigator.onLine) {
    const cached = await readCachedLedger(cacheKey)
    if (!cached) {
      throw new Error(
        "No offline sales ledger is saved for this user on this browser or device. Connect to the internet and download it once first.",
      )
    }
    downloadBlob(cached.blob, cached.filename)
    return { source: "offline", savedAt: cached.savedAt }
  }

  let response: Response
  try {
    response = await apiFetchResponse("/api/reports/export-csv")
  } catch (error) {
    const canUseCachedExport =
      error instanceof TypeError ||
      (error instanceof ApiResponseError && error.status >= 500)
    if (!canUseCachedExport) throw error
    const cached = await readCachedLedger(cacheKey)
    if (!cached) throw error
    downloadBlob(cached.blob, cached.filename)
    return { source: "offline", savedAt: cached.savedAt }
  }

  const blob = await response.blob()
  if (!blob.size) throw new Error("The sales ledger export was empty.")

  const filename =
    response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/i)?.[1] ??
    "MobiDuka_Sales_Ledger.csv"
  downloadBlob(blob, filename)

  let offlineCopySaved = false
  try {
    await cacheLedger({
      key: cacheKey,
      blob,
      filename,
      savedAt: new Date().toISOString(),
    })
    offlineCopySaved = true
  } catch (error) {
    console.error("Unable to save an offline copy of the sales ledger.", error)
  }
  return { source: "online", offlineCopySaved }
}
