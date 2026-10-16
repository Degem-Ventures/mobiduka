"use client"

import { Network } from "@capacitor/network"
import { useEffect, useRef } from "react"
import {
  getAutoBackupPeriodStart,
  isAutoBackupFrequency,
  isAutoBackupScheduledToday,
} from "../../lib/backup-schedule"
import { apiFetch, getClientSession } from "../../lib/client-api"
import { uploadDeviceBackup } from "../../lib/cloud-device-backup"
import { isNativeOfflineApp } from "../../lib/offline-store"

type Props = { enabled: boolean }

type BackupHistoryItem = {
  triggerType?: string
  status?: string
  createdAt?: string
  completedAt?: string | null
}

export default function AutomaticBackupWorker({ enabled }: Props) {
  const activation = useRef(0)
  const isNative = isNativeOfflineApp()

  useEffect(() => {
    if (!enabled || !isNative) return
    let active = true
    let checking = false
    let attemptedKey = ""

    const reportError = (error: unknown) => {
      const message =
        error instanceof Error
          ? error.message
          : "Automatic device backup failed."
      console.error("Automatic device backup failed.", error)
      window.dispatchEvent(
        new CustomEvent("mobiduka-auto-backup-error", { detail: { message } }),
      )
    }

    const runIfDue = async () => {
      if (!active || checking) return
      const session = getClientSession()
      if (!session?.token || session.user.offline) return
      checking = true
      try {
        const settings = await apiFetch<{
          preferences: {
            autoBackup: boolean
            autoBackupFrequency: string
            autoBackupWifiOnly: boolean
          }
        }>(
          `/api/settings?businessId=${encodeURIComponent(session.user.businessId)}`,
        )
        if (!active || !settings.preferences.autoBackup) return
        if (!isAutoBackupFrequency(settings.preferences.autoBackupFrequency)) {
          throw new Error("Saved automatic backup frequency is invalid.")
        }
        const now = new Date()
        const frequency = settings.preferences.autoBackupFrequency
        if (!isAutoBackupScheduledToday(now, frequency)) return
        const periodStart = getAutoBackupPeriodStart(now, frequency)
        const attemptKey = `${session.user.businessId}:${periodStart.toISOString()}:${activation.current}`
        if (attemptedKey === attemptKey) return

        const network = await Network.getStatus()
        if (!active || !network.connected) return
        if (
          settings.preferences.autoBackupWifiOnly &&
          network.connectionType !== "wifi"
        )
          return

        const history = await apiFetch<{
          backup: BackupHistoryItem | null
          backups?: BackupHistoryItem[]
        }>("/api/business/backup")
        if (!active) return
        const alreadyAttempted = (
          history.backups ?? (history.backup ? [history.backup] : [])
        ).some(
          (backup) =>
            backup.triggerType === "AUTO" &&
            new Date(backup.createdAt ?? backup.completedAt ?? 0) >= periodStart,
        )
        if (alreadyAttempted) {
          attemptedKey = attemptKey
          return
        }

        attemptedKey = attemptKey
        await uploadDeviceBackup(session.user.businessId, "AUTO")
      } catch (error) {
        if (active) reportError(error)
      } finally {
        checking = false
      }
    }

    void runIfDue()
    const networkListener = Network.addListener(
      "networkStatusChange",
      (status) => {
        if (status.connected) void runIfDue()
      },
    )
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        activation.current++
        void runIfDue()
      }
    }
    const handleOnline = () => void runIfDue()
    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("online", handleOnline)

    return () => {
      active = false
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("online", handleOnline)
      void networkListener.then((listener) => listener.remove())
    }
  }, [enabled, isNative])

  return null
}
