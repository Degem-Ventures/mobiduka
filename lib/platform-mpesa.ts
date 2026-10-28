import {
  mpesaAccessToken,
  mpesaEndpoints,
  mpesaEnvironment,
  mpesaTransactionType,
  type MpesaAccountType,
  type MpesaEnvironment,
  MpesaConfigurationError,
} from "@/lib/mpesa"

export type PlatformStkPushResult = {
  merchantRequestId: string | null
  checkoutRequestId: string
}

function platformConfiguration() {
  const consumerKey = process.env.PLATFORM_MPESA_CONSUMER_KEY?.trim()
  const consumerSecret = process.env.PLATFORM_MPESA_CONSUMER_SECRET?.trim()
  const shortcode = process.env.PLATFORM_MPESA_SHORTCODE?.trim()
  const passkey = process.env.PLATFORM_MPESA_PASSKEY?.trim()
  const accountType = process.env.PLATFORM_MPESA_ACCOUNT_TYPE?.trim()
  const callbackUrl = process.env.PLATFORM_MPESA_CALLBACK_URL?.trim()
  const configuredEnvironment = process.env.PLATFORM_MPESA_ENVIRONMENT?.trim().toLowerCase()

  if (
    !consumerKey || !consumerSecret || !shortcode || !passkey || !callbackUrl ||
    (accountType !== "TILL" && accountType !== "PAYBILL")
  ) {
    throw new MpesaConfigurationError(
      "Platform subscription payments are not configured. Configure the PLATFORM_MPESA_* server environment variables.",
    )
  }
  if (configuredEnvironment && configuredEnvironment !== "sandbox" && configuredEnvironment !== "production") {
    throw new MpesaConfigurationError("PLATFORM_MPESA_ENVIRONMENT must be sandbox or production.")
  }
  const environment: MpesaEnvironment =
    configuredEnvironment === "sandbox" || configuredEnvironment === "production"
      ? configuredEnvironment
      : mpesaEnvironment()

  let callback: URL
  try {
    callback = new URL(callbackUrl)
  } catch {
    throw new MpesaConfigurationError("PLATFORM_MPESA_CALLBACK_URL must be a valid public URL.")
  }
  if (callback.protocol !== "https:" && process.env.NODE_ENV === "production") {
    throw new MpesaConfigurationError("Platform M-Pesa callbacks must use HTTPS in production.")
  }
  if (!callback.pathname.endsWith("/api/payments/platform-mpesa-callback")) {
    throw new MpesaConfigurationError(
      "PLATFORM_MPESA_CALLBACK_URL must end in /api/payments/platform-mpesa-callback.",
    )
  }

  return {
    credentials: { consumerKey, consumerSecret, passkey },
    shortcode,
    partyB: process.env.PLATFORM_MPESA_PARTY_B?.trim() || shortcode,
    accountType: accountType as MpesaAccountType,
    environment,
    callbackUrl: callback.toString(),
  }
}

export function platformMpesaCheckoutAvailable() {
  try {
    platformConfiguration()
    return true
  } catch (error) {
    if (error instanceof MpesaConfigurationError) return false
    throw error
  }
}

function timestamp() {
  const now = new Date()
  return [
    now.getUTCFullYear(),
    now.getUTCMonth() + 1,
    now.getUTCDate(),
    now.getUTCHours(),
    now.getUTCMinutes(),
    now.getUTCSeconds(),
  ].map((part) => String(part).padStart(2, "0")).join("")
}

export function normalizePlatformPhone(value: unknown) {
  if (typeof value !== "string") return null
  let phone = value.trim().replace(/^\+/, "")
  if (phone.startsWith("0")) phone = `254${phone.slice(1)}`
  return /^254(?:7|1)\d{8}$/.test(phone) ? phone : null
}

export async function createPlatformStkPush(input: {
  phoneNumber: string
  amountKsh: number
  accountReference: string
}) {
  const configuration = platformConfiguration()
  const requestTimestamp = timestamp()
  const token = await mpesaAccessToken(configuration.credentials, configuration.environment)
  const response = await fetch(mpesaEndpoints(configuration.environment).stkPush, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      BusinessShortCode: configuration.shortcode,
      Password: Buffer.from(
        `${configuration.shortcode}${configuration.credentials.passkey}${requestTimestamp}`,
      ).toString("base64"),
      Timestamp: requestTimestamp,
      TransactionType: mpesaTransactionType(configuration.accountType),
      Amount: input.amountKsh,
      PartyA: input.phoneNumber,
      PartyB: configuration.partyB,
      PhoneNumber: input.phoneNumber,
      CallBackURL: configuration.callbackUrl,
      AccountReference: input.accountReference.slice(0, 12),
      TransactionDesc: "MobiDuka Subscription",
    }),
    cache: "no-store",
  })
  const result = await response.json().catch(() => ({})) as {
    ResponseCode?: unknown
    ResponseDescription?: unknown
    MerchantRequestID?: unknown
    CheckoutRequestID?: unknown
    errorMessage?: unknown
  }
  if (
    !response.ok ||
    String(result.ResponseCode) !== "0" ||
    typeof result.CheckoutRequestID !== "string"
  ) {
    const message = typeof result.errorMessage === "string"
      ? result.errorMessage
      : typeof result.ResponseDescription === "string"
        ? result.ResponseDescription
        : "Safaricom rejected the subscription STK request."
    throw new Error(message)
  }
  return {
    merchantRequestId: typeof result.MerchantRequestID === "string"
      ? result.MerchantRequestID
      : null,
    checkoutRequestId: result.CheckoutRequestID,
  } satisfies PlatformStkPushResult
}

export async function queryPlatformStkStatus(checkoutRequestId: string) {
  const configuration = platformConfiguration()
  const requestTimestamp = timestamp()
  const token = await mpesaAccessToken(configuration.credentials, configuration.environment)
  const response = await fetch(mpesaEndpoints(configuration.environment).stkQuery, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      BusinessShortCode: configuration.shortcode,
      Password: Buffer.from(
        `${configuration.shortcode}${configuration.credentials.passkey}${requestTimestamp}`,
      ).toString("base64"),
      Timestamp: requestTimestamp,
      CheckoutRequestID: checkoutRequestId,
    }),
    cache: "no-store",
  })
  const result = await response.json().catch(() => ({})) as {
    ResponseCode?: unknown
    ResultCode?: unknown
    ResultDesc?: unknown
    errorMessage?: unknown
  }
  if (!response.ok || String(result.ResponseCode) !== "0") {
    const message = typeof result.errorMessage === "string"
      ? result.errorMessage
      : typeof result.ResultDesc === "string"
        ? result.ResultDesc
        : "Unable to verify the payment with Safaricom."
    throw new Error(message)
  }
  return {
    resultCode: typeof result.ResultCode === "undefined" ? null : Number(result.ResultCode),
    resultDescription: typeof result.ResultDesc === "string" ? result.ResultDesc : "",
  }
}
