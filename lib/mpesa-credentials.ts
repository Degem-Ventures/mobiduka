import crypto from "node:crypto"

const algorithm = "aes-256-gcm"
const credentialVersion = "v1"
const nonceLength = 12
const authTagLength = 16

export type MpesaCredentials = {
  consumerKey: string
  consumerSecret: string
  passkey: string
}

export class MpesaCredentialError extends Error {}

function encryptionKey() {
  const encoded = process.env.MPESA_CREDENTIALS_ENCRYPTION_KEY?.trim()
  if (!encoded) {
    throw new MpesaCredentialError(
      "M-Pesa credential encryption is not configured on this server.",
    )
  }

  const key = Buffer.from(encoded, "base64")
  if (
    !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) ||
    key.toString("base64") !== encoded ||
    key.length !== 32
  ) {
    throw new MpesaCredentialError(
      "MPESA_CREDENTIALS_ENCRYPTION_KEY must be a base64-encoded 32-byte key.",
    )
  }
  return key
}

function additionalAuthenticatedData(businessId: string) {
  if (!businessId.trim()) {
    throw new MpesaCredentialError(
      "A business context is required for M-Pesa credentials.",
    )
  }
  return Buffer.from(`mobiduka:mpesa:${businessId}`, "utf8")
}

function validatedCredentials(value: unknown) {
  if (!value || typeof value !== "object") {
    throw new MpesaCredentialError("M-Pesa credentials are invalid.")
  }
  const candidate = value as Record<string, unknown>
  if (
    typeof candidate.consumerKey !== "string" ||
    typeof candidate.consumerSecret !== "string" ||
    typeof candidate.passkey !== "string"
  ) {
    throw new MpesaCredentialError("M-Pesa credentials are invalid.")
  }
  const credentials = {
    consumerKey: candidate.consumerKey.trim(),
    consumerSecret: candidate.consumerSecret.trim(),
    passkey: candidate.passkey.trim(),
  }
  if (
    Object.values(credentials).some((secret) => !secret || secret.length > 512)
  ) {
    throw new MpesaCredentialError("M-Pesa credentials are invalid.")
  }
  return credentials
}

function decodeSegment(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new MpesaCredentialError("Stored M-Pesa credentials are malformed.")
  }
  return Buffer.from(value, "base64url")
}

export function encryptMpesaCredentials(
  businessId: string,
  value: MpesaCredentials,
) {
  const credentials = validatedCredentials(value)
  const nonce = crypto.randomBytes(nonceLength)
  const cipher = crypto.createCipheriv(algorithm, encryptionKey(), nonce)
  cipher.setAAD(additionalAuthenticatedData(businessId))

  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(credentials), "utf8"),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  return [
    credentialVersion,
    nonce.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".")
}

export function decryptMpesaCredentials(
  businessId: string,
  ciphertext: string,
) {
  try {
    const [version, encodedNonce, encodedTag, encodedCiphertext, extra] =
      ciphertext.split(".")
    if (
      version !== credentialVersion ||
      !encodedNonce ||
      !encodedTag ||
      !encodedCiphertext ||
      extra
    ) {
      throw new MpesaCredentialError("Stored M-Pesa credentials are malformed.")
    }

    const nonce = decodeSegment(encodedNonce)
    const authTag = decodeSegment(encodedTag)
    const encrypted = decodeSegment(encodedCiphertext)
    if (
      nonce.length !== nonceLength ||
      authTag.length !== authTagLength ||
      encrypted.length === 0
    ) {
      throw new MpesaCredentialError("Stored M-Pesa credentials are malformed.")
    }

    const decipher = crypto.createDecipheriv(algorithm, encryptionKey(), nonce)
    decipher.setAAD(additionalAuthenticatedData(businessId))
    decipher.setAuthTag(authTag)
    const plaintext = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ])
    const value = JSON.parse(plaintext.toString("utf8")) as MpesaCredentials
    return validatedCredentials(value)
  } catch (error) {
    if (error instanceof MpesaCredentialError) throw error
    throw new MpesaCredentialError(
      "Stored M-Pesa credentials could not be decrypted.",
    )
  }
}
