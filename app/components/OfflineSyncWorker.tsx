"use client"

import { useEffect } from "react"
import {
  getOfflineSaleSyncStatus,
  isNativeOfflineApp,
  syncPendingOfflineSales,
} from "../../lib/offline-store"
import { getClientSession } from "../../lib/client-api"

type OfflineSyncStatusEvent = {
  pending: number
  failed: number
  lastError: string | null
  syncError: string | null
}

export default function OfflineSyncWorker({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled || !isNativeOfflineApp()) return
    const session = getClientSession()
    const businessId = session?.user.businessId
    const userId = session?.user.id
    if (!businessId || !userId) return
    let cancelled = false

    const runSync = async () => {
      if (!navigator.onLine) {
        try {
          const status = await getOfflineSaleSyncStatus(businessId)
          if (cancelled) return
          window.dispatchEvent(
            new CustomEvent<OfflineSyncStatusEvent>(
              "mobiduka-offline-sync-status",
              { detail: { ...status, syncError: null } },
            ),
          )
        } catch (error) {
          console.error(
            "Unable to read offline sale synchronization status.",
            error,
          )
        }
        return
      }
      if (session.user.offline || !session.token) {
        try {
          const status = await getOfflineSaleSyncStatus(businessId)
          if (cancelled) return
          window.dispatchEvent(
            new CustomEvent<OfflineSyncStatusEvent>(
              "mobiduka-offline-sync-status",
              {
                detail: {
                  ...status,
                  syncError: status.pending > 0
                    ? "Sign in online to synchronize pending offline sales."
                    : null,
                },
              },
            ),
          )
        } catch (error) {
          console.error(
            "Unable to read offline sale synchronization status.",
            error,
          )
        }
        return
      }
      let syncError: string | null = null
      try {
        await syncPendingOfflineSales(businessId, userId)
      } catch (error) {
        syncError =
          error instanceof Error
            ? error.message
            : "Pending offline sales could not be synchronized."
        console.error("Pending offline sales could not be synchronized.", error)
      }
      if (cancelled) return
      try {
        const status = await getOfflineSaleSyncStatus(businessId)
        const detail: OfflineSyncStatusEvent = {
          ...status,
          syncError,
        }
        window.dispatchEvent(
          new CustomEvent<OfflineSyncStatusEvent>(
            "mobiduka-offline-sync-status",
            { detail },
          ),
        )
      } catch (error) {
        console.error(
          "Unable to read offline sale synchronization status.",
          error,
        )
      }
    }

    const handleOnline = () => void runSync()
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void runSync()
    }
    const intervalId = window.setInterval(() => {
      if (navigator.onLine) void runSync()
    }, 30_000)

    void runSync()
    window.addEventListener("online", handleOnline)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      window.removeEventListener("online", handleOnline)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [enabled])

  return null
}
