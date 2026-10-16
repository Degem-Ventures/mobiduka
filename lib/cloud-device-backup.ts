"use client"

import { ApiResponseError, apiFetch } from "./client-api"
import { createOfflineBackupSnapshot } from "./offline-store"

const backupChunkSize = 256 * 1024

export type DeviceBackupMetadata = {
  id: string
  checksum: string
  chunkCount: number
  compressedBytes: number
  originalBytes: number
  collectionCount: number
  queuedRecordCount: number
  triggerType: "AUTO" | "MANUAL"
  retryCount: number
  status: "PENDING" | "COMPLETED" | "FAILED"
  failureReason: string | null
  createdAt: string
  completedAt: string | null
}

export class DeviceBackupError extends Error {
  constructor(
    message: string,
    readonly backup: DeviceBackupMetadata | null,
  ) {
    super(message)
    this.name = "DeviceBackupError"
  }
}

export async function uploadDeviceBackup(
  businessId: string,
  triggerType: "AUTO" | "MANUAL",
  onProgress?: (completed: number, total: number) => void,
): Promise<DeviceBackupMetadata> {
  let backupId: string | null = null
  let retryCount = 0
  let metadata: DeviceBackupMetadata | null = null

  try {
    const snapshot = await createOfflineBackupSnapshot(businessId)
    const snapshotJson = JSON.stringify(snapshot)
    const snapshotBytes = new TextEncoder().encode(snapshotJson)
    const checksumBuffer = await crypto.subtle.digest("SHA-256", snapshotBytes)
    const checksum = Array.from(new Uint8Array(checksumBuffer), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("")
    const compressedBytes = await new Response(
      new Blob([snapshotJson])
        .stream()
        .pipeThrough(new CompressionStream("gzip")),
    ).arrayBuffer()
    const chunkCount = Math.ceil(compressedBytes.byteLength / backupChunkSize)
    if (chunkCount < 1)
      throw new Error("The on-device backup snapshot is empty.")

    backupId = crypto.randomUUID()
    const createdAt = new Date().toISOString()
    metadata = {
      id: backupId,
      checksum,
      chunkCount,
      compressedBytes: compressedBytes.byteLength,
      originalBytes: snapshotBytes.byteLength,
      collectionCount: snapshot.collections.length,
      queuedRecordCount: snapshot.queuedRecords.length,
      triggerType,
      retryCount: 0,
      status: "PENDING",
      failureReason: null,
      createdAt,
      completedAt: null,
    }
    await apiFetch("/api/business/backup", {
      method: "POST",
      body: JSON.stringify({
        backupId,
        checksum,
        chunkCount,
        compressedBytes: compressedBytes.byteLength,
        originalBytes: snapshotBytes.byteLength,
        collectionCount: snapshot.collections.length,
        queuedRecordCount: snapshot.queuedRecords.length,
        triggerType,
      }),
    })
    onProgress?.(0, chunkCount)

    for (let index = 0; index < chunkCount; index++) {
      const start = index * backupChunkSize
      const chunk = new Blob(
        [
          compressedBytes.slice(
            start,
            Math.min(start + backupChunkSize, compressedBytes.byteLength),
          ),
        ],
        { type: "application/octet-stream" },
      )
      let uploaded = false
      for (let attempt = 0; attempt < 3 && !uploaded; attempt++) {
        try {
          await apiFetch(`/api/business/backup/${backupId}/chunks/${index}`, {
            method: "PUT",
            headers: { "Content-Type": "application/octet-stream" },
            body: chunk,
          })
          uploaded = true
        } catch (error) {
          const canRetry =
            error instanceof TypeError ||
            (error instanceof ApiResponseError && error.status >= 500)
          if (!canRetry || attempt === 2) throw error
          retryCount++
          await new Promise((resolve) =>
            setTimeout(resolve, 400 * (attempt + 1)),
          )
        }
      }
      onProgress?.(index + 1, chunkCount)
    }

    await apiFetch(`/api/business/backup/${backupId}/complete`, {
      method: "POST",
      body: JSON.stringify({ retryCount }),
    })
    return {
      ...metadata,
      retryCount,
      status: "COMPLETED",
      completedAt: new Date().toISOString(),
    }
  } catch (error) {
    const failureReason =
      error instanceof Error ? error.message : "Unable to create cloud backup."
    let failedBackup: DeviceBackupMetadata | null = null
    if (backupId && metadata) {
      failedBackup = {
        ...metadata,
        retryCount,
        status: "FAILED",
        failureReason,
      }
      try {
        await apiFetch(`/api/business/backup/${backupId}/fail`, {
          method: "POST",
          body: JSON.stringify({
            retryCount,
            failureReason: failureReason.slice(0, 500),
          }),
        })
      } catch (recordError) {
        console.error(
          "Unable to persist failed device backup history.",
          recordError,
        )
        failedBackup = null
      }
    }
    throw new DeviceBackupError(failureReason, failedBackup)
  }
}
