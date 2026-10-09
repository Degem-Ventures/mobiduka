import {
  decryptMpesaCredentials,
  MpesaCredentialError,
} from "@/lib/mpesa-credentials"
import {
  findMpesaIntegration,
  type MpesaIntegrationRecord,
} from "@/lib/mpesa-integration-store"

export type MpesaEnvironment = "sandbox" | "production"
export type MpesaAccountType = "TILL" | "PAYBILL"

export class MpesaConfigurationError extends Error {}

type StoredIntegration = Omit<MpesaIntegrationRecord, "updatedAt">

const endpoints = {
  sandbox: {
    token:
      "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
    stkPush: "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
    stkQuery: "https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query",
  },
  production: {
    token:
      "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
    stkPush: "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
    stkQuery: "https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query",
  },
} as const

export function mpesaEnvironment(): MpesaEnvironment {
  const configured = process.env.MPESA_ENVIRONMENT?.trim().toLowerCase()
  if (configured === "sandbox" || configured === "production") return configured
  if (configured) {
    throw new MpesaConfigurationError(
      "MPESA_ENVIRONMENT must be either sandbox or production.",
    )
  }
  if (process.env.NODE_ENV === "production") {
    throw new MpesaConfigurationError(
      "MPESA_ENVIRONMENT must be configured in production.",
    )
  }
  return "sandbox"
}

export function mpesaEndpoints(environment = mpesaEnvironment()) {
  return endpoints[environment]
  return endpoints[mpesaEnvironment()]
}

export function mpesaCallbackUrl() {
  const value = process.env.MPESA_CALLBACK_URL?.trim()
  if (!value) {
    throw new MpesaConfigurationError("MPESA_CALLBACK_URL is not configured.")
  }

  try {
    const url = new URL(value)
    if (url.protocol !== "https:" && process.env.NODE_ENV === "production") {
      throw new Error("Production callbacks must use HTTPS.")
    }
    return url.toString()
  } catch {
    throw new MpesaConfigurationError("MPESA_CALLBACK_URL is invalid.")
  }
}

export function mpesaTransactionType(accountType: MpesaAccountType) {
  return accountType === "TILL"
    ? "CustomerBuyGoodsOnline"
    : "CustomerPayBillOnline"
}

function assertAccountType(value: string): MpesaAccountType {
  if (value === "TILL" || value === "PAYBILL") return value
  throw new MpesaConfigurationError("M-Pesa account type is invalid.")
}

function assertEnvironment(value: string): MpesaEnvironment {
  if (value === "sandbox" || value === "production") return value
  throw new MpesaConfigurationError("M-Pesa environment is invalid.")
}

async function storedIntegration(
  businessId: string,
  integrationId?: string | null,
): Promise<StoredIntegration | null> {
  return findMpesaIntegration(businessId, integrationId)
}

export async function loadTenantMpesaIntegration(
  businessId: string,
  integrationId?: string | null,
) {
  const integration = await storedIntegration(businessId, integrationId)
  if (!integration) {
    throw new MpesaConfigurationError(
      "M-Pesa has not been configured for this business.",
    )
  }

  try {
    const { credentialCiphertext, ...publicIntegration } = integration
    return {
      ...publicIntegration,
      environment: assertEnvironment(integration.environment),
      accountType: assertAccountType(integration.accountType),
      credentials: decryptMpesaCredentials(businessId, credentialCiphertext),
    }
  } catch (error) {
    if (error instanceof MpesaCredentialError) {
      if (
        error.message ===
        "M-Pesa credential encryption is not configured on this server."
      ) {
        throw new MpesaConfigurationError(
          "M-Pesa payments are unavailable because MPESA_CREDENTIALS_ENCRYPTION_KEY is missing from the server configuration.",
        )
      }
      if (
        error.message ===
        "MPESA_CREDENTIALS_ENCRYPTION_KEY must be a base64-encoded 32-byte key."
      ) {
        throw new MpesaConfigurationError(
          "M-Pesa payments are unavailable because MPESA_CREDENTIALS_ENCRYPTION_KEY is invalid. Restore the original key or configure a valid base64-encoded 32-byte key.",
        )
      }
      throw new MpesaConfigurationError(
        "The saved M-Pesa credentials cannot be decrypted with the server's current encryption key. Restore the original MPESA_CREDENTIALS_ENCRYPTION_KEY, or enter all three Daraja credentials again in Payment Methods to replace them.",
      )
    }
    throw error
  }
}

export async function mpesaAccessToken(
  credentials: {
    consumerKey: string
    consumerSecret: string
  },
  environment?: MpesaEnvironment,
) {
  const response = await fetch(mpesaEndpoints(environment).token, {
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${credentials.consumerKey}:${credentials.consumerSecret}`,
      ).toString("base64")}`,
    },
    cache: "no-store",
  })
  const payload = (await response.json().catch(() => ({}))) as {
    access_token?: unknown
  }
  if (!response.ok || typeof payload.access_token !== "string") {
    if (response.status === 400 || response.status === 401) {
      throw new MpesaConfigurationError(
        "Safaricom rejected the Consumer Key/Secret for this environment. Enter a matching pair from the selected Daraja app.",
      )
    }
    throw new MpesaConfigurationError("Safaricom OAuth token request failed.")
  }
  return payload.access_token
}
