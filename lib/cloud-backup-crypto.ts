import crypto from "node:crypto"

const algorithm = "aes-256-gcm"
const nonceLength = 12
const authTagLength = 16

export class CloudBackupEncryptionError extends Error {
  constructor(
    message: string,
    readonly kind: "configuration" | "integrity" = "configuration",
  ) {
    super(message)
    this.name = "CloudBackupEncryptionError"
  }
}

function encryptionKey() {
  const encoded = process.env.BACKUP_ENCRYPTION_KEY?.trim()
  if (!encoded) {
    throw new CloudBackupEncryptionError(
      "Cloud backup encryption is not configured on this server.",
    )
  }

  const key = Buffer.from(encoded, "base64")
  if (
    !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) ||
    key.toString("base64") !== encoded ||
    key.length !== 32
  ) {
    throw new CloudBackupEncryptionError(
      "BACKUP_ENCRYPTION_KEY must be a base64-encoded 32-byte key.",
    )
  }
  return key
}

export function validateCloudBackupEncryptionKey() {
  encryptionKey()
}

function additionalAuthenticatedData(
  businessId: string,
  backupId: string,
  chunkIndex: number,
  checksum: string,
) {
  return Buffer.from(
    `mobiduka:cloud-backup:v1:${businessId}:${backupId}:${chunkIndex}:${checksum}`,
    "utf8",
  )
}

export function encryptCloudBackupChunk(
  businessId: string,
  backupId: string,
  chunkIndex: number,
  checksum: string,
  chunk: Buffer,
) {
  const nonce = crypto.randomBytes(nonceLength)
  const cipher = crypto.createCipheriv(algorithm, encryptionKey(), nonce)
  cipher.setAAD(
    additionalAuthenticatedData(businessId, backupId, chunkIndex, checksum),
  )
  const ciphertext = Buffer.concat([cipher.update(chunk), cipher.final()])

  return {
    nonce: nonce.toString("base64url"),
    authTag: cipher.getAuthTag().toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
  }
}

export function decryptCloudBackupChunk(
  businessId: string,
  backupId: string,
  chunkIndex: number,
  checksum: string,
  encrypted: { nonce: string; authTag: string; ciphertext: string },
) {
  try {
    const nonce = Buffer.from(encrypted.nonce, "base64url")
    const authTag = Buffer.from(encrypted.authTag, "base64url")
    const ciphertext = Buffer.from(encrypted.ciphertext, "base64url")
    if (
      nonce.length !== nonceLength ||
      authTag.length !== authTagLength ||
      ciphertext.length === 0
    ) {
      throw new CloudBackupEncryptionError(
        "Stored cloud backup chunk is malformed.",
        "integrity",
      )
    }

    const decipher = crypto.createDecipheriv(algorithm, encryptionKey(), nonce)
    decipher.setAAD(
      additionalAuthenticatedData(businessId, backupId, chunkIndex, checksum),
    )
    decipher.setAuthTag(authTag)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()])
  } catch (error) {
    if (error instanceof CloudBackupEncryptionError) throw error
    throw new CloudBackupEncryptionError(
      "Cloud backup chunk failed its authentication check.",
      "integrity",
    )
  }
}
