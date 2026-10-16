import assert from "node:assert/strict"
import { test } from "node:test"
import {
  CloudBackupEncryptionError,
  decryptCloudBackupChunk,
  encryptCloudBackupChunk,
  validateCloudBackupEncryptionKey,
} from "../lib/cloud-backup-crypto"

const backupKey = Buffer.alloc(32, 7).toString("base64")

test("cloud backup chunks round-trip with authenticated encryption", () => {
  const previousKey = process.env.BACKUP_ENCRYPTION_KEY
  process.env.BACKUP_ENCRYPTION_KEY = backupKey
  try {
    const plaintext = Buffer.from("tenant backup payload")
    const encrypted = encryptCloudBackupChunk(
      "business-1",
      "f2234040-bc0a-4e30-9fa2-40db82bf4244",
      0,
      "a".repeat(64),
      plaintext,
    )
    assert.notDeepEqual(Buffer.from(encrypted.ciphertext, "base64url"), plaintext)
    assert.deepEqual(
      decryptCloudBackupChunk(
        "business-1",
        "f2234040-bc0a-4e30-9fa2-40db82bf4244",
        0,
        "a".repeat(64),
        encrypted,
      ),
      plaintext,
    )
    assert.throws(
      () =>
        decryptCloudBackupChunk(
          "business-2",
          "f2234040-bc0a-4e30-9fa2-40db82bf4244",
          0,
          "a".repeat(64),
          encrypted,
        ),
      CloudBackupEncryptionError,
    )
  } finally {
    if (previousKey === undefined) delete process.env.BACKUP_ENCRYPTION_KEY
    else process.env.BACKUP_ENCRYPTION_KEY = previousKey
  }
})

test("cloud backup encryption rejects missing and invalid keys", () => {
  const previousKey = process.env.BACKUP_ENCRYPTION_KEY
  try {
    delete process.env.BACKUP_ENCRYPTION_KEY
    assert.throws(validateCloudBackupEncryptionKey, CloudBackupEncryptionError)
    process.env.BACKUP_ENCRYPTION_KEY = Buffer.alloc(16, 1).toString("base64")
    assert.throws(validateCloudBackupEncryptionKey, CloudBackupEncryptionError)
  } finally {
    if (previousKey === undefined) delete process.env.BACKUP_ENCRYPTION_KEY
    else process.env.BACKUP_ENCRYPTION_KEY = previousKey
  }
})
