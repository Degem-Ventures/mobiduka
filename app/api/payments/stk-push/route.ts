import { NextResponse } from "next/server.js"
import { authenticatedUserId, requireBusinessAccess } from "@/lib/auth"
import {
  loadTenantMpesaIntegration,
  mpesaAccessToken,
  mpesaCallbackUrl,
  mpesaEndpoints,
  mpesaTransactionType,
  MpesaConfigurationError,
} from "@/lib/mpesa"
import { assignMpesaTransactionIntegration } from "@/lib/mpesa-integration-store"
import { paymentConfigEnablesMpesa } from "@/lib/payment-config"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

type DarajaPushResult = {
  ResponseCode?: unknown
  ResponseDescription?: unknown
  MerchantRequestID?: unknown
  CheckoutRequestID?: unknown
  errorMessage?: unknown
}

function normalizePhone(value: unknown) {
  if (typeof value !== "string") return null
  let phone = value.trim().replace(/^\+/, "")
  if (phone.startsWith("0")) phone = `254${phone.slice(1)}`
  return /^254(?:7|1)\d{8}$/.test(phone) ? phone : null
}

function timestamp() {
  const now = new Date()
  const parts = [
    now.getUTCFullYear(),
    now.getUTCMonth() + 1,
    now.getUTCDate(),
    now.getUTCHours(),
    now.getUTCMinutes(),
    now.getUTCSeconds(),
  ]
  return parts.map((part) => String(part).padStart(2, "0")).join("")
}

function responseMessage(result: DarajaPushResult) {
  return typeof result.errorMessage === "string"
    ? result.errorMessage
    : typeof result.ResponseDescription === "string"
      ? result.ResponseDescription
      : "Safaricom rejected the STK request."
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      phoneNumber?: unknown
      amount?: unknown
      businessId?: unknown
    }
    const businessId = requireBusinessAccess(request, body.businessId)
    const userId = authenticatedUserId(request)
    const amount = Number(body.amount)
    const phone = normalizePhone(body.phoneNumber)

    if (!businessId || !phone || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        {
          error:
            "Authenticated business context, a valid Kenyan phone number, and a positive amount are required.",
        },
        { status: 401 },
      )
    }

    const paymentSettings = await prisma.businessSettings.findUnique({
      where: { businessId },
      select: { mpesaEnabled: true, paymentConfig: true },
    })
    if (
      !paymentSettings?.mpesaEnabled ||
      !paymentConfigEnablesMpesa(paymentSettings.paymentConfig)
    ) {
      throw new MpesaConfigurationError(
        "M-Pesa payments are not enabled for this business.",
      )
    }

    const integration = await loadTenantMpesaIntegration(businessId)
    const requestTimestamp = timestamp()
    const transactionType = mpesaTransactionType(integration.accountType)
    const reference = (integration.accountReference || "MobiDuka POS").slice(
      0,
      12,
    )
    const password = Buffer.from(
      `${integration.shortcode}${integration.credentials.passkey}${requestTimestamp}`,
    ).toString("base64")
    const callbackUrl = mpesaCallbackUrl()
    const token = await mpesaAccessToken(
      integration.credentials,
      integration.environment,
    )
    const response = await fetch(
      mpesaEndpoints(integration.environment).stkPush,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          BusinessShortCode: integration.shortcode,
          Password: password,
          Timestamp: requestTimestamp,
          TransactionType: transactionType,
          Amount: Math.round(amount),
          PartyA: phone,
          PartyB: integration.shortcode,
          PhoneNumber: phone,
          CallBackURL: callbackUrl,
          AccountReference: reference,
          TransactionDesc: "MobiDuka Retail Checkout Payment",
        }),
      },
    )
    const result = (await response.json().catch(() => ({}))) as DarajaPushResult
    const merchantRequestId =
      typeof result.MerchantRequestID === "string"
        ? result.MerchantRequestID
        : null
    const checkoutRequestId =
      typeof result.CheckoutRequestID === "string"
        ? result.CheckoutRequestID
        : null

    if (
      !response.ok ||
      String(result.ResponseCode) !== "0" ||
      !checkoutRequestId
    ) {
      return NextResponse.json(
        { success: false, error: responseMessage(result) },
        { status: 502 },
      )
    }

    const transaction = await prisma.$transaction(async (tx) => {
      const created = await tx.mpesaTransaction.create({
        data: {
          businessId,
          phoneNumber: phone,
          amount: Math.round(amount),
          accountReference: reference,
          merchantRequestId,
          checkoutRequestId,
        },
      })
      await assignMpesaTransactionIntegration(created.id, integration.id, tx)
      await tx.auditLog.create({
        data: {
          businessId,
          userId,
          action: "MPESA_PAYMENT_INITIATED",
          tableName: "MpesaTransaction",
          recordId: created.id,
        },
      })
      return created
    })

    return NextResponse.json({
      success: true,
      transactionId: transaction.id,
      checkoutRequestId,
      transactionType,
    })
  } catch (error) {
    if (error instanceof MpesaConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Unable to start the M-Pesa payment." }, {
      status: 502,
    })
  }
}
