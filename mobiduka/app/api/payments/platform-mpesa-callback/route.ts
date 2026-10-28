import { NextResponse } from "next/server.js"
import { reconcilePlatformPayment } from "@/lib/platform-payment"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      Body?: {
        stkCallback?: {
          CheckoutRequestID?: unknown
          ResultCode?: unknown
          ResultDesc?: unknown
          CallbackMetadata?: { Item?: Array<{ Name?: unknown; Value?: unknown }> }
        }
      }
    }
    const callback = body.Body?.stkCallback
    const checkoutRequestId = callback?.CheckoutRequestID
    const rawResultCode = callback?.ResultCode
    const resultCode =
      typeof rawResultCode === "number"
        ? rawResultCode
        : typeof rawResultCode === "string" && /^-?\d+$/.test(rawResultCode)
          ? Number(rawResultCode)
          : Number.NaN
    if (
      typeof checkoutRequestId !== "string" ||
      !checkoutRequestId ||
      !Number.isInteger(resultCode)
    ) {
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Callback acknowledged." })
    }

    const payment = await prisma.platformPayment.findUnique({
      where: { checkoutRequestId },
    })
    if (!payment) {
      return NextResponse.json(
        { ResultCode: 1, ResultDesc: "Payment attempt is not available yet." },
        { status: 503 },
      )
    }
    if (payment.status !== "PENDING") {
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Callback already processed." })
    }

    if (resultCode !== 0) {
      await prisma.$transaction(async (transaction) => {
        const updated = await transaction.platformPayment.updateMany({
          where: { id: payment.id, status: "PENDING" },
          data: {
            status: "FAILED",
            resultCode,
            resultDescription: typeof callback?.ResultDesc === "string"
              ? callback.ResultDesc.slice(0, 500)
              : "M-PESA payment was not completed.",
          },
        })
        if (updated.count) {
          await transaction.auditLog.create({
            data: {
              businessId: payment.businessId,
              action: "SUBSCRIPTION_PAYMENT_FAILED",
              tableName: "PlatformPayment",
              recordId: payment.id,
            },
          })
        }
      })
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Failed payment recorded." })
    }

    const metadata = new Map(
      (callback?.CallbackMetadata?.Item ?? [])
        .filter((item) => typeof item.Name === "string")
        .map((item) => [item.Name as string, item.Value]),
    )
    const paidAmount = Number(metadata.get("Amount"))
    const receiptNumber = metadata.get("MpesaReceiptNumber")
    const validReceipt = typeof receiptNumber === "string" && !!receiptNumber.trim()
    await prisma.platformPayment.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: {
        ...(Number.isSafeInteger(paidAmount) ? { reportedAmountKsh: paidAmount } : {}),
        ...(validReceipt ? { receiptNumber: receiptNumber.trim() } : {}),
        resultCode,
      },
    })
    const status = await reconcilePlatformPayment(payment.id)
    if (status === "PENDING") {
      return NextResponse.json(
        { ResultCode: 1, ResultDesc: "Payment confirmation is pending reconciliation." },
        { status: 503 },
      )
    }
    return NextResponse.json({ ResultCode: 0, ResultDesc: `Subscription payment status: ${status}.` })
  } catch (error) {
    console.error("Platform M-PESA callback processing failed:", error)
    return NextResponse.json(
      { error: "Failed to process the platform M-PESA callback." },
      { status: 500 },
    )
  }
}
