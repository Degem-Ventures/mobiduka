import { NextResponse } from "next/server.js"
import { requireBusinessAccess } from "@/lib/auth"
import { createSystemNotification } from "@/lib/notifications"
import {
  loadTenantMpesaIntegration,
  mpesaAccessToken,
  mpesaEndpoints,
  MpesaConfigurationError,
} from "@/lib/mpesa"
import { mpesaTransactionIntegrationId } from "@/lib/mpesa-integration-store"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

type DarajaQueryResult = {
  ResponseCode?: unknown
  ResultCode?: unknown
  ResultDesc?: unknown
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
  ]
    .map((part) => String(part).padStart(2, "0"))
    .join("")
}

async function updateTransactionStatus(
  transaction: {
    id: string
    businessId: string
    checkoutRequestId: string
  },
  data: {
    status: "COMPLETED" | "FAILED"
    resultCode: number | null
    resultDescription: string
  },
) {
  await prisma.$transaction(async (tx) => {
    await tx.mpesaTransaction.update({
      where: { checkoutRequestId: transaction.checkoutRequestId },
      data,
    })
    await tx.auditLog.create({
      data: {
        businessId: transaction.businessId,
        action:
          data.status === "COMPLETED"
            ? "MPESA_PAYMENT_COMPLETED"
            : "MPESA_PAYMENT_FAILED",
        tableName: "MpesaTransaction",
        recordId: transaction.id,
      },
    })
  })
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      checkoutRequestId?: unknown
      businessId?: unknown
    }
    const businessId = requireBusinessAccess(request, body.businessId)
    if (!businessId) {
      return NextResponse.json(
        { error: "Authenticated business context is required." },
        { status: 401 },
      )
    }
    if (!body.checkoutRequestId || typeof body.checkoutRequestId !== "string") {
      return NextResponse.json({ error: "Checkout Request ID is required." }, {
        status: 400,
      })
    }

    const transaction = await prisma.mpesaTransaction.findFirst({
      where: {
        checkoutRequestId: body.checkoutRequestId,
        businessId,
      },
    })
    if (!transaction) {
      return NextResponse.json({ error: "M-Pesa transaction was not found." }, {
        status: 404,
      })
    }
    if (transaction.status === "COMPLETED") {
      return NextResponse.json({
        source: "webhook_cache",
        status: "SUCCESS",
        receipt: transaction.receiptNumber,
      })
    }
    if (transaction.status === "FAILED") {
      return NextResponse.json({
        source: "webhook_cache",
        status: "FAILED",
        message: transaction.resultDescription,
      })
    }
    const integrationId = await mpesaTransactionIntegrationId(transaction.id)
    if (!integrationId) {
      return NextResponse.json(
        { error: "This M-Pesa transaction is missing tenant configuration." },
        { status: 409 },
      )
    }

    const integration = await loadTenantMpesaIntegration(
      businessId,
      integrationId,
    )
    const requestTimestamp = timestamp()
    const token = await mpesaAccessToken(
      integration.credentials,
      integration.environment,
    )
    const response = await fetch(
      mpesaEndpoints(integration.environment).stkQuery,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          BusinessShortCode: integration.shortcode,
          Password: Buffer.from(
            `${integration.shortcode}${integration.credentials.passkey}${requestTimestamp}`,
          ).toString("base64"),
          Timestamp: requestTimestamp,
          CheckoutRequestID: transaction.checkoutRequestId,
        }),
      },
    )
    const result = (await response
      .json()
      .catch(() => ({}))) as DarajaQueryResult
    if (!response.ok) {
      return NextResponse.json(
        { error: "Safaricom STK status query is temporarily unavailable." },
        { status: 502 },
      )
    }
    const resultCode = result.ResultCode?.toString()
    const responseCode = result.ResponseCode?.toString()
    const resultDescription =
      typeof result.ResultDesc === "string"
        ? result.ResultDesc
        : "Transaction failed."
    const transientResultCodes = new Set(["1037", "4999", "500.001.1001"])

    if (resultCode === "0") {
      await updateTransactionStatus(transaction, {
        status: "COMPLETED",
        resultCode: 0,
        resultDescription,
      })
      return NextResponse.json({
        source: "live_query",
        status: "SUCCESS",
        message: resultDescription,
      })
    }
    if (resultCode === "1032") {
      const message = "User cancelled the request."
      await updateTransactionStatus(transaction, {
        status: "FAILED",
        resultCode: 1032,
        resultDescription: message,
      })
      await createSystemNotification({
        businessId: transaction.businessId,
        type: "warning",
        title: "M-Pesa Payment Cancelled",
        body: `The M-Pesa payment of KSh ${Number(transaction.amount).toLocaleString("en-KE")} was cancelled by the customer. No sale was completed.`,
        eventKey: `mpesa-payment-failed:${transaction.id}`,
      })
      return NextResponse.json({
        source: "live_query",
        status: "CANCELLED",
        message,
      })
    }
    if (
      (responseCode === "0" && !result.ResultCode) ||
      transientResultCodes.has(resultCode ?? "")
    ) {
      return NextResponse.json({
        source: "live_query",
        status: "PENDING",
        message: "Awaiting user input on handset.",
      })
    }

    await updateTransactionStatus(transaction, {
      status: "FAILED",
      resultCode:
        resultCode && /^-?\d+$/.test(resultCode) ? Number(resultCode) : null,
      resultDescription,
    })
    await createSystemNotification({
      businessId: transaction.businessId,
      type: "critical",
      title: "M-Pesa Payment Failed",
      body: `The M-Pesa payment of KSh ${Number(transaction.amount).toLocaleString("en-KE")} failed: ${resultDescription} No sale was completed.`,
      eventKey: `mpesa-payment-failed:${transaction.id}`,
    })
    return NextResponse.json({
      source: "live_query",
      status: "FAILED",
      message: resultDescription,
    })
  } catch (error) {
    if (error instanceof MpesaConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "STK status query failed." }, {
      status: 502,
    })
  }
}
